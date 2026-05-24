# CLAUDE.md

Project-specific guidance for Claude Code (and any AI coding assistant) working in this repository.

## What this project is

A salary management web tool for an HR Manager of a 10,000-employee organization. CRUD employees, plus two salary insights (min/max/avg by country; avg by job title in a country). Salary is stored in the employee's local currency, derived from the country via a frozen reference map in `shared/` — no FX conversion anywhere.

**Authoritative docs (read these first when planning a change):**
- [`docs/prd.md`](./docs/prd.md) — product requirements, scope boundaries, assumptions.
- [`docs/engineering-design.md`](./docs/engineering-design.md) — stack, architecture, data model, API, deployment.
- [`docs/decisions.md`](./docs/decisions.md) — the key calls and why.

## Stack at a glance

- **Backend:** Node.js + Express + TypeScript, `better-sqlite3` (synchronous SQLite driver) with **Kysely** (type-safe SQL builder, no ORM), Zod validation, Jest + Supertest.
- **Migrations:** plain SQL files in `backend/migrations/*.sql` applied by a tiny in-app runner on startup.
- **DB types:** the schema is declared once as a TypeScript interface in `backend/src/db/types.ts`; Kysely uses it to type every query.
- **Seed script:** same `better-sqlite3` driver, prepared statement inside a single transaction (bypasses Kysely — bulk inserts are cleanest against the raw driver).
- **Frontend:** Vite + React + TypeScript, MUI (including `<DataGrid>`), `react-hook-form` + Zod, Jest + React Testing Library.
- **Shared types:** `shared/` workspace package consumed by both apps (API response shapes + the country → currency map).
- **Monorepo:** npm workspaces, flat `backend/` + `frontend/` + `shared/` layout.

## Development discipline — Test-Driven Development (required)

**Every code change follows the red → green → refactor loop. No exceptions.**

1. **Red.** Write a failing test that captures the next slice of behavior. Run it. Confirm it fails for the right reason.
2. **Green.** Write the minimum implementation that makes the test pass. Do not add code that isn't covered by a test.
3. **Refactor.** With the test green, improve naming, structure, and clarity. Re-run the suite.

**Why this matters here:** TDD produces a meaningful test suite as a side effect of how the code is built, keeps services testable by construction (no after-the-fact test plumbing), and forces the contract to be designed before the implementation.

**Concrete rules:**
- **Never write a controller, service, or repository method before the test that calls it.** If you find yourself writing implementation first, stop and write the test.
- **Tests in the same commit as the implementation they cover** — or in the prior commit. Never lag tests behind code.
- **Failing test first, always.** A passing test on the first run is suspect — it likely doesn't actually exercise the new behavior.
- **One behavior per test.** Test names describe the behavior in plain English: `creates an employee with valid input`, `rejects a duplicate email with 409`.
- **No mocking what you own.** Use a real `:memory:` SQLite for service tests (`new Database(':memory:')` + run `migrate()`), not a mocked DB. Mocks of internal code rot and lie.
- **No tests for trivial code** (getters, type aliases). YAGNI applies to tests too.

## Code conventions

- **Layering (backend):** Controller → Service → Repository.
  - **Controllers** (`backend/src/controllers/`) handle HTTP + Zod validation only. They parse the request, call a service, shape the response. No business logic. Class names end in `Controller` (e.g. `EmployeesController`).
  - **Services** (`backend/src/services/`) own business logic and orchestration. They call repositories. Services never import from Express and never touch the DB directly. Class names end in `Service`.
  - **Repositories** (`backend/src/repositories/`) own all DB access. Every query lives here as a Kysely query against the typed schema interface. The driver (`better-sqlite3`) is only referenced from the Kysely client setup in `backend/src/db/client.ts`. Class names end in `Repository`.
- **Organization is by-layer**, not by-feature. One file per resource per layer.
- **Validation at the boundary:** every external input (HTTP body, query string, URL params) goes through a Zod schema in the controller before reaching a service. Internal functions trust their inputs.
- **Errors:** throw typed `AppError` subclasses (`ValidationError`, `NotFoundError`, `ConflictError`). A single Express error middleware maps them to HTTP responses. Driver-specific errors (e.g. `SQLITE_CONSTRAINT_UNIQUE` from `better-sqlite3`) are caught inside the repository and rethrown as `AppError`. Services and controllers never see SQLite error codes.
- **No comments explaining *what* code does** — well-named identifiers do that. Comments are reserved for *why* something non-obvious is happening (a workaround, a constraint, a subtle invariant).
- **Small files, focused modules.** When a file starts juggling concerns, split it.
- **Shared types live in `shared/`.** Both apps import from there. No type duplication.

