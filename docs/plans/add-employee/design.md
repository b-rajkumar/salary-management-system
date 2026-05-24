# FR-1 — Add an Employee (Design)

**Date:** 2026-05-24
**Status:** Draft — pending user review
**Slice:** First vertical slice of the system. Includes the repo skeleton FR-2 through FR-6 will build on.

Companion to [PRD §5 FR-1](../../prd.md) and [Engineering Design](../../engineering-design.md). This document is the **FR-1 cut** of those — what we ship now, what we explicitly defer.

---

## 1. Scope

### In scope

- **Repo scaffold.** npm workspaces (`backend`, `frontend`, `shared`), TS configs, ESLint/Prettier minimal, root scripts (`dev`, `test`, `build`).
- **Shared package.** `Employee` and `EmployeeCreateInput` types, `COUNTRIES` frozen map (5 entries — US, IN, GB, DE, JP — enough to demonstrate currency variance), and `employeeCreateSchema` (Zod, shared between client and server).
- **Backend.** `migrate()` runner + `001_init.sql` (full schema with both indexes — schema lives in one migration), `db/types.ts` + `db/client.ts`, error taxonomy + Express middleware, `EmployeesRepository.insert` / `EmployeesService.create` / `EmployeesController.create`, route wiring for `POST /api/employees`, tests per layer.
- **Frontend.** Vite + React + MUI `<ThemeProvider>` (default light theme), `<AppBar>` with two tabs, Employees page (header + status `<Alert>` slot + Add button + body placeholder), `<AddEmployeeModal>` with `react-hook-form` + the shared Zod schema, `<FormField>` wrapper, typed `api/employees.ts` fetch wrapper.
- **End-to-end verification.** Playwright suite covering the happy path, the duplicate-email inline error, and client-side validation blocking submit.

### Deferred to later slices

- `<DataGrid>` + `GET /api/employees` (FR-2).
- Update / delete employee (FR-3 / FR-4).
- Insights endpoints + page (FR-5 / FR-6).
- Seed script (lands with FR-2 or the seed-focused slice).
- Docker multi-stage build + Render deploy (final slice).

---

## 2. Validation rules

Locked during brainstorming:

| Field | Rule |
|---|---|
| firstName, lastName | required, trimmed, 1–100 chars |
| email | required, RFC email, ≤254 chars, **unique** (enforced by SQLite UNIQUE constraint + 409 surfaced inline) |
| jobTitle, department | required, trimmed, 1–100 chars |
| country | required, must be a key in `COUNTRIES` |
| salary | required integer, `>= 1`, no upper bound |
| hireDate | required ISO date `YYYY-MM-DD`, `<= today` (no future-dated joins) |

Email uniqueness is verified server-side only — no client pre-check endpoint. The `409` response maps to a field-level error on the modal's email input.

---

## 3. Shared package

```
shared/src/types.ts        # Employee, EmployeeCreateInput
shared/src/countries.ts    # COUNTRIES frozen map (US, IN, GB, DE, JP)
shared/src/schemas.ts      # employeeCreateSchema (Zod)
```

```ts
// schemas.ts
export const employeeCreateSchema = z.object({
  firstName:  z.string().trim().min(1).max(100),
  lastName:   z.string().trim().min(1).max(100),
  email:      z.string().trim().email().max(254),
  jobTitle:   z.string().trim().min(1).max(100),
  department: z.string().trim().min(1).max(100),
  country:    z.enum(Object.keys(COUNTRIES) as [string, ...string[]]),
  salary:     z.number().int().min(1),
  hireDate:   z.string().date().refine(d => d <= todayISO()),
});
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
```

Both apps import from `@app/shared` (npm workspace). API-contract drift is a compile error.

---

## 4. Backend

### Layering (per CLAUDE.md)

- **`EmployeesRepository.insert(input) → Employee`** — Kysely `insertInto('employees').values(input).returningAll().executeTakeFirstOrThrow()`. Catches `SQLITE_CONSTRAINT_UNIQUE` on `email`, rethrows `ConflictError("EMAIL_TAKEN")`. The driver-specific error never escapes this layer.
- **`EmployeesService.create(input) → Employee`** — pass-through to the repository for FR-1. The layer exists so FR-3 (update) can grow it without controller churn.
- **`EmployeesController.create`** — parses request body through `employeeCreateSchema`, calls the service, returns `201` with the row. Validation failures throw `ValidationError(zodError.flatten())` which the middleware maps to a `400` with `details`.

### Error middleware

Maps the `AppError` taxonomy to `{ error: { code, message, details? } }`:

| Class | Status | Code |
|---|---|---|
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `NotFoundError` | 404 | provided by thrower |
| `ConflictError` | 409 | provided by thrower (`EMAIL_TAKEN` for FR-1) |
| `InternalError` / unknown | 500 | `INTERNAL_ERROR` |

Stack traces are logged but never returned.

### Files created

```
backend/migrations/001_init.sql
backend/src/db/types.ts
backend/src/db/client.ts
backend/src/lib/errors.ts
backend/src/lib/migrate.ts
backend/src/lib/errorMiddleware.ts
backend/src/repositories/EmployeesRepository.ts
backend/src/services/EmployeesService.ts
backend/src/controllers/EmployeesController.ts
backend/src/routes/index.ts
backend/src/server.ts
backend/tests/repositories/EmployeesRepository.test.ts
backend/tests/services/EmployeesService.test.ts
backend/tests/controllers/EmployeesController.test.ts
```

