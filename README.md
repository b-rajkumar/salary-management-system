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
  src/db/       Kysely schema interface + better-sqlite3 client
  src/lib/      AppError taxonomy, migrate runner, error middleware
  src/repositories/ services/ controllers/ routes/
  tests/        one suite per layer

frontend/        Vite + React + MUI + react-hook-form + Jest/RTL
  src/api/      typed fetch client + per-resource wrappers
  src/components/ pages/ test/

shared/          Cross-app types and reference data (workspace package @app/shared)
  src/types.ts       Employee, EmployeeCreateInput
  src/countries.ts   COUNTRIES frozen map (country code → name + currency)
  src/schemas.ts     Zod schemas reused by client and server

docs/            PRD, design, decisions, per-slice plans
```

## What's shipped vs deferred

The current slice (Add Employee) ships:
- `POST /api/employees` with full Zod validation and inline `409` duplicate-email mapping.
- MUI modal form with shared validation, country-driven currency display, success and error Alerts.
- Backend tests per layer; frontend RTL tests for the form and page wiring.

Not yet implemented (tracked in the PRD and upcoming plans):
- List with pagination/sort/filter (`GET /api/employees`) and the `<DataGrid>` view.
- Update / delete employee.
- Insights endpoints (`/api/insights/country/...`).
- Seed script for 10,000 employees.
- Multi-stage Dockerfile + Render deploy.
