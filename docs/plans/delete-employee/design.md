# FR-4 — Delete Employee (Design)

**Date:** 2026-05-24
**Status:** Draft — pending user review
**Slice:** Fourth vertical slice. Adds permanent deletion on top of FR-1 (Add), FR-2 (View), and FR-3 (Update). Introduces a row-level kebab menu that exposes View / Edit / Delete directly from the grid, and extends the unified `EmployeeDialog` view-mode footer with a `Delete` button.

Companion to [PRD §5 FR-4](../../prd.md) and [Engineering Design](../../engineering-design.md). This document is the **FR-4 cut** of those.

The PRD says HR can delete an employee, the system confirms, and deletion is permanent. There is no audit log and no undo (per CLAUDE.md YAGNI + PRD §7 Assumptions). The design's main job is to make accidental deletes unlikely while keeping the path fast.

---

## 1. Scope

### In scope

- **Backend delete endpoint.** `DELETE /api/employees/:id` returns `204 No Content` on success, `404 EMPLOYEE_NOT_FOUND` on unknown id, `400` on a malformed `:id` param. Adds `remove`/`delete` methods to `EmployeesController` / `EmployeesService` / `EmployeesRepository`.
- **Row-level kebab menu.** A `RowActions` cell renderer replaces today's single "View" button on each row of `EmployeesPage`'s `DataGrid`. The kebab opens a menu with three items: View, Edit, Delete (Delete separated, red).
- **Direct-to-edit entry point.** Selecting "Edit" from the kebab opens `EmployeeDialog` with `intent='inspect'` and starts directly in edit mode (skips view mode). This matches the user's explicit-action intent.
- **In-dialog Delete.** `EmployeeDialog`'s view-mode footer grows a third button: `Close | Delete (red) | Edit`. Edit-mode footer unchanged.
- **Confirm dialog.** A new `DeleteConfirmDialog` component is opened by both entry points (kebab Delete, dialog footer Delete). Shows `Delete <Name> (<email>, <country code>)? This cannot be undone.` Cancel autofocused. Delete button red, disables and shows spinner while the API call is in flight.
- **Snackbar feedback.** On success, an MUI `<Snackbar>` shows `Employee deleted` for ~4s. The grid refetches; if the deletion empties the current page and we are past page 0, the page index is decremented before refetch.
- **Idempotent 404.** If the delete returns `404 EMPLOYEE_NOT_FOUND` (race with another deletion, repeated click), the UI treats it as success: snackbar `Employee already deleted`, grid refetches.
- **Icon package.** Adds `@mui/icons-material` as a frontend dependency for the kebab trigger (`MoreVertIcon`), menu items (`VisibilityIcon`, `EditIcon`, `DeleteOutlineIcon`), and dialog footer `Delete` button icon.

### Out of scope (matches CLAUDE.md YAGNI)

- **Soft delete / restore.** No `deletedAt` column, no archive view. Per PRD §7: "Employee deletion is permanent."
- **Audit log.** Who deleted what is not recorded.
- **Bulk delete.** Each delete acts on one row. No multi-select.
- **Undo snackbar.** Considered and rejected — would require either soft-delete or a client-side stash + recreate flow.
- **Cascade considerations.** No FK references the `employees` table; nothing else needs to be cleaned up.

---

## 2. API contract

```
DELETE /api/employees/:id

204 → (no body)                                       success
400 → { error: { code: "VALIDATION_ERROR", ... } }    non-integer / non-positive :id
404 → { error: { code: "EMPLOYEE_NOT_FOUND" } }       no row with that id
```

- `:id` is parsed via the same `idParamSchema = z.object({ id: z.coerce.number().int().positive() })` introduced for `PUT` in FR-3.
- `204 No Content` is bodiless by HTTP spec; the existing `request<T>` helper on the frontend already handles empty bodies when `T = void`.
- No request body. No optimistic-concurrency header. Single-trusted-operator assumption (PRD §7) holds.

---

## 3. Shared package

No changes. No new types. The frontend `deleteEmployee(id: number): Promise<void>` doesn't need a shared payload or response type.

---

## 4. Backend

### Layering (per CLAUDE.md)

- **`EmployeesRepository.delete(id: number): Promise<boolean>`** — Kysely `deleteFrom('employees').where('id', '=', id).executeTakeFirst()`. Returns `true` if `numDeletedRows === 1`, `false` otherwise. No try/catch — there are no constraint translations needed for delete (no FKs into `employees`, no unique invariants triggered).
- **`EmployeesService.remove(id: number): Promise<void>`** — calls the repository. If the repository returns `false`, throws `NotFoundError('EMPLOYEE_NOT_FOUND', 'Employee <id> not found')` (with `<id>` interpolated). The service method is named `remove` because `delete` is a reserved word in JS/TS class methods.
- **`EmployeesController.remove(req, res)`** — parses `req.params.id` through `idParamSchema`, calls `service.remove`, responds with `res.status(204).send()`. No body. `ValidationError` and `NotFoundError` are mapped to HTTP by the existing error middleware.

