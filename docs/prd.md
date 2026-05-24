# Product Requirements Document — Salary Management System

**Date:** 2026-05-23
**Status:** Draft
**Owner:** Rajkumar Buddha

---

## 1. Goal

Provide an HR Manager with a minimal, usable web tool to manage employee records and surface salary insights for an organization of 10,000 employees.

## 2. Persona

**HR Manager.** Responsible for maintaining the employee directory and reviewing compensation data across countries and roles.

## 3. Problem

The HR Manager today lacks a single tool to keep employee records current and to answer common compensation questions ("what's the average salary for a Software Engineer in India?") without exporting spreadsheets. They need a focused, web-based tool with reliable data and fast lookups.

## 4. Scope

### In scope
- Manage employees through the UI:
  - Add a new employee.
  - View a paginated, sortable, searchable list of employees.
  - Update an existing employee's record.
  - Delete an employee.
- Salary insights through the UI, expressed in the country's local currency:
  - **Country view:** minimum, maximum, and average salary among employees in a selected country.
  - **Role-in-country view:** average salary for a selected job title within a selected country.
- A seed mechanism that populates the system with 10,000 realistic employee records so the tool can be evaluated at scale.

### Out of scope (deliberate)
- Authentication, authorization, and user management.
- FX conversion between currencies. Salaries are stored and reported in the local currency of the employee's country; no cross-currency aggregation.
- Salary history or compensation change tracking over time.
- Soft delete, audit trail, or change history.
- Manager / reporting hierarchy.
- Bulk import/export (CSV, Excel) through the UI.
- Metrics beyond the two listed above.

## 5. Functional Requirements

### FR-1 — Add an employee
The HR Manager can create a new employee record. The system requires: first name, last name, email (unique), job title, department, country, salary, and hire date. Salary is entered as a whole number in the local currency of the selected country (e.g. INR for India, USD for the United States) — the currency is derived from the country and displayed alongside the input, not entered separately. The system rejects records with missing required fields, an invalid email format, a duplicate email, an unsupported country, or a negative salary, and shows a clear error message in the UI.

### FR-2 — View employees
The HR Manager can see a list of employees showing the key fields at a glance — full name, country, salary, and hire date. Each row has a "View" action that opens a details popup with every field on the record (the natural canvas for FR-3 edit and FR-4 delete actions later). Recently added employees appear first by default — a freshly created row shows on page 1 without HR having to navigate. The list supports:
- Pagination across the full dataset.
- Sorting by name, email, and hire date.
- Free-text search across name and email.

### FR-3 — Update an employee
The HR Manager can edit any field on an existing employee record. The same validation rules as FR-1 apply.

### FR-4 — Delete an employee
The HR Manager can delete an employee record. The system confirms the action before deleting. Deletion is permanent (see "Assumptions").

### FR-5 — Country salary insights
The HR Manager can select a country and see the minimum, maximum, and average salary of employees in that country, expressed in that country's local currency. If the country has no employees, the system says so.

### FR-6 — Role-in-country salary insights
The HR Manager can select a country and a job title and see the average salary for that role in that country, expressed in that country's local currency. If no matching employees exist, the system says so.

## 6. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | The employee list is virtualized server-side so 10,000 records do not block render or scroll. The grid only ever holds one page in memory. |
| NFR-2 | The seed uses a single-transaction bulk insert so engineers can re-run it without friction during development. |
| NFR-3 | The two insights endpoints are served by indexes on `country` and `(country, jobTitle)`, not full table scans. |
| NFR-4 | The system is deployable as a single artifact and accessible at a public URL for evaluation. |
| NFR-5 | Backend tests run fast enough for TDD's inner loop — every test uses `:memory:` SQLite, no file I/O, no network. |

## 7. Assumptions

- **Salary is stored in the country's local currency.** The currency is determined by the employee's country, not chosen separately. No FX conversion happens anywhere — what you enter is what you see and what aggregates are computed against.
- **One currency per country** for the purposes of this tool. Edge cases (expats on foreign-currency contracts) are not modeled.
- **The deployed instance is accessed by a single trusted operator.** No per-user auth, no rate limiting, no audit log.
- **Countries are identified by ISO 3166-1 alpha-2 codes** (`US`, `IN`, `GB`) and currencies by ISO 4217 alpha-3 (`USD`, `INR`, `GBP`). The country → currency mapping lives in a shared reference module.
- **Job titles and departments are free text** in the same form HR enters them, not normalized into reference tables.
- **Employee deletion is permanent.**

## 8. Success Criteria

- Every functional requirement (FR-1 through FR-6) is demonstrably working in the deployed app.
- Seed mechanism populates 10,000 employees and is re-runnable.
- Backend test suite is green and runs in the TDD inner loop without friction.
- README explains how to run, the key assumptions, and what would be added in a production version.

---

**Companion documents:**
- [Engineering Design](./engineering-design.md) — *how* this will be built (stack, architecture, data model, API, deployment).
- [Decisions](./decisions.md) — the key calls and why.
