# Engineering Design — Salary Management System

Companion to the [PRD](./prd.md). The PRD owns *what* we are building and *why*. This document owns *how* it is built.

---

## 1. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript | Same language across backend and frontend. |
| Backend | Node.js + Express | Familiar; broad ecosystem. |
| Database | SQLite (file-backed) | Zero-setup, single file on a mounted volume. |
| DB driver | `better-sqlite3` | Synchronous, fastest Node SQLite driver. Used by Kysely for app queries and directly by the seed. |
| Query builder | Kysely | Type-safe SQL against a TS schema interface. No ORM, no codegen, no schema DSL — the SQL stays the SQL. |
| Migrations | Plain SQL files + tiny runner (~25 LOC) | One table, one initial migration. Kysely doesn't manage schema. |
| Validation | Zod | Single source of truth for input schemas at the API boundary. |
| Backend tests | Jest + Supertest | In-memory SQLite keeps the suite fast and deterministic. |
| Frontend | Vite + React + TypeScript | Lean; fast dev server. |
| UI library | MUI (Material UI) | `<DataGrid>` solves the 10k-row table problem out of the box. |
| Form handling | `react-hook-form` + Zod | Shared schema between client and server. |
| Frontend tests | Jest + React Testing Library | Same runner as backend. |
| Container | Multi-stage Dockerfile | Single artifact, backend serves the static frontend. |
| Hosting | Render | Free web service (Docker env). SQLite is ephemeral on free tier; `SEED_ON_EMPTY=1` rehydrates 10k rows on cold start. Starter + persistent disk is the documented upgrade path (see §11). |

See [decisions.md](./decisions.md) for the calls behind these choices.

## 2. Repository Layout

