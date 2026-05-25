# Salary Management System

Web tool for an HR Manager to manage employees and view salary insights for a 10,000-employee organisation. Salary is stored in the employee's local currency (derived from country) — no FX conversion.

**Live:** https://salary-management-system-o22x.onrender.com/

## Stack

- **Backend:** Node 20 + Express + TypeScript. SQLite via `better-sqlite3`, queried through Kysely (typed SQL builder, no ORM). Zod for validation at every API boundary. Jest + Supertest, in-memory SQLite per test.
- **Frontend:** Vite + React + TypeScript. MUI components (notably `<DataGrid>` for the 10k-row table). `react-hook-form` + Zod for form validation, sharing schemas with the backend. Jest + React Testing Library.
- **Shared package:** `shared/` workspace exports API response types and a frozen country→currency map consumed by both apps — API-contract drift becomes a compile error.
- **Deploy:** Multi-stage `Dockerfile` on `node:20-slim` (non-root user, healthcheck on `/api/health`). Local: `docker-compose.yml`. Production: Render free tier, `env: docker`, `SEED_ON_EMPTY=1` rehydrates 10k rows on cold start.

## Run

Fastest path is Docker:

```
docker compose up
# visit http://localhost:3000
```

The container seeds 10,000 employees on first boot. `SEED_ON_EMPTY=0 docker compose up` skips the seed for empty-state UX. `docker compose down && docker compose up` resets and re-seeds.

For development with hot reload, run the workspaces natively:

```
npm install
npm run dev                              # backend :3000, frontend :5173 (proxies /api)
npm run seed --workspace backend         # 10,000 employees (rerun with --reset)
npm test                                 # backend + frontend
```

Requires Node 20+.

## What's shipped

The live app supports CRUD on employees and two salary insights surfaces — distribution by country (min/max/mean + per-department breakdown + tenure metrics), and the same view filtered by job title within a country. Search across name/email/role/department/country (case-insensitive, matches either ISO code or country name). 10,000-row seed in a single transaction. See the PRD for the full requirements list.

## Docs

- [`docs/prd.md`](./docs/prd.md) — product scope, requirements, assumptions.
- [`docs/engineering-design.md`](./docs/engineering-design.md) — stack, architecture, data model, API, deployment.
- [`docs/decisions.md`](./docs/decisions.md) — key trade-offs and why.
- [`docs/plans/`](./docs/plans/) — per-slice design specs.
- [`CLAUDE.md`](./CLAUDE.md) — collaboration conventions for human or AI contributors.
