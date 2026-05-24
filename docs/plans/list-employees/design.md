# FR-2 — View Employees (Design)

**Date:** 2026-05-24
**Status:** Draft — pending user review
**Slice:** Second vertical slice. Adds the 10k seed script and a paginated employee list.

Companion to [PRD §5 FR-2](../../prd.md) and [Engineering Design](../../engineering-design.md). This document is the **FR-2 MVP cut** of those — what we ship now, what we explicitly defer.

The PRD documents the eventual feature: paginated **and** sortable **and** searchable. This slice ships only the paginated part. Sort and search land in a follow-up slice once the pagination loop is proven against real volume.

---

## 1. Scope

### In scope

- **Seed script.** `backend/scripts/seed.ts` generates 10,000 employees from `data/first_names.txt` and `data/last_names.txt`, inserts them in a single transaction. `--reset` truncates the `employees` table first. `npm run seed --workspace backend`. Built first inside the slice so everything downstream is exercised at real volume.
- **Backend list endpoint.** `GET /api/employees?page&pageSize` → `{ rows: Employee[], total: number }`. Adds `list` methods to `EmployeesRepository`, `EmployeesService`, `EmployeesController`. Default sort is `id ASC` — insertion order, stable across pages, no UX claim attached.
- **Frontend list view.** Replaces the FR-1 placeholder on the Employees page with MUI `<DataGrid>` in server-side pagination mode. Salary cell formatted with `Intl.NumberFormat` using each row's `country → currency`.
- **Post-create refresh.** When the Add Employee modal succeeds, the grid refetches the current page so the new row shows up.

### Deferred to the next slice (`search-and-sort-employees`)

- `sortBy` / `sortDir` query params + per-column sort handles. Whitelist: `firstName`, `lastName`, `email`, `hireDate`. **Salary sort is permanently excluded** — raw cross-currency integer ordering is misleading (PRD §5 FR-2 reflects this).
- `q` search param + a debounced search input above the grid (`LIKE '%q%'` across firstName, lastName, email).

### Deferred to later slices (as already planned)

- Update / delete employee (FR-3, FR-4).
- Insights endpoints + page (FR-5, FR-6).
- Docker multi-stage build + Render deploy.

---

## 2. API contract

```
GET /api/employees
  ?page=0       (int, default 0, min 0)
  &pageSize=50  (int, default 50, min 1, max 200)

200 → { rows: Employee[], total: number }
400 → { error: { code: "VALIDATION_ERROR", ... } }   if page or pageSize is invalid
```

- Rows are ordered by `id ASC` (insertion order — stable across pages, no claim of HR-meaningful sort).
- Empty result: `200` with `{ rows: [], total: 0 }`. Never a `404`.
- `total` is the unfiltered `COUNT(*)` of the employees table for this slice (no filters exist yet).
- A single Zod schema in the controller coerces and validates both query params.

---

## 3. Shared package

`shared/src/types.ts` gains:

```ts
export interface EmployeesListResponse {
  rows: Employee[];
  total: number;
}
```

Both backend (return type of `EmployeesService.list`) and frontend (return type of `listEmployees`) import this. API-contract drift is a compile error.

---

## 4. Backend

### Layering (per CLAUDE.md)

- **`EmployeesRepository.list({ page, pageSize })`** — two Kysely queries:
  - `selectFrom('employees').selectAll().orderBy('id', 'asc').limit(pageSize).offset(page * pageSize).execute()`
  - `selectFrom('employees').select(db.fn.countAll<number>().as('total')).executeTakeFirstOrThrow()`
  Returns `{ rows, total }`. No driver-specific errors expected; no try/catch needed.
- **`EmployeesService.list(args)`** — pass-through to the repository for this slice. The layer stays so the next slice can grow it (sort whitelist enforcement, search predicate composition) without controller churn.
- **`EmployeesController.list(req, res)`** — parses the query string through the schema below, calls the service, returns `200` with `{ rows, total }`. Validation failures throw `ValidationError` and the existing middleware maps them to `400`.

### Query-param schema

