# Applaud

Employee recognition & rewards platform for a multi-site leisure operator.
Peer-to-peer recognition against company values, a points wallet backed by an
append-only ledger, an internal rewards catalogue, nomination-based awards,
auto-celebrated milestones, and an adoption analytics dashboard.

> The product name is defined once as `APP_NAME` in `lib/config.ts`.

## Stack

- **Next.js 16** (App Router, Server Actions) · **React 19** · **TypeScript 5**
- **Tailwind CSS v4** (`@theme` tokens) · **shadcn/ui** · **lucide-react**
- **Prisma 7 + PostgreSQL** (Neon) via the `@prisma/adapter-pg` driver
- **next-auth v5** (Auth.js) · **Zod v4** · **TanStack Table** · **date-fns v4**
- **Recharts v3** · **Framer Motion v12** · **Sonner v2**

Fonts: Space Grotesk (display), IBM Plex Sans (body), IBM Plex Mono (numbers).

## Getting started

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL + secrets
npm run db:migrate            # create & apply the schema
npm run db:seed               # load realistic dev data
npm run dev                   # http://localhost:3000
```

### Environment

| Var            | Purpose                                       |
| -------------- | --------------------------------------------- |
| `DATABASE_URL` | Postgres connection string (Neon, or local)   |
| `AUTH_SECRET`  | next-auth signing secret (`npx auth secret`)  |
| `AUTH_URL`     | App base URL                                  |
| `CRON_SECRET`  | Bearer token for the milestone cron endpoint  |

## Scripts

| Script               | Description                       |
| -------------------- | -------------------------------- |
| `npm run dev`        | Dev server                       |
| `npm run build`      | Production build                 |
| `npm run typecheck`  | `tsc --noEmit`                   |
| `npm run db:migrate` | `prisma migrate dev`             |
| `npm run db:seed`    | Seed dev data (`prisma/seed.ts`) |
| `npm run db:studio`  | Prisma Studio                    |
| `npm run db:reset`   | Reset DB and re-seed             |

## The two-ledger points model

There are two separate pools — do not merge them:

- **Giving allowance** — a monthly budget for recognising others. Resets
  monthly, never rolls over, never redeemable. Remaining allowance is computed
  on the fly from recognitions sent in the current month.
- **Redeemable wallet** — points *received*. `walletBalance = SUM(RewardLedger.amount)`.
  The `RewardLedger` is **append-only and immutable**; corrections are new
  `ADJUSTMENT` rows. `User.walletBalance` is a cache written inside the same
  transaction as the ledger row, with an admin `recompute` action as backstop.

## Build status

| Phase | Scope                              | State                         |
| ----- | ---------------------------------- | ----------------------------- |
| 0     | Scaffold, design system, app shell | done                          |
| 1     | Schema + seed                      | done                          |
| 2     | Auth & roles                       | done                          |
| 3     | Recognition core                   | done                          |
| 4     | Profiles & leaderboard             | done                          |
| 5     | Rewards & fulfilment               | done                          |
| 6     | Awards                             | todo                          |
| 7     | Milestones cron                    | todo                          |
| 8     | Analytics & settings               | todo                          |
