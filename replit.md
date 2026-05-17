# KIPS School Management System

A full-stack school management web app for KIPS — managing students, fees, attendance, exams, staff, salaries, accounts, and certificates.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/kips-sms run dev` — run the frontend (port 25329)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed database with demo data

## Required Environment Variables

- `NEON_DATABASE_URL` — Neon PostgreSQL connection string (already set)
- `JWT_SECRET` — JWT signing secret (already set: `kips-school-jwt-secret-2026-super-secure`)
- `SESSION_SECRET` — Express session secret (already set)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080)
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + Framer Motion
- DB: Neon PostgreSQL + Drizzle ORM
- Auth: JWT (stored in localStorage)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/` — all API route handlers
- `artifacts/kips-sms/src/pages/` — all frontend pages
- `artifacts/kips-sms/src/components/` — sidebar, app-layout, auth-guard, UI
- `lib/db/src/schema.ts` — Drizzle ORM schema (source of truth)
- `lib/api-spec/` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `scripts/src/seed.ts` — database seeder

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks used in all pages
- JWT stored in localStorage; `setAuthTokenGetter` in App.tsx attaches token to every API request
- DB uses `NEON_DATABASE_URL || DATABASE_URL` with SSL for both dev and prod
- All routes protected by `requireAuth` middleware; role checked per-route where needed
- Sidebar uses role-based filtering so students/teachers only see relevant sections

## Product

- **Login**: Purple gradient login page with role selector (Admin / Teacher / Student)
- **Dashboard**: Animated stat cards (students, teachers, income, expenses, pending fees)
- **Students**: List, search, add new students with full admission flow
- **Classes**: Class management with capacity and section info
- **Fees**: Fee collection, payment recording, status tracking
- **Fee Defaulters**: Defaulter report with pending amounts
- **Attendance**: Mark and view attendance per class/date
- **Exams**: Exam schedule and result entry
- **Staff**: Staff directory with roles and status
- **Salaries**: Salary disbursement records
- **Accounts**: Income/expense ledger with monthly summaries
- **Certificates**: Certificate issuance and tracking
- **Reports**: Printable summary reports

## Demo Credentials (after seeding)

| Role    | Username              | Password  |
|---------|-----------------------|-----------|
| Admin   | admin                 | admin123  |
| Teacher | ahmad.ali.staff       | kips123   |
| Student | ali.hassan.1001       | kips123   |

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/db run push` after schema changes before running seed
- Always run `pnpm --filter @workspace/api-spec run codegen` after OpenAPI spec changes
- API server must be rebuilt (`restart_workflow`) after route changes — it bundles with esbuild
- The `scripts` package uses direct `pg` + `bcryptjs` (not Drizzle) for the seed script to avoid ESM issues

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