## YAGNI rules for this codebase

The PRD is deliberately trimmed. Do not add:
- Authentication, sessions, user accounts, RBAC.
- Soft delete, audit log, `deletedAt` columns.
- Salary history, compensation change tracking.
- FX conversion, exchange-rate lookups, or a `currency` column on `employees` — currency is derived from `country` via `shared/countries.ts`, not stored per row.
- Departments or job titles as separate normalized tables. (Countries already have a reference map in `shared/`; do not promote it into a SQL table.)
- Bulk import/export endpoints.
- Metrics beyond the two specified in the PRD.
- Feature flags, environment toggles for features not requested.
- Error fallbacks or validation for scenarios that can't happen (internal callers trust internal callers).

If a change would add any of the above, stop and ask before proceeding.

## When in doubt

- Check the PRD before adding a feature.
- Check `decisions.md` before second-guessing a stack choice.
- Check `engineering-design.md` before introducing a new layer or boundary.
- Ask before making any change that touches scope, the schema, or the deployment story.

## Keeping the docs in sync

The docs (`prd.md`, `engineering-design.md`, `decisions.md`) are the contract code is built against — they are not write-once artifacts. Any change that contradicts what those docs describe must update them in the same commit (or the commit immediately before).

**Never edit a doc without explicit confirmation first.** Before touching `prd.md`, `engineering-design.md`, or `decisions.md`, state what you intend to change (which file, which section, what the new wording is or what gets removed) and wait for me to approve. This applies whether the edit is a one-line fix, a section rewrite, or a sync-up driven by a code change. The docs are how my thinking is communicated to the reviewer; I want to control their shape.

Concretely, when a change in code or stack lands, the typical doc impact is:
- **Adding a new endpoint, field, or screen** → update `prd.md` §4–5 and `engineering-design.md` §4–5.
- **Adding a layer, library, or boundary** → update `engineering-design.md` §1–3 and add a `decisions.md` entry.
- **Changing the stack, tooling, or DB schema** → update `engineering-design.md` §1 and §4 and the relevant `decisions.md` entry.
- **Reversing or rewording a prior decision** → rewrite the `decisions.md` entry; don't leave the old one as a contradicting footnote.

If a code change makes a sentence in any doc no longer true, that sentence is your problem to flag (and, once approved, to fix) in the same change. Drifted docs are worse than no docs.

## Style

Code style for this repo is documented in [`docs/style-guide.md`](./docs/style-guide.md). The mechanically-enforceable parts (notably the blank-line rule inside functions) are enforced by `npm run lint` / `npm run lint:fix`. Read the style guide before writing new code in this project; defer to it for naming, types, imports, errors, classes, and tests.

## Verifying UI changes

For any frontend change, don't stop at unit tests. Drive the running app in a real browser using the **Playwright MCP browser tools** and verify the user-facing flow:

1. Start the backend with a fresh DB and run it in the background:
   ```
   rm -f backend/data/app.db* && npm run dev --workspace backend
   ```
2. Start the frontend in the background: `npm run dev --workspace frontend`.
3. Wait for both: `curl -fsS http://localhost:3000/api/health` and `curl -fsS http://localhost:5173`.
4. Use the Playwright MCP tools to navigate, fill forms, click buttons, and snapshot the page after each interaction:
   - `mcp__plugin_playwright_playwright__browser_navigate`
   - `mcp__plugin_playwright_playwright__browser_snapshot`
   - `mcp__plugin_playwright_playwright__browser_click`
   - `mcp__plugin_playwright_playwright__browser_fill_form`
   - `mcp__plugin_playwright_playwright__browser_type`
5. Cover the golden path and the failure paths (validation errors, server-side errors like 409 duplicate). For a form, the minimum is: empty submit blocks with inline errors, valid submit succeeds, an expected server error surfaces inline.
6. Kill the background processes when done.

Type-checking and tests verify *code* correctness; the browser drive verifies *feature* correctness. Both are required for UI work.

## Committing changes

**Never commit without explicit confirmation.** Stage the changes, show the diff or a summary of what's about to land, and wait for me to say "commit" (or equivalent) before running `git commit`. This applies regardless of how routine the change looks — small commits, large commits, doc-only commits, all of them. The commit history is part of what's being evaluated, so I want to control its shape.
