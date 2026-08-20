// Points the admin account at the real owner: makes Fernando Serina the admin
// for LeisureWorld Bishopstown and demotes the demo admin Cian Doyle to staff.
// Idempotent — safe to re-run. Usage: npx tsx scripts/set-admin.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../lib/generated/prisma/client";

const SITE = { name: "LeisureWorld Bishopstown", code: "BT", timezone: "Europe/Dublin" };
const ADMIN = { name: "Fernando Serina", email: "fernandoserina@leisureworldcork.com" };
const DEMO_ADMIN_EMAIL = "cian.doyle@applaud.test";

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  // ---------- Site ----------
  let site = await prisma.site.findFirst({ where: { name: SITE.name } });
  if (!site) {
    site = await prisma.site.create({ data: SITE });
    await writeAudit(prisma, {
      action: "site.created",
      entityType: "site",
      entityId: site.id,
      summary: `Created site ${site.name} (${site.code})`,
      metadata: { code: site.code, active: true, timezone: site.timezone },
      siteId: site.id,
    });
    console.log(`site.created ${site.id} ${site.name} (${site.code})`);
  } else {
    console.log(`site exists ${site.id} ${site.name} (${site.code})`);
  }

  // ---------- Admin ----------
  const existing = await prisma.user.findUnique({ where: { email: ADMIN.email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name: ADMIN.name, role: "admin", siteId: site.id, active: true },
      })
    : await prisma.user.create({
        data: { ...ADMIN, role: "admin", siteId: site.id },
      });
  await writeAudit(prisma, {
    action: existing ? "user.updated" : "user.created",
    entityType: "user",
    entityId: user.id,
    summary: `${existing ? "Updated" : "Created"} user ${user.name} (${user.role})`,
    metadata: { email: user.email, role: user.role, siteId: site.id, active: user.active },
    siteId: site.id,
  });
  console.log(`${existing ? "user.updated" : "user.created"} ${user.id} ${user.email} ${user.role} site=${site.name}`);

  // ---------- Demote the demo admin ----------
  const demo = await prisma.user.findUnique({ where: { email: DEMO_ADMIN_EMAIL } });
  if (demo && demo.role === "admin") {
    await prisma.user.update({ where: { id: demo.id }, data: { role: "staff" } });
    await writeAudit(prisma, {
      action: "user.updated",
      entityType: "user",
      entityId: demo.id,
      summary: `Updated user ${demo.name} (staff)`,
      metadata: { email: demo.email, role: "staff", siteId: demo.siteId, active: demo.active },
      siteId: demo.siteId,
    });
    console.log(`user.updated ${demo.id} ${demo.email} admin -> staff`);
  } else {
    console.log(`demo admin ${DEMO_ADMIN_EMAIL}: ${demo ? `already ${demo.role}` : "not found"}`);
  }

  await prisma.$disconnect();
}

// Same shape as lib/audit.ts writeAudit, but actor-less (system) and without
// the Next-only imports that file pulls in.
async function writeAudit(
  prisma: PrismaClient,
  event: {
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    metadata: Prisma.InputJsonValue;
    siteId: string | null;
  },
) {
  await prisma.auditEvent.create({ data: event });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
