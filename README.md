# Salary Management System

Web tool for an HR Manager to manage employees and view salary insights for a 10,000-employee organisation. CRUD employees, plus min/max/avg salary by country and average salary by job title within a country. Salary is stored in the employee's local currency (derived from country) — no FX conversion anywhere.

Authoritative docs:
- [`docs/prd.md`](./docs/prd.md) — product scope, requirements, assumptions.
- [`docs/engineering-design.md`](./docs/engineering-design.md) — stack, architecture, data model, API.
- [`docs/decisions.md`](./docs/decisions.md) — the key trade-offs and why.
- [`docs/plans/`](./docs/plans/) — per-slice design specs.

Project conventions for collaborators (human or AI) live in [`CLAUDE.md`](./CLAUDE.md).

---

## Prerequisites

- Node.js ≥20 (pinned in `.nvmrc`)
- macOS or Linux (`better-sqlite3` compiles a native binding; macOS uses prebuilt binaries when available)

## Install

```
npm install
```

This installs all workspaces (`shared`, `backend`, `frontend`) in one shot.

## Develop

```
npm run dev
```

Starts three processes in parallel:
- `shared` — `tsc --watch` so type changes flow to consumers
- `backend` — Express on `:3000` via `ts-node-dev`
- `frontend` — Vite dev server on `:5173`, proxying `/api/*` to `:3000`

Open `http://localhost:5173`.

## Seed 10,000 employees

```
npm run seed --workspace backend                 # appends 10,000 rows
npm run seed --workspace backend -- --reset      # truncates first, then 10,000
```

Reads `data/first_names.txt` and `data/last_names.txt`, inserts inside a single transaction (sub-100ms on a laptop). Salaries are picked per job title × country from an explicit table (not FX-converted) so figures look plausible in each country's local currency. Re-run anytime with `--reset` for a clean slate.

## Test

```
npm test
```

Runs both suites:
- **Backend** — Jest + Supertest. Repositories run against `:memory:` SQLite; services and controllers mock their layer below.
- **Frontend** — Jest + React Testing Library (jsdom).

Or scoped:

```
npm test --workspace backend
npm test --workspace frontend
```

## Build

```
npm run build
```

Builds each workspace into its own `dist/`. `shared` builds first (its `dist/` is what `backend` and `frontend` import at compile time).

## Lint

```
npm run lint        # check
npm run lint:fix    # apply auto-fixes (mainly the blank-line rule)
```

Style conventions live in [`docs/style-guide.md`](./docs/style-guide.md). ESLint enforces the mechanically-checkable subset; the rest is enforced by review.

## Project layout

```
backend/         Express + Kysely + better-sqlite3 + Jest
  migrations/   plain-SQL files applied by an in-app runner on startup
  scripts/      one-off TypeScript scripts (seed.ts)
  src/db/       Kysely schema interface + better-sqlite3 client
  src/lib/      AppError taxonomy, migrate runner, error middleware
  src/repositories/ services/ controllers/ routes/
  tests/        one suite per layer (incl. tests/scripts/ for seed)

frontend/        Vite + React + MUI + react-hook-form + Jest/RTL
  src/api/      typed fetch client + per-resource wrappers
  src/components/ pages/ hooks/ test/

shared/          Cross-app types and reference data (workspace package @app/shared)
  src/types.ts       Employee, EmployeeCreateInput, EmployeesListResponse
  src/countries.ts   COUNTRIES frozen map (country code → name + currency)
  src/schemas.ts     Zod schemas reused by client and server

data/            Seed inputs (first_names.txt, last_names.txt)
docs/            PRD, design, decisions, per-slice plans
```

## What's shipped vs deferred

Shipped so far:
- **Add employee (FR-1)** — `POST /api/employees` with full Zod validation and inline `409` duplicate-email mapping; MUI modal form with shared validation, country-driven currency display, success and error Alerts.
- **View employees (FR-2)** — `GET /api/employees?page&pageSize&q` returning `{ rows, total }`. MUI `<DataGrid>` in server-side pagination mode, slimmed to the at-a-glance columns (Name, Country, Salary, Hire date) with a per-row "View" action that opens the unified employee dialog. New rows from the Add form trigger an automatic grid refresh. First-run empty state shows a centered CTA instead of an empty table shell.
- **Case-insensitive search** — debounced text box filters across first name, last name, email, job title, department, and country (matching either the ISO code `IN` or the country name `India`). Search composes with pagination; `total` reflects the search result count.
- **Update employee (FR-3)** — `PUT /api/employees/:id`. A unified `EmployeeDialog` replaces today's separate Add and View modals: row click opens view mode → **Edit** transitions in-place to a prefilled form with two guards (changing country auto-clears salary and prompts re-entry in the new currency; hire-date carries an inline "historical record" note) and Save disabled while pristine. Success returns to view mode showing the updated row. `updatedAt` is maintained server-side on every save.
- **Delete employee (FR-4)** — `DELETE /api/employees/:id` returning `204`. Each grid row carries a kebab menu (View / Edit / Delete); the unified employee dialog's view-mode footer also exposes Delete next to Edit. Both entry points open a confirm modal showing name, email, and country; on success a snackbar reports "Employee deleted" and the grid refetches. Hard delete by design — no soft-delete column, no undo. A 404 on the delete is treated as success (race / repeated click) with the snackbar text "Employee already deleted".
- **Seed script** — 10,000-row bulk insert in a single transaction with `--reset` for idempotent re-runs; per-job-title × per-country salary table chosen to look plausible in each country's local currency (no FX conversion).
- **Backend tests** per layer (71 total); **frontend RTL** tests covering hooks, components, and the page (61 total).

Deliberately deferred:
- **Column sort** — `?sortBy=...&sortDir=...` with per-column sort handles. Next slice. Whitelist: firstName, lastName, email, hireDate. (Salary sort is *permanently* excluded — see PRD §5 FR-2 — because raw cross-currency salary ordering is misleading.)
- **Insights endpoints + page** (FR-5, FR-6) — country selector → min/max/avg cards; country + job title selector → average for the role.
- **Multi-stage Dockerfile + Render deploy.**
