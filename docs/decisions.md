# Decisions

**No auth.** Skipping the auth sectoin as this is an assignment where the main focus is on the core functionality

**Single `employees` table.** Real HR systems split department, country, and job title into reference tables, track salary history, and keep an audit log. Skipped here — the gaps are called out in the PRD instead of being half-built.

**MUI for the UI.** The 10k-row table is the hard part of the frontend. DataGrid handles virtualized scroll and server-side paging, sort, and filter out of the box. 

**Per-country currency.** Salary is stored as a whole number in the local currency of the employee's country. The country to currency mapping lives as a frozen map in `shared/` — derived at display time, never stored on the employee row. No FX conversion anywhere; what HR enters is what gets aggregated and shown.

**better-sqlite3 with kysely.** For this particular application I am going with better-sqlite3 and kysely for forming queries.

**Country change in the edit form clears the salary field.** When HR changes an employee's country in the edit dialog, the salary input is auto-cleared and an inline helper prompts HR to re-enter the value in the new currency. Salary is stored in the employee's local currency (derived from the country); a country change silently re-interprets the same number in a different currency, which is the highest-risk edit available without an audit log. Forcing re-entry trades a small amount of friction for an unambiguous data record. The alternative — a yellow warning that leaves the value in place — relies on HR noticing, which is the failure mode we are designing against.