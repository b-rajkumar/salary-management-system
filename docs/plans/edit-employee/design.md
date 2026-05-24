# FR-3 — Update Employee (Design)

**Date:** 2026-05-24
**Status:** Draft — pending user review
**Slice:** Third vertical slice. Adds editing on top of FR-1 (Add) and FR-2 (View). Unifies the previously separate Add and View dialogs into one `EmployeeDialog` component with three modes (create / view / edit).

Companion to [PRD §5 FR-3](../../prd.md) and [Engineering Design](../../engineering-design.md). This document is the **FR-3 cut** of those.

The PRD says HR can "edit any field." This slice lands that with two field-specific guards — **country** auto-clears salary (because salary's currency comes from country, and changing country silently re-interprets the number), and **hireDate** carries an inline note ("edit only to correct a typo") because there is no audit log.

---

## 1. Scope

### In scope

- **Backend update endpoint.** `PUT /api/employees/:id` accepts the same body shape as `POST /api/employees`. Returns the updated row including a fresh server-set `updatedAt`. Adds `update` methods to `EmployeesRepository`, `EmployeesService`, `EmployeesController`.
- **Unified `EmployeeDialog`.** Replaces today's `AddEmployeeFormDialog` and `EmployeeDetailsModal`. Three modes:
  - `create` — empty form, Cancel/Save footer, dialog closes on success.
  - `view` — label-value rows showing all fields, Close/Edit footer.
  - `edit` — same form as create, prefilled, Cancel/Save footer; Save PUTs and transitions back to view; Cancel reverts to view with original values.
- **Country-change guard.** In edit mode, changing the country selection auto-clears the salary input and shows an inline helper text ("Salary cleared — re-enter in EUR"). Zod's salary-required rule blocks Save until salary is re-entered.
- **HireDate inline note.** Static grey helper text under the hire-date input in edit mode: "Edit only to correct a typo — hire date is a historical record." No save-time confirmation.
- **No-op guard.** Save button is disabled while the form is pristine (RHF `formState.isDirty === false`). Change-and-revert leaves the form pristine; the button stays disabled.
- **`updatedAt` maintenance.** Repository sets `updatedAt = new Date().toISOString()` on every update. View mode displays it alongside `createdAt`.

### Out of scope (matches CLAUDE.md YAGNI)

- **Audit log / change history.** No "previous values" tracking, no salary-history table. `updatedAt` is the only modification signal.
- **Optimistic concurrency.** No `If-Match`/ETag, no version columns. Single-trusted-operator assumption holds.
- **Per-field PATCH.** The endpoint takes the full body; partial updates aren't a need at this scale.
- **Locked fields.** Every field is editable. The two risky ones (country, hireDate) get guards, not locks.
- **Delete (FR-4).** Separate slice. The "Edit" button is the only mutation surface added in this slice.

---

## 2. API contract

```
PUT /api/employees/:id
  body: same as POST /api/employees (employeeCreateSchema)

200 → Employee (full updated row, including fresh updatedAt)
400 → { error: { code: "VALIDATION_ERROR", ... } }    bad body or non-integer :id
404 → { error: { code: "NOT_FOUND" } }                no row with that id
409 → { error: { code: "EMAIL_TAKEN" } }              email belongs to a different row
```

- `:id` is parsed via Zod (`z.coerce.number().int().positive()`). Non-integer or non-positive → `400`.
- Body validation reuses `employeeCreateSchema` exactly. No `EmployeeUpdateInput`-specific schema; the two shapes are deliberately identical today.
- Self-email is not a conflict: `UPDATE employees SET email='x' WHERE id=N` doesn't violate the `UNIQUE` constraint when row `N` already holds `email='x'`. No special-casing needed.
- `updatedAt` is generated server-side (`new Date().toISOString()`) and is **not** read from the request body even if present.

---

## 3. Shared package

`shared/src/types.ts` gains:

```ts
export type EmployeeUpdateInput = EmployeeCreateInput;
```

A type alias rather than a duplicated interface — the shape is the same as create today. The named alias makes the contract explicit and gives a place to diverge later (e.g., if we ever add a field that's set-once-at-create).

No new Zod schema. `employeeCreateSchema` in `shared/src/schemas.ts` is reused by the controller and by the dialog in edit mode.

---

## 4. Backend

### Layering (per CLAUDE.md)

- **`EmployeesRepository.update(id, input)`** — Kysely `updateTable('employees').set({ ...input, updatedAt }).where('id', '=', id).returningAll().executeTakeFirst()`. Returns the updated row or `undefined` if no row matched. Catches `SQLITE_CONSTRAINT_UNIQUE` from `better-sqlite3` and rethrows `ConflictError('EMAIL_TAKEN')`. Other driver errors propagate.
- **`EmployeesService.update(id, input)`** — calls the repository. If the repository returns `undefined`, throws `NotFoundError`. `ConflictError` propagates unchanged.
- **`EmployeesController.update(req, res)`** — parses `req.params.id` and `req.body` through Zod, calls the service, returns `200` with the updated row. `ValidationError`, `NotFoundError`, `ConflictError` are mapped to HTTP by the existing error middleware.

### Route registration

`backend/src/routes/employees.ts` gains:

```ts
router.put('/:id', controller.update);
```

No other route changes. The controller class binds `this` as already done for `create` and `list`.

### updatedAt detail

`updatedAt` is currently set only by the `DEFAULT (CURRENT_TIMESTAMP)` clause at insert. After this slice, every successful update overwrites it. ISO-8601 in JS for parity with the rest of the codebase (we never read SQLite's `CURRENT_TIMESTAMP` format anywhere).

---

## 5. Frontend

### Dialog state machine

The single `EmployeeDialog` component is opened from `EmployeesPage` via one of two intents:

```ts
type DialogState =
  | { intent: 'create' }
  | { intent: 'inspect'; employee: Employee }
  | null;
```

When `intent === 'create'`, the dialog opens directly in edit mode with empty initial values.

When `intent === 'inspect'`, the dialog opens in `view` mode with the passed employee. Inside the dialog, a local `formMode: boolean` flips view ↔ edit. The flips never close the dialog.

```
                ┌──────────────┐
   row View ──→ │  view mode   │ ─── Edit ───┐
                │ (label rows) │             ▼
                │ Close / Edit │       ┌──────────────┐
                └──────────────┘       │  edit mode   │
                       ▲               │ (form inputs)│
                       │               │ Cancel / Save│
                       └─── Cancel ────└──────────────┘
                       └─── Save ok ───┘
                                       │
                                       └─ ✕ / backdrop ─→ dialog closes
```

### Field rendering

- **View mode** renders 8 label-value rows plus a divider plus `createdAt` and `updatedAt`. Country shows `IN — India`. Salary uses the existing `SalaryCell` formatter (Intl.NumberFormat keyed to the country's currency). HireDate is locale-formatted (`15 Jan 2024`).
- **Edit mode** renders the same `react-hook-form` inputs as today's create form, with two layered behaviors described below.

### Country-change guard

A `useEffect` watches the country form value. When it differs from `initialValues.country`:

```ts
setValue('salary', '', { shouldDirty: true });
setHelperText('salary', `Salary cleared — re-enter in ${COUNTRIES[country].currency}.`);
```

If HR sets country back to the original, the helper text clears, but the salary field stays empty (HR has to fill it in or revert via Cancel). Zod's `salary > 0` rule blocks Save until they do.

### HireDate inline note

A static `FormHelperText` under the date input in edit mode:

> Edit only to correct a typo — hire date is a historical record.

Always shown in edit mode; not conditional on value diff.

### No-op guard

```ts
<Button type="submit" disabled={!formState.isDirty}>Save</Button>
```

RHF compares current values to `defaultValues` (which we set to `initialValues` on open). Change-and-revert leaves the form pristine and Save stays disabled.

### Close behavior

| Mode | Cancel | ✕ / backdrop / Esc |
|---|---|---|
| create | dialog closes | dialog closes |
| view | n/a (no Cancel button) | dialog closes |
| edit | revert form → view mode | dialog closes |

No mid-edit warning on ✕ — matches the single-trusted-operator assumption and the FR-1 dialog's existing behavior.

### Save handlers

- `intent === 'create'` → `createEmployee(values)` → on success: dialog closes, `useEmployeesList.refresh()`, success snackbar "Employee added."
- `intent === 'inspect'` + edit mode → `updateEmployee(employee.id, values)` → on success: dialog transitions to view mode with the response, `useEmployeesList.refresh()`, success snackbar "Employee updated."

### Errors

- `409 EMAIL_TAKEN` → inline error on the email field, dialog stays in edit mode (same surface as FR-1).
- `404 NOT_FOUND` → dialog closes, snackbar "Employee not found — it may have been deleted." Grid refreshes.
- Other failures → snackbar "Could not save changes. Try again." Dialog stays in edit mode so HR doesn't lose input.

### API client

`frontend/src/api/employees.ts` gains:

```ts
export async function updateEmployee(id: number, input: EmployeeUpdateInput): Promise<Employee>;
```

PUT to `/api/employees/${id}`, same JSON envelope handling and error mapping as `createEmployee`.

---

## 6. Testing

TDD as always — red → green → refactor, tests in the same commit as the implementation.

### Backend

- `repositories/EmployeesRepository.test.ts` (extend) — `update` block:
  - updates and returns the full row with a fresh `updatedAt`
  - `updatedAt` is strictly greater than `createdAt` after update
  - returns `undefined` for a non-existent id
  - throws `ConflictError('EMAIL_TAKEN')` when the new email belongs to a different row
  - does **not** throw when the email is unchanged on the same row
- `services/EmployeesService.test.ts` (extend) — `update` block:
  - delegates to the repository and returns the updated row
  - throws `NotFoundError` when the repository returns `undefined`
  - propagates `ConflictError` unchanged
- `controllers/employees.update.test.ts` (new) — Supertest with mocked service:
  - `200` with the updated employee on valid input
  - `400` on Zod failure (missing field, bad date, salary < 0, unknown country)
  - `400` on non-integer `:id`
  - `404` mapped from `NotFoundError`
  - `409` with `{ code: 'EMAIL_TAKEN' }` mapped from `ConflictError`

### Frontend (RTL)

- `api/employees.test.ts` (extend) — `updateEmployee(id, input)` PUTs to the right URL and parses the response.
- `components/EmployeeDialog.test.tsx` (new — replaces today's `AddEmployeeFormDialog.test.tsx` and `EmployeeDetailsModal.test.tsx`):
  - **view mode**: renders all fields from the passed employee; shows Close + Edit; no inputs visible.
  - **view → edit**: Edit reveals prefilled inputs.
  - **edit → view (Cancel)**: original values restored.
  - **edit → view (Save)**: PUT called with form values; on success, view mode shows the response.
  - **country change clears salary**: changing country empties salary and shows the `"re-enter in [code]"` helper.
  - **country change back to original**: helper clears; salary stays empty.
  - **hireDate inline note**: always shown in edit mode.
  - **Save disabled while pristine**: no PUT fires if HR opens edit and clicks Save without changes (and Save is disabled to prevent the click).
  - **409 email**: inline error on email; stays in edit mode.
  - **create mode**: empty inputs; Save calls POST; dialog closes.
- `pages/EmployeesPage.test.tsx` (extend) — row View opens the dialog in view mode; successful update refreshes the grid; `404` closes the dialog and shows a snackbar.

### Playwright live-browser verification

Per CLAUDE.md "Verifying UI changes":

1. **FR-1 regression** — Add an employee, confirm it lands in the grid.
2. **View** — click a row, dialog opens with correct data.
3. **Edit-and-save** — Edit → change first name → Save → view mode shows new name → grid row reflects new name.
4. **Country guard** — Edit → change country → observe salary auto-cleared, helper shows new currency code → enter salary → Save → success.
5. **409** — Edit → change email to one held by another row → Save → inline error on email; dialog stays in edit mode.
6. **Cancel** — Edit → change values → Cancel → values restored, view mode.
7. **Pristine guard** — Edit (no changes) → confirm Save button is disabled.

---

## 7. Open questions

None. All resolved in brainstorming:

- **Editable fields:** all 8 (hybrid guards model).
- **Audit log:** explicitly not added.
- **Edit placement:** inside the unified dialog, no row-level shortcut.
- **Country guard:** auto-clear salary with inline helper.
- **HireDate guard:** soft inline note only.
- **Add vs Edit component:** unified `EmployeeDialog` absorbs both.
- **No-op guard:** Save disabled while pristine.

---

## 8. Doc updates landing with this slice

Per CLAUDE.md "Keeping the docs in sync" — confirm wording before editing:

- **`docs/prd.md` §5 FR-3** — expand from "edit any field" to mention the two guards and the unified dialog UX.
- **`docs/engineering-design.md` §5** — document the `PUT /api/employees/:id` contract and the `updatedAt` server-side maintenance rule.
- **`docs/decisions.md`** — new entry: "Country change clears salary on edit" with the rationale.
- **`README.md`** — move FR-3 from "Deferred" to "Shipped"; describe the unified dialog.
