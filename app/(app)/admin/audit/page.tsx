import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit";
import { fullTimestamp } from "@/lib/datetime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

const PAGE_SIZE = 25;

function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    actor?: string;
    from?: string;
    to?: string;
    site?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const action = sp.action && isAuditAction(sp.action) ? sp.action : undefined;
  const actor = (sp.actor ?? "").trim();
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();
  const siteId = sp.site && sp.site !== "all" ? sp.site : undefined;
  const page = Math.max(1, Math.floor(Number(sp.page ?? 1)) || 1);

  const where: Prisma.AuditEventWhereInput = {};
  if (action) where.action = action;
  if (actor) where.actorEmail = { contains: actor, mode: "insensitive" };
  if (siteId) where.siteId = siteId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) where.createdAt.lte = new Date(`${to}T23:59:59.999Z`);
  }

  const [sites, total, events] = await Promise.all([
    prisma.site.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        actorEmail: true,
        actorRole: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        siteId: true,
      },
    }),
  ]);

  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const next = {
      action: action ?? "",
      actor,
      from,
      to,
      site: siteId ?? "all",
      page: String(page),
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      const value = v === undefined ? "" : String(v);
      if (value && value !== "all" && !(k === "page" && value === "1")) params.set(k, value);
    }
    const encoded = params.toString();
    return encoded ? `/admin/audit?${encoded}` : "/admin/audit";
  };

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Append-only record of mutations on the platform. Rows cannot be edited or deleted."
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs font-medium">
          <span className="text-muted">Action</span>
          <select
            name="action"
            defaultValue={action ?? ""}
            className="border-input bg-background block h-9 min-w-44 rounded-md border px-2 text-sm"
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span className="text-muted">Actor email</span>
          <Input name="actor" defaultValue={actor} placeholder="someone@…" className="h-9 w-48" />
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span className="text-muted">From</span>
          <Input name="from" type="date" defaultValue={from} className="h-9 w-40" />
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span className="text-muted">To</span>
          <Input name="to" type="date" defaultValue={to} className="h-9 w-40" />
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span className="text-muted">Site</span>
          <select
            name="site"
            defaultValue={siteId ?? "all"}
            className="border-input bg-background block h-9 min-w-40 rounded-md border px-2 text-sm"
          >
            <option value="all">All sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm">
          Filter
        </Button>
      </form>

      <p className="text-muted mb-2 text-xs">
        <span data-numeric>{total}</span> event{total === 1 ? "" : "s"}
      </p>

      <div className="border-border bg-surface overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/40 hover:bg-secondary/40">
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Site</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length ? (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {fullTimestamp(event.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {event.actorEmail ? (
                      <div>
                        <div className="truncate">{event.actorEmail}</div>
                        {event.actorRole ? (
                          <Badge variant="secondary" className="mt-0.5">
                            {event.actorRole}
                          </Badge>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted">System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {event.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-sm text-sm">{event.summary}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <div>{event.entityType}</div>
                    {event.entityId ? (
                      <div className="text-muted truncate" title={event.entityId}>
                        {event.entityId.slice(0, 10)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted">
                    {event.siteId ? (siteName.get(event.siteId) ?? "—") : "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-muted h-24 text-center">
                  No audit events match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-muted text-xs">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-1">
            <Button asChild variant="outline" size="sm">
              <Link href={qs({ page: Math.max(1, page - 1) })} aria-disabled={page <= 1}>
                Prev
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                href={qs({ page: Math.min(pageCount, page + 1) })}
                aria-disabled={page >= pageCount}
              >
                Next
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
