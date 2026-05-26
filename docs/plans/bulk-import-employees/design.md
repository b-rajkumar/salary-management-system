# FR-7 — Bulk Import Employees from CSV (Design)

**Date:** 2026-05-26
**Status:** Draft — pending user review
**Slice:** New feature. Adds one endpoint, one dialog, one shared schema. Builds on the FR-1 add-employee surface — reuses the same validation schema and error envelope.

Companion to [PRD §4–5](../../prd.md) (which currently lists bulk import as out of scope — this design promotes it to FR-7 and the doc updates land in the same commit as the code) and [Engineering Design §5](../../engineering-design.md).

---

## 1. Scope

### In scope

- **One new endpoint** — `POST /api/employees/bulk` accepts up to 500 employees in one call, all-or-nothing.
- **Shared schema** — `bulkCreateEmployeesSchema` wraps the existing `employeeCreateSchema` in an array, used by both apps.
- **One new dialog** — `ImportEmployeesModal` on the Employees page, sitting next to the existing **Add Employee** button.
- **CSV template download** — a static `employees-template.csv` served from `frontend/public/`, surfaced as a link in the dialog so HR doesn't guess the format.
- **Doc updates** in the same commit: PRD §4–5 (move bulk import from out-of-scope to FR-7), `engineering-design.md` §5–6 (new endpoint + request flow), `decisions.md` (one new entry locking in the all-or-nothing call).

### Deferred / not in this slice