```
salary-management-system/
├── backend/               # Express + Kysely + better-sqlite3 + Jest
│   ├── migrations/
│   │   └── 001_init.sql   # CREATE TABLE employees, indexes
│   ├── src/
│   │   ├── db/
│   │   │   ├── types.ts   # Kysely schema interface (mirrors 001_init.sql)
│   │   │   └── client.ts  # Kysely instance over better-sqlite3
│   │   ├── controllers/   # HTTP + Zod validation, one file per resource
│   │   ├── services/      # business logic, orchestrates repositories
│   │   ├── repositories/  # all DB access; Kysely queries live here
│   │   ├── routes/        # thin route table wiring URLs to controllers
│   │   ├── lib/           # migrate(), zod schemas, errors
│   │   └── server.ts      # Express app bootstrap
│   ├── scripts/
│   │   └── seed.ts        # 10k-row bulk insert via transaction
│   ├── tests/
│   └── package.json
├── frontend/              # Vite + React + MUI + Jest
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── api/           # typed fetch wrappers
│   │   └── main.tsx
│   └── package.json
├── shared/                # Shared TypeScript types + countries reference data
│   ├── src/
│   │   ├── types.ts       # Employee, list/insights response shapes
│   │   └── countries.ts   # frozen { [code]: { name, currency } } map
│   └── package.json
├── data/
│   ├── first_names.txt
│   └── last_names.txt
├── docs/
├── Dockerfile             # multi-stage
├── docker-compose.yml     # local dev
├── package.json           # npm workspaces root
├── CLAUDE.md              # AI coding conventions
└── README.md
```

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Single Docker container                    │
│                                                             │
│   Browser ──▶ Express :3000                                 │
│                  │                                          │
│                  ├──▶ /api/*  → controllers                 │
│                  │                  → services              │
│                  │                    → repositories        │
│                  │                          │               │
│                  │                          ▼               │
│                  │              Kysely + better-sqlite3     │
│                  │                          │               │
│                  │                          ▼               │
│                  │                  ┌──────────────┐        │
│                  │                  │   SQLite     │        │
│                  │                  │ /data/app.db │        │
│                  │                  └──────────────┘        │
│                  │                                          │
│                  └──▶ /*        → static React build        │
│                                   (Vite output, SPA fallback)│
└─────────────────────────────────────────────────────────────┘
```

One process. One container. One database file on the container's writable filesystem — ephemeral on Render free tier and on local Docker. Mountable as a real volume in a Starter-plan deploy by adding a `disk:` block to `render.yaml`; no code change required.

### Component boundaries

**Layering rule (backend):** Controller → Service → Repository. Classes carry the layer suffix (`EmployeesController`, `EmployeesService`, `EmployeesRepository`) and live under sibling `controllers/`, `services/`, `repositories/` folders — organization is by-layer, not by-feature. See [CLAUDE.md](../CLAUDE.md) for the contract each layer follows.

**Shared types package:** `shared/` exports the canonical `Employee`, `EmployeesListResponse`, and insights response types. Both `backend` and `frontend` depend on it through npm workspaces, so API-contract drift is a compile-time error.

## 4. Data Model

Schema lives in `backend/migrations/001_init.sql`:

```sql
CREATE TABLE employees (
  id          INTEGER PRIMARY KEY,
  firstName   TEXT    NOT NULL,
  lastName    TEXT    NOT NULL,
  email       TEXT    NOT NULL UNIQUE,
  jobTitle    TEXT    NOT NULL,
  department  TEXT    NOT NULL,
  country     TEXT    NOT NULL,                  -- ISO 3166-1 alpha-2
  salary      INTEGER NOT NULL,                  -- whole units of the country's currency
  hireDate    TEXT    NOT NULL,                  -- ISO 8601 string
  createdAt   TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updatedAt   TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX idx_employees_country           ON employees (country);
CREATE INDEX idx_employees_country_jobTitle_nocase  ON employees (country, jobTitle COLLATE NOCASE);
```

Both the API-contract type (`shared/Employee`) and the Kysely DB interface (`backend/src/db/types.ts`) are hand-mirrored from this SQL. They're declared once each in TypeScript; the SQL stays the single source of truth. The repository uses `Kysely<DB>` and gets compile-time checks on table names, column names, operators, and result shapes.

**Design notes:**
- `salary` is `INTEGER` (whole units) to avoid float precision. The unit is the country's currency, derived from `country` via the `shared/countries.ts` map — never stored on the row.
- `email` is the natural unique business key; `id` is the surrogate key in URLs.
- Dates stored as ISO 8601 `TEXT` (SQLite has no native date type).
- Two indexes sized to the exact metric queries.
- Migration 002 swaps the original binary-collation `(country, jobTitle)` index for the case-insensitive one — case-insensitive matching is the contract for the FR-6 role picker (see `decisions.md`).

### Country reference data

`shared/src/countries.ts` exports a frozen map keyed by ISO 3166-1 alpha-2 code, with each entry holding `{ name, currency }` (ISO 4217 alpha-3). Both apps consume it directly — no `/api/countries` endpoint, no DB table. The Zod schema for `country` is built from `Object.keys(COUNTRIES)`, so invalid codes are rejected at the boundary. The frontend's country dropdown is driven from the same map.

## 5. API Design

REST under `/api`. All responses JSON. Validation via Zod at every input boundary.

### Employees

| Method | Path                  | Purpose |
|--------|-----------------------|---------|
| GET    | `/api/employees`      | List with pagination, sort, filter, search |
| GET    | `/api/employees/:id`  | Get one |
| POST   | `/api/employees`      | Create |
| PUT    | `/api/employees/:id`  | Update (full) |
| DELETE | `/api/employees/:id`  | Delete |
| POST   | `/api/employees/bulk` | Bulk create up to 500 employees, all-or-nothing (FR-7) |

**`GET /api/employees` query params:**
- `page` (default 0), `pageSize` (default 50, max 200)
- `sortBy` (one of: `firstName`, `lastName`, `email`, `hireDate`), `sortDir` (`asc`|`desc`)
- `q` (case-insensitive search across firstName, lastName, email, jobTitle, department, and country; country matches both the ISO code via `LOWER(country) LIKE` and the country name via a JS-side `COUNTRIES` lookup that translates to a set of codes for an `IN (...)` clause. SQL `LIKE` is sufficient at 10k rows.)

**Default order:** when `sortBy` is omitted, rows return ordered by `id DESC` — newest first. This keeps a freshly added row on page 1 so HR can confirm the add immediately. Insertion order is the only sort claim of the default; user-driven sorts override it.

**Response shape:** `{ rows: Employee[], total: number }` — matches MUI DataGrid's server-side mode.

**`PUT /api/employees/:id`** — same body as `POST /api/employees`. Returns the updated row (`200 Employee`). Validation errors → `400`; unknown id → `404 EMPLOYEE_NOT_FOUND`; email collision with another row → `409 EMAIL_TAKEN`. `updatedAt` is set server-side at the repository layer (`new Date().toISOString()`) on every update; the value in the request body, if any, is ignored.

**`DELETE /api/employees/:id`** — no body. Returns `204 No Content` on success. Validation errors on the `:id` param → `400`; unknown id → `404 EMPLOYEE_NOT_FOUND`. No cascade or referential-integrity concerns — `employees` is the only table.

**`POST /api/employees/bulk`** — body `{ employees: EmployeeCreateInput[] }`, length 1–500. Validated by `bulkCreateEmployeesSchema` (wraps the single-create schema) under a route-scoped 3 MB JSON body limit (the global limit stays at the default for every other route). Four layers of checks, each short-circuiting on failure: (A) Zod shape + per-row format → `400 VALIDATION_ERROR`; (B) in-file duplicate emails, case-insensitive, every participating row flagged → `400 IN_FILE_DUPLICATE_EMAIL`; (C) in-DB duplicate emails, one indexed `SELECT email WHERE email IN (?,…)` against the unique index, all colliding rows flagged → `409 EMAIL_TAKEN`; (D) one multi-row `INSERT` — implicitly atomic in SQLite, so a constraint violation rolls back the whole statement. Success: `201 { inserted: <count> }`. Error envelope reuses the existing `{ error: { code, message, details? } }` shape with `details.errors: { index, field, message }[]` carrying per-row failures.

### Insights

| Method | Path                                                  | Purpose |
|--------|-------------------------------------------------------|---------|
| GET    | `/api/insights/country/:country`                      | salary distribution + headcount + tenure + department breakdown for a country |
| GET    | `/api/insights/country/:country/job-titles`           | distinct job titles present in a country (picker source for FR-6) |
| GET    | `/api/insights/country/:country/job-title?title=...`  | salary distribution + headcount + tenure for a (country, job title) pair |

All three return `404` when no matching employees exist (`COUNTRY_NOT_FOUND` for the first two, `ROLE_IN_COUNTRY_NOT_FOUND` for the third). Responses include the country's `currency` (ISO 4217 alpha-3) so the UI can format without a second lookup.

**Country response:**

```json
{
  "country": "IN", "currency": "INR", "count": 312,
  "salary": { "min": 600000, "max": 4500000, "avg": 1820000 },
  "tenure": { "avgYears": 3.4, "newHiresLast12Months": 47 },
  "departments": [
    { "department": "Engineering", "headcount": 180, "avgSalary": 2100000 },
    { "department": "Sales",        "headcount": 78,  "avgSalary": 1400000 }
  ]
}
```

**Job-titles response:**

```json
{ "country": "IN", "jobTitles": ["Designer", "Engineering Manager", "Product Manager", "Software Engineer"] }
```

**Role-in-country response:**

```json
{
  "country": "IN", "currency": "INR", "jobTitle": "Software Engineer", "count": 87,
  "salary": { "min": 800000, "max": 3200000, "avg": 1650000 },
  "tenure": { "avgYears": 2.8, "newHiresLast12Months": 19 }
}
```

All numeric salary fields are integers in whole units of that country's currency. `tenure.avgYears` is rounded to one decimal. No FX conversion is performed anywhere in the system.

Both `idx_employees_country` and `idx_employees_country_jobTitle` cover the filter step at 10k rows.

### Error responses

Uniform shape: `{ error: { code: string, message: string, details?: object } }`. Standard HTTP statuses: `400` validation, `404` not found, `409` duplicate email, `500` server.

## 6. Request Flows

### CRUD (create example)

1. Browser sends `POST /api/employees` with JSON.
2. `EmployeesController.create` runs the body through a Zod schema.
3. On validation failure → `400 { error: { code: "VALIDATION_ERROR", ... } }`.
4. On success → controller calls `employeesService.create(input)`.
5. `EmployeesService.create` performs any business logic and delegates persistence to `EmployeesRepository.insert(input)`.
6. The repository runs the insert via Kysely, catches the `email` unique-constraint violation, and rethrows it as `ConflictError("EMAIL_TAKEN")`.
7. Global error middleware maps `AppError` subclasses to the right HTTP status.
8. Controller returns `201` with the new employee.

### Country insights

1. `GET /api/insights/country/:country` arrives.
2. `InsightsController` validates `country` against the ISO alpha-2 whitelist built from `COUNTRIES`.
3. Controller calls `insightsService.byCountry(country)`. The service calls two repository methods on `InsightsRepository`:
   - `aggregateByCountry(country)` — one query: count + min/max/mean + avg tenure + new-hires-last-12-months.
   - `departmentsByCountry(country)` — one query: `GROUP BY department` returning `[{ department, headcount, avgSalary }]`, sorted by headcount desc.
4. If the aggregate's `count === 0` → `NotFoundError("COUNTRY_NOT_FOUND")` → middleware maps to `404`.
5. Otherwise the service assembles the response (including `currency` from `COUNTRIES[country].currency`) and returns it.

Both queries hit `idx_employees_country`. Two queries instead of one is the price for a clean per-department breakdown; both are sub-millisecond at 10k rows.

### Role-in-country insights

1. `GET /api/insights/country/:country/job-title?title=...` arrives.
2. Controller validates `country` (whitelist) and `title` (non-empty, trimmed string).
3. Service calls `InsightsRepository.aggregateByCountryAndRole(country, title)` — same select list as `aggregateByCountry`, filtered by `country = ? AND jobTitle = ? COLLATE NOCASE`. Uses `idx_employees_country_jobTitle_nocase`.
4. `count === 0` → `NotFoundError("ROLE_NOT_FOUND")` → `404`.
5. Otherwise → assembled response with `currency` from `COUNTRIES` and `jobTitle` echoed back from the request (preserves the picker's chosen display casing).

### Job-titles picker

1. `GET /api/insights/country/:country/job-titles` arrives.
2. Controller validates the country.
3. Service calls `InsightsRepository.distinctJobTitles(country)` — `SELECT MIN(jobTitle) FROM employees WHERE country = ? GROUP BY LOWER(jobTitle) ORDER BY LOWER(jobTitle)`. The `MIN` picks a deterministic display casing per role.
4. Empty country returns `[]` — **not** a 404. The picker handles an empty list itself (disabled state).
5. Returns a plain JSON array of title strings. No envelope.

## 7. Seed Script

1. Read `data/first_names.txt` and `data/last_names.txt` into in-memory arrays.
2. Open the SQLite file. Apply pragmas: `journal_mode = WAL`, `synchronous = NORMAL`.
3. Prepare one `INSERT` statement.
4. Wrap 10,000 inserts in a single transaction (`db.transaction(...)`) — one fsync instead of 10,000.
5. Inside the loop: pick first/last/jobTitle/department/country from bounded pools; generate salary in a per-title range.

**Idempotent:** `--reset` truncates `employees` first.

Bypasses Kysely — for a 10k-row bulk insert, the prepared-statement + single-transaction pattern is cleanest against the raw driver.

## 8. UI Surfaces

Two pages, kept minimal.

### Frontend conventions

The goal is *modern and minimal with no distractions* — the data is the interface, the chrome stays out of the way.

- **Component sourcing.** MUI first. Reach for a custom component only when MUI doesn't have one — and when you do, build it from MUI primitives (`Box`, `Stack`, `Typography`) rather than raw HTML + CSS.
- **Layout & spacing.** Use MUI's 8px spacing scale via the `sx` prop (`sx={{ p: 2, gap: 1 }}`). No raw pixel values, no ad-hoc margins. Page content is centered in a `<Container maxWidth="lg">`; vertical rhythm comes from `<Stack spacing>`.
- **Typography.** Only MUI variants (`h4`, `h6`, `body1`, `body2`, `caption`). No custom font sizes or weights. One `h4` per page as the title.
- **Color.** Default MUI light theme. Color carries meaning only — `error` for destructive actions and validation, `primary` for the main CTA per view. No decorative color.
- **State coverage.** Every async surface renders three states explicitly: loading (MUI `<Skeleton>` or `<CircularProgress>`), empty ("No employees yet"), and error (inline `<Alert severity="error">`). No silent spinners, no blank screens.
- **No decoration.** No icons unless they replace text in a button (`<DeleteIcon>` in a row action). No shadows, gradients, or borders beyond MUI defaults. White space does the separating.

**Employees page** (`/`)
- MUI `<DataGrid>` in server-side mode (pagination, sort, filter, search). Visible columns: full name, country, salary, hire date. Salary formatted using each row's country → currency.
- "Add Employee" button → modal form.
- Row actions: **view** (read-only details modal showing every field — the canvas FR-3 edit and FR-4 delete will later extend), edit (modal form), delete (confirm dialog).
- Form validates client-side with Zod via `react-hook-form` before submit. The country dropdown is driven by `shared/countries.ts`; selecting a country reveals the currency code next to the salary input (e.g. "Salary (INR)").

**Insights page** (`/insights`)
- A Country selector and a Role selector sit side-by-side at the top. Role is disabled until a country is picked, defaults to "All roles", and resets to "All roles" whenever the country changes.
- When Role is "All roles": shows the country card — salary card (mean headline, min/max captions, visual range bar) + headcount / avg tenure / new-hires-12mo stat cards + departments breakdown table.
- When a specific Role is picked: same four cards refresh with role-filtered data, the departments table disappears, and the salary card gains a comparison-to-country delta line (e.g. "+24% vs all roles in India").
- The visual range bar (a 1-line track with a marker at mean) is the one allowed non-textual primitive on this page — it conveys distribution shape without a chart library.
- Plain numeric display elsewhere — no charts.

Top-level navigation: MUI `<AppBar>` with two tabs.

## 9. Error Handling

- All thrown errors funnel through a single Express error middleware.
- Internal taxonomy: `ValidationError`, `NotFoundError`, `ConflictError`, `InternalError`. Each maps to a fixed HTTP status and the `{ error: { code, message } }` shape.
- Driver-specific errors (e.g., `SQLITE_CONSTRAINT_UNIQUE` from `better-sqlite3` — Kysely re-throws them unchanged) are caught in the repository layer and rethrown as `ConflictError`. Services and controllers never see SQLite error codes.
- Stack traces are logged but never returned to the client.

## 10. Testing Strategy

TDD. Each backend layer is tested in isolation by mocking the layer below it; repositories run against `:memory:` SQLite. See [CLAUDE.md](../CLAUDE.md) for the full rules.

**Frontend:**
- Smoke test: employee list renders rows from a mocked API.
- Form test: add-employee form validates and submits to the mocked API.
- Insights page renders metrics from a mocked API.

## 11. Build & Deploy

**Local dev:**
- `npm run dev` at root → backend on `:3000` (`ts-node-dev`), Vite dev server on `:5173` with a proxy to `/api`.

**Local prod-image run:**
- `docker compose up` runs the same image Render serves, on `:3000`. `SEED_ON_EMPTY=1` by default; `SEED_ON_EMPTY=0 docker compose up` for empty-state UX. Data is ephemeral; `docker compose down && docker compose up` resets and re-seeds.

**Docker build (multi-stage):**
1. **builder:** `npm ci`; build `shared/`, `frontend/` (Vite), `backend/` (`tsc`).
2. **runtime:** copy `backend/dist`, `frontend/dist`, `backend/migrations/`, minimal `node_modules` (including the prebuilt `better-sqlite3` native binary). `CMD ["node", "backend/dist/server.js"]`.

**Container start:**
1. Open the SQLite file; the app's `migrate()` runner applies any pending `migrations/*.sql` files inside a transaction.
1b. If `SEED_ON_EMPTY=1` and the `employees` table is empty, the in-process seed inserts 10k rows.
2. Start Express on `:3000`.
3. Express serves `/api/*` from routes and everything else from `frontend/dist` with SPA fallback.

**Hosting:** Render web service, `env: docker`, free tier, no persistent disk. The container's filesystem is ephemeral; data added through the UI is lost on cold start (Render free spins down after ~15 min idle), and the seed-on-empty hook restores 10k demo rows on the next request. Cold-start latency: ~20-25s (container boot + migrate + seed); warm requests <100ms.

**Upgrade to real persistence:** add a `disk:` block to `render.yaml` (mount at `/data`, 1 GB) and bump the plan to `starter`. `DATABASE_PATH=/data/app.db` already points at the mount. No code change needed.

---

**Companion documents:**
- [PRD](./prd.md) — product requirements.
- [Decisions](./decisions.md) — the key calls and why.