Lives in the controller (HTTP-boundary concern, not shared with the frontend — the frontend constructs the URL, it doesn't validate the same shape).

```ts
const listQuerySchema = z.object({
  page:     z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
```

`z.coerce.number()` handles the fact that Express query params arrive as strings.

### Route wiring

`backend/src/routes/employees.ts` gains one line:

```ts
r.get('/', (req, res, next) => controller.list(req, res).catch(next));
```

### Files modified

```
backend/src/repositories/EmployeesRepository.ts  (add list)
backend/src/services/EmployeesService.ts         (add list)
backend/src/controllers/EmployeesController.ts   (add list + query schema)
backend/src/routes/employees.ts                  (add GET route)
backend/tests/repositories/EmployeesRepository.test.ts  (extend)
backend/tests/services/EmployeesService.test.ts         (extend)
backend/tests/controllers/EmployeesController.test.ts   (extend)
```

---

## 5. Seed script

### Runner

Add `tsx` as a backend devDep. Single binary, no config, executes TypeScript directly. Avoids the awkwardness of using `ts-node-dev` (a watch-mode tool) for one-off scripts.

`backend/package.json` gains `"seed": "tsx scripts/seed.ts"`.

### Files created

```
backend/scripts/seed.ts
data/first_names.txt          (~500-1000 entries, one per line)
data/last_names.txt           (~500-1000 entries, one per line)
backend/tests/scripts/seed.test.ts
```

Name files live at repo root per engineering-design §2.

### CLI

```
npm run seed --workspace backend                 # insert 10,000 on top of existing rows
npm run seed --workspace backend -- --reset      # DELETE FROM employees first, then insert 10,000
```

### Module shape

The script exports the work as a function so it's testable without spawning a child process:

```ts
export function seed(opts: { db: Database.Database; count: number; reset?: boolean }): { inserted: number; ms: number };
```

The CLI is a thin wrapper that opens the DB at the configured path, applies pragmas, runs `migrate()`, then calls `seed(...)`.

### Behavior

1. Parse `--reset` flag.
2. Open `Database(dbPath)` directly — bypass Kysely, per engineering-design §7.
3. Apply pragmas: `journal_mode = WAL`, `synchronous = NORMAL`.
4. Run `migrate()` — lets `rm app.db && npm run seed` work from scratch.
5. If `--reset`, `DELETE FROM employees`.
6. Read both name files into arrays.
7. Prepare one `INSERT INTO employees(...)` statement.
8. Wrap the loop in `db.transaction(...)`:
   - Pick `firstName` and `lastName` from the loaded arrays.
   - Pick `jobTitle` from a bounded 6-item pool: `Software Engineer`, `Senior Software Engineer`, `Engineering Manager`, `Product Manager`, `Designer`, `Data Scientist`.
   - Pick `department` from a 5-item pool: `Engineering`, `Product`, `Design`, `Data`, `Operations`.
   - Pick `country` from `Object.keys(COUNTRIES)` (`US`, `IN`, `GB`, `DE`, `JP`).
   - Compute `salary` from a per-title × per-country range table declared in the script — each cell is `[min, max]` integers in the country's local currency, picked manually to look plausible (e.g. Software Engineer × US: `[80000, 180000]`; Software Engineer × IN: `[800000, 3500000]`; Software Engineer × JP: `[5000000, 12000000]`). **Not derived from FX rates** — explicit table values, called out in a comment.
   - `email` = `${firstName}.${lastName}${i}@example.com`, lowercased, `i` appended to guarantee uniqueness at 10k.
   - `hireDate` = random `YYYY-MM-DD` within the last 10 years.
9. Log `Inserted ${count} employees in ${ms}ms`.

### Performance shape

One prepared statement reused across 10,000 iterations, one transaction → one fsync at commit. Engineering-design §7 calls this out as the goal; target on a modern laptop is sub-500ms.

---

## 6. Frontend

Follows engineering-design §8 conventions: MUI-only, default light theme, `sx` 8px scale, explicit loading/empty/error states.

### `api/employees.ts`

Adds:

```ts
export async function listEmployees(params: {
  page: number;
  pageSize: number;
}): Promise<EmployeesListResponse>
```

Builds the query string from `params`, calls the existing typed fetch wrapper.

### `useEmployeesList` hook

`frontend/src/hooks/useEmployeesList.ts` — a small hook owning the fetch and the refresh trigger:

```ts
export function useEmployeesList(page: number, pageSize: number): {
  data: EmployeesListResponse;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
};
```

Implementation: `useEffect` on `[page, pageSize, reloadKey]`; `refresh()` bumps `reloadKey`. Cancellation flag handles unmount during in-flight fetch.

Lives in a hook (not inline in the page) because the page already juggles modal state, alert state, and pagination state; isolating data-fetching keeps the page component readable. Also makes the fetch loop directly unit-testable in isolation.

### `EmployeesPage`

Replaces the FR-1 body placeholder with the grid:

```tsx
<Stack spacing={3}>
  <Typography variant="h4">Employees</Typography>
  {successAlert}

  <Stack direction="row" justifyContent="flex-end">
    <Button variant="contained" onClick={() => setModalOpen(true)}>
      Add Employee
    </Button>
  </Stack>

  {error && <Alert severity="error">{error}</Alert>}

  <Box sx={{ height: 640 }}>
    <DataGrid
      rows={data.rows}
      rowCount={data.total}
      columns={columns}
      paginationMode="server"
      paginationModel={{ page, pageSize }}
      onPaginationModelChange={(m) => { setPage(m.page); setPageSize(m.pageSize); }}
      pageSizeOptions={[25, 50, 100]}
      loading={isLoading}
      disableColumnFilter
      disableColumnSorting
      disableColumnMenu
      disableRowSelectionOnClick
    />
  </Box>
</Stack>
```

### Columns

In display order: `firstName`, `lastName`, `email`, `jobTitle`, `department`, `country`, `salary`, `hireDate`. `id` is omitted from the grid — surrogate key, no HR meaning. All columns get `sortable: false` for this slice.

- **`country`** displays `COUNTRIES[row.country].name` (e.g. "India"), not the raw `IN`. The underlying value stays as the ISO code.
- **`salary`** uses a `renderCell` that calls `Intl.NumberFormat` with the row's currency:
  ```ts
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: COUNTRIES[row.country].currency,
    maximumFractionDigits: 0,
  }).format(row.salary)
  ```
  Extracted into `frontend/src/components/SalaryCell.tsx` (~10 lines) to keep the column definitions tidy and the formatting testable in isolation.
- **`hireDate`** displays the ISO string as-is.

### Three explicit states

- **Loading:** `<DataGrid loading={isLoading}>` — built-in overlay. No separate skeleton.
- **Empty:** `data.rows.length === 0 && !isLoading` → DataGrid's default "No rows" overlay. Acceptable for an MVP; we don't customize.
- **Error:** `<Alert severity="error">` above the grid; the grid still renders (with whatever `data` was last fetched, or empty on first load).

### Post-create refresh

`<AddEmployeeModal onCreated={...}>` callback on the page calls `refresh()` (from the hook) in addition to setting the existing success alert. The grid re-fetches the current page and the new row appears.

### Files created / modified

```
shared/src/types.ts                              (add EmployeesListResponse + re-export)
frontend/src/api/employees.ts                    (add listEmployees)
frontend/src/hooks/useEmployeesList.ts           (NEW)
frontend/src/hooks/useEmployeesList.test.tsx     (NEW)
frontend/src/components/SalaryCell.tsx           (NEW)
frontend/src/components/SalaryCell.test.tsx      (NEW)
frontend/src/pages/EmployeesPage.tsx             (replace placeholder with grid + wire hook)
frontend/src/pages/EmployeesPage.test.tsx        (extend)
frontend/package.json                            (add @mui/x-data-grid — confirmed not yet installed)
```

---

## 7. Tests

### Backend (Jest + Supertest)

Per CLAUDE.md mock-at-boundaries.

- **`EmployeesRepository.test.ts` (extends FR-1)** — real `:memory:` SQLite + `migrate()`:
  - returns `{ rows: [], total: 0 }` against an empty table
  - inserts 60 rows; `list({ page: 0, pageSize: 25 })` returns rows 1-25 with `total: 60`
  - inserts 60 rows; `list({ page: 1, pageSize: 25 })` returns rows 26-50 with `total: 60`
  - inserts 60 rows; `list({ page: 2, pageSize: 25 })` returns the partial page 51-60 with `total: 60`
  - rows are ordered by `id ASC` and never overlap across pages
- **`EmployeesService.test.ts` (extends FR-1)** — mocked repository:
  - `list` forwards `{ page, pageSize }` to `repo.list` and returns the result unchanged
- **`EmployeesController.test.ts` (extends FR-1)** — supertest + mocked service:
  - `GET /api/employees` (no params) → `200`, service called with `{ page: 0, pageSize: 50 }`
  - `GET /api/employees?page=2&pageSize=20` → `200`, service called with `{ page: 2, pageSize: 20 }`
  - `GET /api/employees?page=-1` → `400 VALIDATION_ERROR`
  - `GET /api/employees?pageSize=0` → `400 VALIDATION_ERROR`
  - `GET /api/employees?pageSize=201` → `400 VALIDATION_ERROR`
  - `GET /api/employees?page=abc` → `400 VALIDATION_ERROR`
  - response body shape is `{ rows: [...], total: <number> }`

### Seed script (Jest)

- **`backend/tests/scripts/seed.test.ts`** — `:memory:` SQLite + `migrate()`:
  - `seed({ db, count: 100 })` inserts exactly 100 rows
  - all 100 `email` values are unique
  - all 100 `country` values are keys of `COUNTRIES`
  - all 100 `salary` values are integers `>= 1`
  - `seed({ db, count: 50, reset: true })` after a previous `seed({ count: 50 })` leaves exactly 50 rows (the reset took effect)

The test imports the `seed` function directly — no child-process spawning.

### Frontend (Jest + RTL)

- **`useEmployeesList.test.tsx`** — hook tested in isolation via `renderHook`:
  - fetches on mount and exposes `data`, `isLoading`, `error`
  - sets `error` when `listEmployees` throws
  - re-fetches when `page` changes
  - re-fetches when `refresh()` is called
- **`SalaryCell.test.tsx`**:
  - formats 1,500,000 with `country: "IN"` to a string containing the INR symbol or code
  - formats 100,000 with `country: "US"` to a string containing `$` or `USD`
- **`EmployeesPage.test.tsx` (extends FR-1)**:
  - renders the grid with rows from a mocked `listEmployees`
  - shows loading state on initial mount (grid loading overlay present)
  - shows the `<Alert>` when `listEmployees` rejects
  - clicking the next-page footer button calls `listEmployees` with `{ page: 1, ... }`
  - after the Add Employee modal calls `onCreated`, `listEmployees` is called again

### Live browser verification (Playwright MCP, per CLAUDE.md)

Performed by the controlling agent before declaring the slice shippable:

1. `rm backend/data/app.db*`, then `npm run seed --workspace backend -- --reset`.
2. Start backend + frontend in the background. Wait for both health endpoints.
3. Open `/`. Confirm the grid renders with rows and the footer reads `1–50 of 10000`.
4. Click "Next page". Confirm a different row set loads.
5. Find a known-country row (IN, JP) and confirm the salary cell renders with that country's currency.
6. Add a new employee through the modal. Confirm the success alert shows and the new row appears in the grid (refresh worked).

---

## 8. Scaling notes

Our 10k case sits comfortably in "no production tricks needed" territory. Worth recording the trade-offs in case the reviewer asks why we didn't reach for fancier patterns:

- **Pagination: offset, not keyset.** Stripe/GitHub/Linear use keyset (`WHERE id > $cursor`) because offset re-scans from the start every request and degrades at deep pages. At 10k rows with `pageSize=50`, the deepest offset is 9,950 — microseconds on SQLite. No reason to give up "jump to page N" or add cursor complexity.
- **Search: `LIKE '%q%'` (next slice), not FTS.** A full table scan over 10k rows with three OR'd `LIKE` clauses runs in single-digit milliseconds. SQLite FTS5 would be the upgrade path at ~100k+ rows. Beyond that: a dedicated search engine (Elasticsearch / Meilisearch / Typesense).
- **Count: two queries, not cached.** A second `SELECT COUNT(*)` on 10k rows is essentially free. At billions of rows the count is often the most expensive part of a list request — production systems then either skip the total ("Load more" UX) or denormalize counters into a separate table.
- **Sort (next slice): in-memory, indexes optional.** SQLite sorts 10k rows on any column in low single-digit milliseconds without an index. Indexes become mandatory in the high-100k range. Composite indexes start mattering when multi-column sort or sort-with-filter combinations appear.

The thresholds where each of these would actually need to change are roughly 100k for index pressure, 1M for offset pagination to start hurting, and 10M for keyset / dedicated search to become genuinely necessary — all well beyond this assignment.

---

## 9. Out of scope reminders

The PRD and decisions doc already settle these; restating so the implementing engineer doesn't drift:

- No auth, no rate limiting, no audit log.
- No FX conversion. Salary comparison across currencies happens only on the insights page (per-country, same currency); salary sort in the list is permanently excluded.
- No soft delete, no salary history.
- No row actions (edit/delete) in this slice — FR-3 / FR-4.
- No sort, search, or filter UI in this slice — sort and search ship in the follow-up slice; filters are not in the PRD.
- No Docker, no Render deploy in this slice.

---

**Next:** writing-plans skill turns this into `docs/plans/list-employees/plan.md` (used by the implementing agents, not committed — see `.gitignore`).