### Route registration

`backend/src/routes/employees.ts` gains:

```ts
r.delete('/:id', (req, res, next) => {
  controller.remove(req, res).catch(next);
});
```

### Migrations

None. No schema change.

---

## 5. Frontend

### New components

**`frontend/src/components/RowActions.tsx`**

Cell renderer for the `actions` column. Props:

```ts
interface RowActionsProps {
  employee: Employee;
  onView: (e: Employee) => void;
  onEdit: (e: Employee) => void;
  onDelete: (e: Employee) => void;
}
```

Renders an `IconButton` with `MoreVertIcon`. Click opens an MUI `Menu` anchored to the button with three items: View (`VisibilityIcon`), Edit (`EditIcon`), divider, Delete (`DeleteOutlineIcon`, `color="error"`). Each `MenuItem` `onClick` calls the corresponding callback with `employee` and closes the menu.

**`frontend/src/components/DeleteConfirmDialog.tsx`**

Props:

```ts
interface DeleteConfirmDialogProps {
  open: boolean;
  employee: Employee | null;        // null when not opened
  onCancel: () => void;
  onConfirm: () => Promise<void>;   // page-level handler; returns once API resolves
}
```

Layout (MUI `Dialog`):

- `DialogTitle`: `Delete employee?`
- `DialogContent`:
  - Body line: `Delete <firstName> <lastName> (<email>, <country>)?`
  - Helper line (subtle): `This cannot be undone.`
  - Inline `<Alert severity="error">` slot for failure messages (mounted only when an error from `onConfirm` is set).
- `DialogActions`:
  - `Cancel` (autofocus)
  - `Delete` (`variant="contained"`, `color="error"`, `startIcon={<DeleteOutlineIcon />}`). Disabled and shows `<CircularProgress size={16} />` while the promise from `onConfirm` is in flight.

Internal state: `submitting: boolean`, `error: string | null`. On Delete click → `setSubmitting(true)` → `await onConfirm()` → page closes the dialog on success, or `catch` sets `error`. The page does not unmount the dialog on error (so the inline Alert is visible).

### New API client method

`frontend/src/api/employees.ts`:

```ts
export function deleteEmployee(id: number): Promise<void> {
  return request<void>(`/api/employees/${id}`, { method: 'DELETE' });
}
```

(The shared `request` helper is already written to handle a `204` response when the type parameter is `void`.)

### Changes to existing files

**`EmployeesPage.tsx`**

- Replace the `actions` column's existing single `View` button with `<RowActions>`. Wire callbacks:
  - `onView(e)` → `setDialogState({ intent: 'inspect', employee: e })` (existing behavior).
  - `onEdit(e)` → `setDialogState({ intent: 'inspect', employee: e, startInEditMode: true })` (new prop; see EmployeeDialog change below).
  - `onDelete(e)` → `setDeleteTarget(e)`.
- New state: `const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)` and `const [snackbar, setSnackbar] = useState<string | null>(null)`.
- Render `<DeleteConfirmDialog open={!!deleteTarget} employee={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleConfirmDelete} />`.
- `handleConfirmDelete`:
  ```ts
  async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmployee(deleteTarget.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setSnackbar('Employee already deleted');
      } else {
        throw err;       // DeleteConfirmDialog catches and shows inline
      }
    }
    setSnackbar((s) => s ?? 'Employee deleted');
    setDeleteTarget(null);
    if (dialogState?.intent === 'inspect' && dialogState.employee.id === deleteTarget.id) {
      setDialogState(null);
    }
    adjustPageIfLastRowOnPage();
    refetch();
  }
  ```
  `adjustPageIfLastRowOnPage`: if `rows.length === 1` and `paginationModel.page > 0`, decrement page before refetch.
- Render `<Snackbar open={!!snackbar} message={snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)} />`.

**`EmployeeDialog.tsx`**

- Extend the `inspect` variant of `Props`:
  ```ts
  | {
      open: boolean;
      intent: 'inspect';
      employee: Employee;
      startInEditMode?: boolean;     // new
      onClose: () => void;
      onSaved: (e: Employee) => void;
      onDelete: (e: Employee) => void;  // new
    }
  ```
- `InspectDialog` initializes its `mode` state from `startInEditMode ? 'edit' : 'view'`.
- View-mode footer becomes:
  ```tsx
  <DialogActions>
    <Button onClick={onClose}>Close</Button>
    <Box sx={{ flex: 1 }} />
    <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => onDelete(current)}>
      Delete
    </Button>
    <Button variant="contained" onClick={enterEdit}>Edit</Button>
  </DialogActions>
  ```
  Delete sits in the middle with a flex spacer to visually separate it from the affirmative actions. (Edit-mode footer unchanged: `Cancel | Save`.)