`001_init.sql` matches engineering-design §4 verbatim — both indexes included even though FR-1 doesn't query them.

---

## 5. Frontend

Follows engineering-design §8 "Frontend conventions": MUI-only, default light theme, `sx` 8px scale, MUI typography variants, explicit loading/empty/error states, no decoration.

### App shell

`<ThemeProvider>` → `<AppBar>` with two `<Tab>`s (`Employees` `/`, `Insights` `/insights`) → routed page inside `<Container maxWidth="lg">`.

### Employees page (`/`)

`<Stack spacing={3}>`:

1. `<Typography variant="h4">Employees</Typography>`
2. Status `<Alert>` slot — renders post-submit success/error; dismissible; empty by default.
3. `<Button variant="contained">Add Employee</Button>`
4. Body placeholder — `<Alert severity="info">List view arrives with the next slice.</Alert>`. This is the FR-1 empty state; FR-2 replaces it with `<DataGrid>`.

### Insights page (`/insights`)

Stub: `<Typography variant="body1">Coming with FR-5.</Typography>`. The tab exists so the AppBar reflects the real shape of the app.

### `<AddEmployeeModal>`

`<Dialog>` + `<DialogTitle>` + `<DialogContent>` with a `<Stack spacing={2}>` of `<FormField>` rows; `<DialogActions>` with Cancel + Submit. While pending, Submit shows `<CircularProgress size={16}>`. Salary field's `InputAdornment` shows the selected country's currency code (e.g. `INR`); no adornment when no country is selected.

### `<FormField>`

`<Controller>` + `<TextField fullWidth>` with `error={!!fieldState.error}` and `helperText={fieldState.error?.message}` wired through. One line per field in the modal — guarantees identical error display across fields.

### `api/employees.ts`

`createEmployee(input): Promise<Employee>` — typed `fetch` wrapper. On non-2xx, parses `{ error: { code, message } }` and throws `ApiError`.

### Submit flow

1. `react-hook-form` validates against `employeeCreateSchema` client-side.
2. Valid → `createEmployee(input)`.
3. `201` → close modal, set page `<Alert severity="success">Added {firstName} {lastName}</Alert>`.
4. `409 EMAIL_TAKEN` → `setError("email", { message: "Email already in use" })`, modal stays open.
5. Other errors (server `400` if a client bypass slips through, network failure) → inline `<Alert severity="error">` inside `<DialogContent>`.

### Files created

```
frontend/src/main.tsx
frontend/src/App.tsx
frontend/src/theme.ts
frontend/src/pages/EmployeesPage.tsx
frontend/src/pages/InsightsPage.tsx
frontend/src/components/AppShell.tsx
frontend/src/components/AddEmployeeModal.tsx
frontend/src/components/FormField.tsx
frontend/src/api/client.ts
frontend/src/api/employees.ts
```

---

## 6. Tests

### Backend (Jest + Supertest)

Per CLAUDE.md mock-at-boundaries.

- **`EmployeesRepository.test.ts`** — real `:memory:` SQLite + `migrate()`:
  - inserts a valid row and returns it with `id`, `createdAt`, `updatedAt`
  - rejects a second insert with the same email by throwing `ConflictError("EMAIL_TAKEN")`
- **`EmployeesService.test.ts`** — mocked repo:
  - calls `repo.insert` with the parsed input and returns the result
  - propagates `ConflictError` thrown by the repo
- **`EmployeesController.test.ts`** — supertest + mocked service:
  - `201` happy path returns the new employee
  - `400 VALIDATION_ERROR` for: missing required field, malformed email, unknown country code, `salary = 0`, `salary = -1`, future `hireDate`
  - `409 EMAIL_TAKEN` when the service throws `ConflictError`

### End-to-end (Playwright)

Playwright drives the real frontend against the real backend. RTL is intentionally not used in FR-1 — the same behavior is verified through the actual UI.

Playwright lives at `frontend/e2e/` with its own `playwright.config.ts`. The config's `webServer` block launches:
- the backend (`node backend/dist/server.js`) with a temp `DATABASE_PATH` (e.g. a path under `.playwright-tmp/`), schema applied by the in-app `migrate()` runner on startup
- Vite preview serving the built frontend, proxied to the backend

The DB file is recreated fresh before each Playwright run (via `globalSetup`). Within a run, specs use distinct emails so they don't interfere with each other; per-test resets aren't worth the complexity for three specs.

`frontend/e2e/add-employee.spec.ts`:

- **happy path** — open `/`, click Add Employee, fill the form (selecting "IN" reveals the `INR` adornment), submit; modal closes; page `<Alert severity="success">` shows "Added {First} {Last}".
- **duplicate email surfaces inline** — POST one employee through the API; open the form and submit a second create with the same email; the modal stays open and the email field's `helperText` reads "Email already in use".
- **client-side validation blocks submit** — open the form and click Submit immediately; each required field's `helperText` shows the validation message; no network request is fired (asserted via `page.route` interception).

---

## 7. Out of scope reminders

The PRD and decisions doc already settle these; restating so the implementing engineer doesn't drift:

- No auth, no rate limiting, no audit log.
- No FX conversion. `salary` is stored as an integer in the country's currency; currency is derived from `country` via `shared/countries.ts` and never stored on the row.
- No soft delete or salary history.
- No `<DataGrid>`, no list endpoint, no insights endpoints in this slice.
- No Docker, no Render deploy in this slice.

---

**Next:** writing-plans skill turns this into `docs/plans/add-employee/plan.md` (used by the implementing agents, not committed).
