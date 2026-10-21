// Adds every person on a staff roster CSV (taken from the Roster Browser
// export; columns empNo,employeeName) as a staff user. The roster holds real
// staff names, so it lives outside the repo and is passed in with --file. Additive and idempotent:
// anyone already in the app — matched by email or by name — is left exactly
// as they are, and nothing is ever deleted. Safe to re-run.
//
// The roster prints names surname first ("O Gorman Hogan Mairead"), so the
// last word is the first name and everything before it is the surname.
//
// Usage:
//   npx tsx scripts/import-staff.ts --file=roster.csv            # dry run, writes nothing
//   npx tsx scripts/import-staff.ts --file=roster.csv --apply    # create the missing users
// Options:
//   --site=BT                  site code new users are assigned to (default BT)
//   --domain=leisureworldcork.com  email domain; address is firstnamesurname@domain
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"] as const;
  }),
);
const APPLY = args.get("apply") === "true";
const SITE_CODE = args.get("site") ?? "BT";
const DOMAIN = args.get("domain") ?? "leisureworldcork.com";
const FILE = args.get("file");

// Rows on the roster that aren't people.
const SKIP_NAMES = new Set(["ef test"]);

type Person = { empNo: string; raw: string; first: string; surname: string; name: string; email: string };

/** "O Gorman Hogan Mairead" -> { first: "Mairead", surname: "O'Gorman Hogan" } */
export function splitRosterName(raw: string): { first: string; surname: string } {
  const words = raw.trim().split(/\s+/).map(capitalise);
  const first = words.pop() ?? "";
  // Join the Irish prefixes the roster prints detached: "O Brien" / "O' Flynn"
  // -> "O'Brien", "Mc Carthy" -> "McCarthy".
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    if (next && (w === "O" || w === "O'")) {
      out.push(`O'${next}`);
      i++;
    } else if (next && w === "Mc") {
      out.push(`Mc${next}`);
      i++;
    } else {
      out.push(w);
    }
  }
  return { first, surname: out.join(" ") };
}

function capitalise(w: string) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** Lowercase letters only, accents stripped: the key names are matched on. */
export function nameKey(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
}

function parseCsv(path: string): { empNo: string; employeeName: string }[] {
  const [header, ...lines] = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  if (header.trim() !== "empNo,employeeName") throw new Error(`Unexpected header in ${path}: ${header}`);
  return lines.map((line) => {
    const m = line.match(/^([^,]*),"?(.*?)"?$/);
    if (!m) throw new Error(`Bad row: ${line}`);
    return { empNo: m[1].trim(), employeeName: m[2].trim() };
  });
}

async function main() {
  if (!FILE) throw new Error("Pass the roster with --file=path/to/roster.csv");
  const rows = parseCsv(FILE);
  const people: Person[] = [];
  const seenEmp = new Set<string>();
  const skipped: string[] = [];
  for (const r of rows) {
    // The roster repeats a person once per extra shift line.
    if (seenEmp.has(r.empNo)) continue;
    seenEmp.add(r.empNo);
    if (SKIP_NAMES.has(r.employeeName.toLowerCase())) {
      skipped.push(`${r.empNo} ${r.employeeName} (not a person)`);
      continue;
    }
    const { first, surname } = splitRosterName(r.employeeName);
    const name = `${first} ${surname}`;
    people.push({
      empNo: r.empNo,
      raw: r.employeeName,
      first,
      surname,
      name,
      email: `${nameKey(first)}${nameKey(surname)}@${DOMAIN}`,
    });
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  const site = await prisma.site.findUnique({ where: { code: SITE_CODE } });
  if (!site) throw new Error(`No site with code ${SITE_CODE}. Pass --site=<code>.`);

  const existing = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
  const byEmail = new Map(existing.map((u) => [u.email.toLowerCase(), u]));
  const byName = new Map(existing.map((u) => [nameKey(u.name), u]));

  const toCreate: Person[] = [];
  const already: string[] = [];
  const batchEmails = new Set<string>();
  for (const p of people) {
    const match = byEmail.get(p.email) ?? byName.get(nameKey(p.name));
    if (match) {
      already.push(`${p.empNo} ${p.name} -> existing ${match.name} <${match.email}>`);
      continue;
    }
    if (batchEmails.has(p.email)) {
      skipped.push(`${p.empNo} ${p.name} (email ${p.email} clashes with another roster row)`);
      continue;
    }
    batchEmails.add(p.email);
    toCreate.push(p);
  }

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — roster ${FILE}, site ${site.name} (${site.code})`);
  console.log(`  unique roster entries:       ${seenEmp.size}`);
  console.log(`  already in the app:          ${already.length}`);
  console.log(`  to create:                   ${toCreate.length}`);
  console.log(`  skipped:                     ${skipped.length}`);
  console.log("\nAlready in the app (left untouched):");
  for (const s of already) console.log(`  ${s}`);
  console.log("\nSkipped:");
  for (const s of skipped) console.log(`  ${s}`);
  console.log(`\n${APPLY ? "Creating" : "Would create"}:`);
  for (const p of toCreate) console.log(`  ${p.empNo.padStart(4)}  ${p.raw.padEnd(28)} -> ${p.name.padEnd(30)} ${p.email}`);

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to write.");
    await prisma.$disconnect();
    return;
  }

  let created = 0;
  for (const p of toCreate) {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: p.name, email: p.email, role: "staff", siteId: site.id },
      });
      // Same shape as lib/audit.ts writeAudit, actor-less (system import).
      await tx.auditEvent.create({
        data: {
          action: "user.created",
          entityType: "user",
          entityId: user.id,
          summary: `Created user ${user.name} (staff) from staff roster`,
          metadata: { email: user.email, role: "staff", siteId: site.id, active: true, empNo: p.empNo, source: "staff-roster" },
          siteId: site.id,
        },
      });
    });
    created++;
  }
  console.log(`\nCreated ${created} users.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