- The dialog itself does **not** own the confirm modal. `onDelete` is a page-level callback; the page coordinates close-dialog + open-confirm.

### Error handling (UI)

| Source | Where surfaced |
|---|---|
| `400 VALIDATION_ERROR` (bad id) | Should never happen — kebab and footer pass numeric ids from existing rows. Falls into the generic inline Alert if it does. |
| `404 EMPLOYEE_NOT_FOUND` | Treated as success at the page. Snackbar: `Employee already deleted`. |
| `409` / other `ApiError` | DeleteConfirmDialog's inline `<Alert severity="error">` with `err.message`. Dialog stays open, buttons re-enable. |
| Network / non-`ApiError` | Inline Alert with `Network error — please try again`. |

---

## 6. Testing

Per CLAUDE.md, TDD red→green for every test. No mocking what we own.

### Backend

- `EmployeesRepository` (`:memory:` DB):
  - `delete(id)` removes the row and returns `true`.
  - `delete(id)` returns `false` when no row matches.
- `EmployeesService` (real repo against `:memory:`):
  - `remove(id)` resolves when the row exists.
  - `remove(id)` throws `NotFoundError('EMPLOYEE_NOT_FOUND')` when it doesn't.
- `EmployeesController` (supertest against the app):
  - `204` on success.
  - `404` with `EMPLOYEE_NOT_FOUND` body on unknown id.
  - `400` with `VALIDATION_ERROR` body on non-numeric / non-positive id.
- `routes/employees`: DELETE route is wired (covered by the controller-level supertest).

### Frontend (Jest + RTL, jsdom)

- `api/employees.test.ts` — `deleteEmployee`:
  - issues `DELETE` to `/api/employees/:id`.
  - resolves on `204`.
  - throws `ApiError` on non-2xx with the parsed `{ code, message }`.
- `RowActions.test.tsx`:
  - kebab is rendered.
  - opening the menu reveals View, Edit, Delete items.
  - each item fires the corresponding callback with the employee and closes the menu.
- `DeleteConfirmDialog.test.tsx`:
  - renders name, email, country code from the employee prop.
  - Cancel fires `onCancel`.
  - Delete calls `onConfirm`; the button is disabled while the returned promise is pending.
  - if `onConfirm` rejects with an `ApiError`, an inline `<Alert>` with the message appears and buttons re-enable.
- `EmployeeDialog.test.tsx` (additions):
  - view-mode footer renders a Delete button; clicking fires `onDelete` with the current employee.
  - edit mode does **not** render a Delete button.
  - `startInEditMode: true` mounts the dialog directly in edit mode (form inputs visible, view layout not visible).
- `EmployeesPage.test.tsx` (additions):
  - kebab Delete on a row → confirm dialog opens with that row's name/email/country.
  - confirming → `deleteEmployee` called with the row id, snackbar `Employee deleted` shown, grid refetches.
  - 404 from the API → snackbar `Employee already deleted`, dialog still closes.
  - kebab Edit on a row → `EmployeeDialog` opens directly in edit mode (no view-mode flash).
  - dialog footer Delete (from a row already opened in view) → same confirm dialog opens; same success path; the underlying `EmployeeDialog` closes alongside the confirm.

### Playwright (per CLAUDE.md "Verifying UI changes")

1. Open kebab on a row → menu visible with three items.
2. Click Delete → confirm modal shows the row's name, email, country code.
3. Cancel → modal closes, row still present.
4. Re-open Delete → click Delete → snackbar appears, row gone from grid.
5. Open a row in View → click footer Delete → same confirm flow → row gone, both dialogs closed.
6. Kebab Edit on a row → `EmployeeDialog` opens directly in edit mode (form fields visible, no view layout).

---

## 7. Open questions

None at this point. Confirmation strength (simple modal), entry points (row kebab + dialog footer), confirm content (name + email + country), post-delete feedback (snackbar), icon pack availability (`@mui/icons-material` will be installed) all decided in brainstorming.

---

## 8. Doc updates landing with this slice

These edits to authoritative docs land in the same commit (or the commit immediately before) the code change, per CLAUDE.md. Each will be drafted and approved explicitly before being applied:

- **`docs/prd.md` §5 FR-4** — expand the two-line FR-4 entry to describe the kebab entry point, the in-dialog Delete, the confirm contents, and the snackbar. Note that deletion is permanent (no undo, no audit log) referencing §7.
- **`docs/engineering-design.md` §5** — add a `DELETE /api/employees/:id` contract paragraph mirroring the existing PUT one. §8 row-actions list to note the kebab menu and direct-to-edit behavior.
- **`docs/decisions.md`** — add an entry: "Hard delete with simple confirm." Why: PRD assumption + no audit log + single-trusted-operator. Alternatives considered (typed-confirm, undo) and rejected reasons (overkill / requires soft-delete).
- **`README.md`** — move FR-4 from "Deliberately deferred" to "Shipped." Update backend/frontend test counts.