- **Bulk update or delete.** Only create.
- **XLSX support.** CSV only. HR is told to "export as CSV" in the dialog helper text.
- **Async / background import.** The 500-row cap is set precisely so we don't need it — the whole insert finishes inside a single HTTP round-trip in well under a second.
- **Per-row "skip and continue" semantics.** All-or-nothing was deliberately chosen ([§9](#9-decisions-recorded)).
- **Idempotency keys.** Single trusted operator (PRD §7); a repeated identical upload is just a dup-email rejection.

---

## 2. Validation rules

Per-row rules are exactly the rules in [add-employee/design.md §2](../add-employee/design.md#2-validation-rules) — same `employeeCreateSchema`, no divergence. Bulk-only rules layer on top:

| Constraint | Rule | Where enforced |
|---|---|---|
| `employees` array length | 1–500 | Zod (controller) + matching FE check before upload |
| Request body byte size | ≤ 3 MB | Express body-parser, mounted **on this route only** (default global limit is unchanged) |
| Source file byte size (FE) | ≤ 2 MB | FE before parsing |
| In-file dup email (case-insensitive) | rejected, all participating rows flagged | Service layer (Layer B) |
| In-DB dup email | rejected, all colliding rows flagged | Service layer (Layer C); UNIQUE index is the final guard |

Email normalization (lowercase + trim) is applied before both dup checks and before the insert. A first-written test against `findExistingEmails(['ASHA@x.com'])` is the parity check against the existing single-create path — if the existing path doesn't normalize, that's a pre-existing gap fixed in the same PR.

---

## 3. API contract

### Request — `POST /api/employees/bulk`

```jsonc
{
  "employees": [
    {
      "firstName": "Asha", "lastName": "Rao",
      "email": "asha@example.com",
      "jobTitle": "Software Engineer", "department": "Engineering",
      "country": "IN", "salary": 1500000, "hireDate": "2024-03-12"
    }
    // … up to 500
  ]
}
```

Each element has exactly the shape of `EmployeeCreateInput` (the FR-1 body type). No extra fields. No `csvRow` bookkeeping — the API stays CSV-agnostic; the FE handles `index → "row N"` translation.

### Success — `201`

```json
{ "inserted": 412 }
```

No row payload. The FE refetches the grid right after; insertion-order default (`id DESC`) puts the new rows on page 1.

### Errors — uniform `{ error: { code, message, details? } }` envelope

`details.errors: BulkErrorItem[]` where each item is `{ index, field, message }`. `index` is the 0-based position in the request's `employees[]` array.

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod failure — body shape, array length 0 or > 500, any per-row format error |
| `IN_FILE_DUPLICATE_EMAIL` | 400 | Two or more rows in the payload share an email (case-insensitive) |
| `EMAIL_TAKEN` | 409 | One or more rows collide with an existing DB row's email |
| `INTERNAL_ERROR` | 500 | Repository-layer unexpected failure (transaction rolled back) |

Sample `IN_FILE_DUPLICATE_EMAIL` response — note both colliding rows are flagged, not just one:

```jsonc
{
  "error": {
    "code": "IN_FILE_DUPLICATE_EMAIL",
    "message": "Import rejected: 2 rows share an email with another row in the file",
    "details": {
      "errors": [
        { "index": 4,  "field": "email", "message": "Duplicate within file: asha@example.com" },
        { "index": 17, "field": "email", "message": "Duplicate within file: asha@example.com" }
      ]
    }
  }
}
```

---

## 4. Shared package

Additions only — no breaking changes to existing types.

```
shared/src/types.ts        # + BulkCreateEmployeesRequest, BulkCreateEmployeesResponse, BulkErrorItem
shared/src/schemas.ts      # + bulkCreateEmployeesSchema
```

```ts
// schemas.ts (additions)
export const bulkCreateEmployeesSchema = z.object({
  employees: z.array(employeeCreateSchema).min(1).max(500),
});

// types.ts (additions)
export interface BulkCreateEmployeesRequest {
  employees: EmployeeCreateInput[];
}

export interface BulkCreateEmployeesResponse {
  inserted: number;
}

export interface BulkErrorItem {
  index: number;
  field: string;
  message: string;
}
```

One schema, two consumers — the FE pre-validates every parsed row against it before calling the API, and the BE controller validates again defensively. No drift possible.

---

## 5. Backend

### Layering — Controller → Service → Repository

Per CLAUDE.md and the existing add-employee structure. Four layers of checks, ordered from cheapest to most expensive; if a layer has errors, later layers do not run.

```
A. Controller (Zod) ──── body shape + per-row format
B. Service (pure)   ──── in-file duplicate email
C. Service (DB read)──── in-DB duplicate email (single SELECT … WHERE email IN (...))
D. Repository (DB write) one multi-row INSERT, implicitly atomic in SQLite
```

### Method-level contracts

- **`EmployeesRepository.findExistingEmails(emails: string[]): Promise<string[]>`**
  Single Kysely query: `selectFrom('employees').select('email').where('email', 'in', emails)`. Returns the subset of inputs that already exist. Hits the `email` UNIQUE index directly.

- **`EmployeesRepository.insertMany(rows: EmployeeCreateInput[]): Promise<number>`**
  Single `insertInto('employees').values([...]).execute()`, generating one multi-row INSERT. Returns the inserted count. Catches `SQLITE_CONSTRAINT_UNIQUE` and rethrows as `ConflictError("EMAIL_TAKEN")` — the safety net even though Layer C should prevent it. SQLite's multi-row INSERT is atomic by statement, so no explicit `db.transaction(...)` wrapper.

- **`EmployeesService.createBulk(inputs: EmployeeCreateInput[]): Promise<{ inserted: number }>`**
  1. Normalize each email (`.trim().toLowerCase()`).
  2. Detect in-file dups; if any → throw `ValidationError("IN_FILE_DUPLICATE_EMAIL", offenders)`.
  3. Call `findExistingEmails`; if any → throw `ConflictError("EMAIL_TAKEN", offenders)`.
  4. Call `insertMany`; return `{ inserted: count }`.

- **`EmployeesController.createBulk`**
  Parses body through `bulkCreateEmployeesSchema`. On Zod failure, builds `BulkErrorItem[]` from `error.issues` (path[0] → field, path[1] → ignored for now since employee rows are flat) and throws `ValidationError`. On success, calls the service, returns `201 { inserted }`.

### Error middleware change

`ValidationError` and `ConflictError` are extended to optionally carry `BulkErrorItem[]`; the middleware writes them through as `details.errors`. The existing single-create path doesn't pass this field and is unaffected. No new error class needed.

### Body size limit (route-scoped)

```ts
router.post(
  '/employees/bulk',
  express.json({ limit: '3mb' }),
  employeesController.createBulk
);
```

Mounted **only** on this route. The global JSON body limit stays at its default.

### Query cost — full audit at 500 rows

| Layer | Queries | Notes |
|---|---|---|
| A (Zod) | 0 | Pure CPU |
| B (in-file dup) | 0 | Pure CPU |
| C (in-DB pre-check) | 1 | `SELECT email FROM employees WHERE email IN (?,?,…)` — 500 params (well under SQLite's 32,766 cap), indexed |
| D (insert) | 1 | One multi-row INSERT — 4,000 params (500 rows × 8 cols), implicitly atomic |
| **Happy path total** | **2** | Both sub-millisecond at 10k rows |

### Files created / changed

```
backend/src/repositories/EmployeesRepository.ts   # + findExistingEmails, + insertMany
backend/src/services/EmployeesService.ts          # + createBulk, + findInFileDuplicates helper
backend/src/controllers/EmployeesController.ts    # + createBulk
backend/src/routes/index.ts                       # + POST /employees/bulk with route-scoped body limit
backend/src/lib/errors.ts                         # extend ValidationError/ConflictError to carry BulkErrorItem[]
backend/src/lib/errorMiddleware.ts                # write details.errors through

backend/tests/repositories/EmployeesRepository.test.ts   # + findExistingEmails, + insertMany cases
backend/tests/services/EmployeesService.test.ts          # + createBulk cases (Layer B/C ordering, normalization, happy path)
backend/tests/controllers/EmployeesController.test.ts    # + createBulk cases (Zod, body limit, error pass-through)
backend/tests/integration/bulk-import.test.ts            # full-stack supertest (real :memory: SQLite)
```

---

## 6. Frontend

Follows engineering-design §8 frontend conventions: MUI-only, default light theme, `sx` 8px scale, explicit loading/empty/error states.

### Entry point

The Employees page header gets a second button alongside **Add Employee**:

```
[ Add Employee ]  [ Import CSV ]
```

Both are `<Button variant="contained">`; the import one might switch to `variant="outlined"` so the primary CTA stays the single-create path (most-frequent action).

### `<ImportEmployeesModal>` — state machine

```
idle ─── file chosen ──▶ parsing ─── PapaParse OK ──▶ validating ─── all rows valid ──▶ ready
  ▲                          │                            │                              │
  │                          │                            │                              │ click Import
  │                          ▼                            ▼                              ▼
  │                     fe-errors                     fe-errors                      uploading
  │                  (size / malformed)             (per-row Zod)                        │
  │                          │                            │                201 ───┐     │ 400/409
  │                          │                            │                       ▼     ▼
  └──"Choose a different file"──────────────────────────────────────────         success    be-errors
                                                                                  (close, toast,
                                                                                   refetch)
```

`fe-errors` and `be-errors` both render the **same** error table component, sourced from `BulkErrorItem[]`. HR sees one consistent failure surface regardless of which layer caught the problem.

### Parse step — PapaParse

```ts
Papa.parse<RawCsvRow>(file, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => h.trim(),
  complete: (result) => { /* check headers, coerce salary to number, hand off to validateRows */ },
});
```

Parse-level failures surface inline before any Zod runs:

| Problem | Message |
|---|---|
| Missing required header column | `Missing column: salary. Download the template for the expected format.` |
| Extra / unknown column | `Unknown column: currency. Currency is derived from country — remove this column.` |
| Unparseable as CSV | `Could not parse file as CSV. Make sure it was exported as CSV (not XLSX).` |
| 0 data rows | `File has no data rows.` |
| > 500 data rows | `Too many rows ({n}). Maximum is 500 per import — split the file.` |
| File size > 2 MB | `File is too large ({size}). Maximum is 2 MB.` (checked before parsing) |

### Validation step

`validateRows(rows: RawCsvRow[]): BulkErrorItem[]` runs every row through `employeeCreateSchema.safeParse`, collecting one `BulkErrorItem` per Zod issue with `index` and `field` set. `coerceRow` does one transformation upstream: `salary` string → number (every other field is left as a trimmed string; the schema handles further coercion or rejection).

### Error table — same surface for FE + BE failures

```
Import failed — 4 errors in 3 rows. Fix and re-upload.

┌──────┬──────────┬───────────────────────────────────────────┐
│ Row  │ Field    │ Problem                                   │
├──────┼──────────┼───────────────────────────────────────────┤
│  6   │ email    │ Invalid email                             │
│  6   │ salary   │ Expected non-negative integer             │
│ 19   │ country  │ Unsupported country code: "INDIA"         │
│ 24   │ email    │ Duplicate within file: asha@example.com   │
└──────┴──────────┴───────────────────────────────────────────┘

[ Download CSV template ]                [ Choose a different file ]
```

`Row = index + 2` (header is row 1, data starts at row 2). Truncate at 500 rendered errors with a `… and N more` footer for catastrophically broken files.

### CSV template

`frontend/public/employees-template.csv` — a one-row, headers-only file matching the exact expected schema:

```
firstName,lastName,email,jobTitle,department,country,salary,hireDate
Asha,Rao,asha@example.com,Software Engineer,Engineering,IN,1500000,2024-03-12
```

Served at `/employees-template.csv`. The "Download CSV template" links to it directly (`<Link href="/employees-template.csv" download>`); no API endpoint.

### `api/employees.ts` addition

```ts
bulkCreateEmployees(payload: BulkCreateEmployeesRequest): Promise<BulkCreateEmployeesResponse>
```

On non-2xx, parses `{ error: { code, message, details } }` and throws `ApiError` carrying `details.errors: BulkErrorItem[]` so the dialog renders the same table without string-parsing.

### Files created / changed

```
frontend/public/employees-template.csv                    # new — static template
frontend/src/components/ImportEmployeesModal.tsx         # new — the dialog + state machine
frontend/src/components/BulkErrorTable.tsx                # new — shared error rendering
frontend/src/lib/parseCsv.ts                              # new — PapaParse wrapper + header checks
frontend/src/lib/validateBulkRows.ts                      # new — Zod loop over rows
frontend/src/api/employees.ts                             # + bulkCreateEmployees
frontend/src/pages/EmployeesPage.tsx                      # + Import CSV button, wires the dialog
frontend/package.json                                     # + papaparse, + @types/papaparse

frontend/src/lib/parseCsv.test.ts                         # new
frontend/src/lib/validateBulkRows.test.ts                 # new
frontend/src/components/BulkErrorTable.test.tsx           # new
frontend/src/components/ImportEmployeesModal.test.tsx    # new
```

---

## 7. Tests

TDD per CLAUDE.md — every test fails first, lives in the same commit (or the commit immediately before) as the code under it, mocks live at layer boundaries.

### Backend

**`EmployeesRepository.test.ts`** — real `:memory:` SQLite:
- `findExistingEmails` returns `[]` for empty input
- `findExistingEmails` returns `[]` when no input emails exist in the DB
- `findExistingEmails` returns the subset of input emails that exist
- `findExistingEmails(['ASHA@x.com'])` against a stored `asha@x.com` row — the **email-normalization parity test**; reveals whether the single-create path lowercases on write
- `insertMany` inserts every row and returns the count
- `insertMany` stamps `createdAt` and `updatedAt` with the same ISO string on every row in the batch
- `insertMany` rolls back the whole batch when one row violates the email unique constraint (sanity check on SQLite multi-row atomicity)
- `insertMany` rethrows `SQLITE_CONSTRAINT_UNIQUE` as `ConflictError("EMAIL_TAKEN")`

**`EmployeesService.test.ts`** — repo mocked:
- `createBulk` throws `ValidationError("IN_FILE_DUPLICATE_EMAIL")` with all participating row indices when two rows share an email (case-insensitive)
- `createBulk` skips Layer C (does NOT call `findExistingEmails`) when Layer B fails
- `createBulk` calls `findExistingEmails` with normalized lowercased emails
- `createBulk` throws `ConflictError("EMAIL_TAKEN")` with the row indices of every row whose email already exists
- `createBulk` skips `insertMany` when Layer C reports any collision
- `createBulk` normalizes (lowercase + trim) email before both checks AND before insert
- `createBulk` happy path returns `{ inserted: <count> }`

**`EmployeesController.test.ts`** — service mocked, supertest:
- `POST /api/employees/bulk` rejects a body without `employees` key with `400 VALIDATION_ERROR`
- rejects an empty `employees` array with `400`
- rejects > 500 employees with `400`
- rejects a row missing a required field with `400` and surfaces the offending index + field
- rejects a row with malformed email / negative salary / unknown country code with `400`, one `BulkErrorItem` per Zod issue
- does NOT call `service.createBulk` when Zod fails
- on a valid body, calls `service.createBulk` and returns `201 { inserted }`
- maps service `ValidationError` to `400` with `details.errors` echoed through
- maps service `ConflictError("EMAIL_TAKEN")` to `409` with `details.errors`
- rejects a body > 3 MB with `413` from the body parser (single test confirming the route-scoped limit)

**`backend/tests/integration/bulk-import.test.ts`** — full stack, real `:memory:` SQLite:
- inserts 50 valid employees and they appear in `GET /api/employees`
- rejects with `409` when one row collides with an existing DB row, and no rows from the batch are inserted (count before / count after)
- rejects with `400` when two rows in the batch share an email, and no rows are inserted

The "no rows inserted" assertions on the failure paths are the all-or-nothing guarantee tested end-to-end.

### Frontend

**`parseCsv.test.ts`**:
- accepts a well-formed CSV and returns trimmed-header rows
- rejects a missing required column with a header-specific message
- rejects an unknown extra column
- rejects a file > 2 MB before parsing
- rejects a CSV with 0 data rows
- rejects a CSV with > 500 data rows

**`validateBulkRows.test.ts`**:
- returns `[]` for a well-formed batch
- returns one `BulkErrorItem` per Zod issue, with `index` and `field` populated
- output shape matches `BulkErrorItem` from `@app/shared` (compile-time + one snapshot)

**`BulkErrorTable.test.tsx`**:
- renders one row per `BulkErrorItem` with `Row = index + 2`
- shows the summary header with the right error/row counts
- truncates at 500 rows with `… and N more` footer

**`ImportEmployeesModal.test.tsx`**:
- idle state when first opened
- size > 2 MB rejected inline before parsing
- missing-header CSV → clear inline message, API not called
- > 500-row CSV → clear inline message, API not called
- all-rows-valid CSV → row count + enabled Import button
- any-row-invalid CSV → error table, API not called
- on Import click, calls `bulkCreateEmployees` with `{ employees: [...] }`
- on `201`, closes dialog, fires success toast (`"412 employees imported"`), triggers grid refetch via callback
- on `400 IN_FILE_DUPLICATE_EMAIL`, renders error table from `details.errors`
- on `409 EMAIL_TAKEN`, renders the same error table the same way
- "Choose a different file" returns to idle

### Live browser verification

Per CLAUDE.md "Verifying UI changes" — covered by the implementing agent via the Playwright MCP browser tools before the slice is declared shippable. Minimum scenarios:

1. **Happy path** — upload a 5-row valid CSV, see toast, see new rows on page 1 of the grid.
2. **FE format failure** — upload a CSV with one bad email, see the inline error table, confirm no network request fired.
3. **BE duplicate failure** — upload a CSV where one email already exists in the seeded DB, see the inline error table from the API response, confirm no rows inserted (page 1 unchanged).

---

## 8. Doc updates landing in the same commit

- **`prd.md` §4 In scope** — add bullet: *"Bulk-import up to 500 employees from a CSV file in a single all-or-nothing upload."*
- **`prd.md` §4 Out of scope** — remove the existing *"Bulk import/export (CSV, Excel) through the UI"* bullet (replaced by the in-scope entry above; XLSX stays out of scope as part of FR-7's scoping notes rather than a separate bullet).
- **`prd.md` §5** — add **FR-7 Bulk import employees from CSV** between FR-6 and §6, describing the dialog, all-or-nothing semantics, error table, 500-row cap, and that the source CSV's exact headers match the API field names.
- **`engineering-design.md` §5 API Design** — add a row to the Employees table for `POST /api/employees/bulk` and a `Bulk import` subsection documenting the request/response shapes from §3 of this design.
- **`engineering-design.md` §6 Request flows** — add a `Bulk create` flow describing the four layers from §5 of this design.
- **`decisions.md`** — one new entry: *"Bulk CSV import is all-or-nothing."* with the rationale (see §9 below).
- **`CLAUDE.md`** — remove *"Bulk import/export endpoints"* from the YAGNI rules list (it is now an in-scope endpoint).

---

## 9. Decisions recorded

To land in `decisions.md` as part of this slice:

**Bulk CSV import (FR-7) is all-or-nothing.** A CSV upload either inserts every row or inserts none. The alternative — insert valid rows, skip duplicates with a warning — was rejected because it silently discards HR's intent: if the CSV row is the corrected version of an existing record, "skip the duplicate" preserves the stale row without telling HR which they got. Forcing HR to fix the CSV (or use `PUT /api/employees/:id` to update an existing record) keeps the data record unambiguous. The trade-off is that one bad row blocks the whole upload; mitigated by returning every row-level error in one response so HR can fix them in a single re-upload. Matches the same posture as the "country change clears salary" decision: when the data semantics are ambiguous, force a deliberate action rather than silently doing the wrong thing.

---

## 10. Out of scope reminders

The PRD and decisions doc already settle these; restating so the implementing engineer doesn't drift:

- No auth, no rate limiting, no audit log — including for bulk import (single trusted operator per PRD §7).
- No XLSX, no Google Sheets, no drag-and-drop from Excel. CSV file only.
- No partial-success semantics — see §9.
- No bulk update or bulk delete. Only bulk create.
- No async / job-queue / progress-bar import. 500-row cap makes it synchronous.
- No FX conversion — `salary` is still an integer in the country's currency, derived from `country` via `shared/countries.ts`.

---

**Next:** writing-plans skill turns this into `docs/plans/bulk-import-employees/plan.md` (used by the implementing agents, not committed).
