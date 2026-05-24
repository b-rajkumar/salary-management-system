# FR-5 — Country Salary Insights (Design)

**Date:** 2026-05-24
**Status:** Draft — pending user review
**Slice:** First insights slice. Adds the country-view endpoint and the Insights page's country card. FR-6 (role-in-country) lands in a follow-up slice (`insights-role`).

Companion to [PRD §5 FR-5](../../prd.md) and [Engineering Design §5–§6](../../engineering-design.md). This document is the **FR-5 cut** — what we ship now, what we explicitly defer.

The PRD documents both insights flows. This slice ships **only the country view** (FR-5) plus the page scaffold the FR-6 slice will extend. The job-title picker endpoint (`/job-titles`) and the role-in-country endpoint (`/job-title`) are part of FR-6 and **out of scope here**.

---

## 1. Scope

### In scope

- **Backend insight endpoint.** `GET /api/insights/country/:country` → country aggregate + department breakdown. Adds `InsightsController`, `InsightsService`, `InsightsRepository`, and the route wiring under `/api/insights`. Validation via Zod at the controller boundary.
- **Aggregate query.** One SQL statement returning count, min, max, mean, avg tenure years, and new hires in the last 12 months.
- **Department query.** A second SQL statement returning `[{ department, headcount, avgSalary }]` for the country, sorted by headcount desc then department asc.
- **404 for empty country.** When the aggregate's `count === 0`, the service throws `NotFoundError("COUNTRY_NOT_FOUND")` → middleware maps to `404`. The departments query is not run in that case (short-circuit).
- **Shared types.** `shared/src/types.ts` gains `CountryInsightsResponse` (and the nested `salary`, `tenure`, `departments` shapes). Both backend and frontend import it.
- **Frontend Insights page — country card.** Replaces the FR-5 placeholder on `/insights`. Country selector at the top; below it a card with the salary distribution, headcount + tenure, and the department breakdown. Empty-country state rendered inline (not as an error alert).
- **Page layout scaffold.** The page is structured as two stacked sections; only Section A (country card) ships in this slice. Section B (role-in-country) gets a placeholder hint that the FR-6 slice will replace.

### Deferred to the FR-6 slice (`insights-role`)

- `GET /api/insights/country/:country/job-titles` — picker source for FR-6.
- `GET /api/insights/country/:country/job-title?title=...` — role-in-country aggregate.
- The role-in-country UI section (job-title Autocomplete + role card).
- Sharing the same aggregate SQL fragment between the two endpoints (introduced as a private helper inside `InsightsRepository` in this slice; reused by the FR-6 method in the next slice).

### Deferred to later slices

- Median, percentiles (p25/p75), or other distribution-spread metrics. Considered and deferred — mean + min/max is sufficient signal for v1 and avoids an order-statistic CTE.
- Docker multi-stage build + Render deploy.
- URL state (e.g. `?country=IN`) — not needed for v1.

---

## 2. API contract

```
GET /api/insights/country/:country

200 → CountryInsightsResponse
400 → { error: { code: "VALIDATION_ERROR", ... } }   if :country is not an ISO alpha-2 in COUNTRIES
404 → { error: { code: "COUNTRY_NOT_FOUND", ... } }  if no employees in that country
```

**Path param:** `country` is validated against the keys of `COUNTRIES` (the frozen shared map). Unknown codes → `400`, not `404` — they're invalid input, not "no data."

**Response shape (200):**

```json
{
  "country": "IN",
  "currency": "INR",
  "count": 312,
  "salary": { "min": 600000, "max": 4500000, "avg": 1820000 },
  "tenure": {
    "avgYears": 3.4,
    "newHiresLast12Months": 47
  },
  "departments": [
    { "department": "Engineering", "headcount": 180, "avgSalary": 2100000 },
    { "department": "Sales",        "headcount": 78,  "avgSalary": 1400000 },
    { "department": "Operations",   "headcount": 54,  "avgSalary": 950000  }
  ]
}
```

Notes:
- All salary numbers are integers in whole units of `currency`. `min`/`max` come from the rows verbatim; `avg` and per-department `avgSalary` are `CAST(ROUND(...) AS INTEGER)`.
- `tenure.avgYears` is a number rounded to one decimal at the service layer.
- `tenure.newHiresLast12Months` is an integer count of employees with `hireDate >= date('now', '-12 months')`.
- `departments` is sorted `headcount DESC, department ASC`. Always non-empty when `count > 0` — every employee has a department.
- `currency` is derived from `COUNTRIES[country].currency` at the service layer, never stored on the row.

---

## 3. Shared package

`shared/src/types.ts` gains:

```ts
export interface CountryInsightsResponse {
  country: string;     // ISO alpha-2
  currency: string;    // ISO alpha-3
  count: number;
  salary: {
    min: number;
    max: number;
    avg: number;
  };
  tenure: {
    avgYears: number;
    newHiresLast12Months: number;
  };
  departments: Array<{
    department: string;
    headcount: number;
    avgSalary: number;
  }>;
}
```

Re-exported from `shared/src/index.ts`. Both `InsightsService.byCountry`'s return type and the frontend `api/insights.ts` wrapper use it. API-contract drift is a compile-time error.

---

## 4. Backend

### Layering (per CLAUDE.md)

- **`InsightsRepository.aggregateByCountry(country)`** — returns the aggregate row (or `count: 0` when empty). Pure DB access; the service decides whether to 404.
- **`InsightsRepository.departmentsByCountry(country)`** — returns the sorted breakdown.
- **`InsightsService.byCountry(country)`** — calls the aggregate. If `count === 0` throws `NotFoundError("COUNTRY_NOT_FOUND")`. Otherwise calls the departments method, rounds `avgYears` to one decimal, attaches `currency` from `COUNTRIES`, and returns the assembled response.
- **`InsightsController.byCountry(req, res)`** — Zod-validates `:country` against the `COUNTRIES` keys, calls the service, returns `200` with the response. Validation failure throws `ValidationError` → middleware → `400`.

### Repository — SQL

The aggregate is **one straight aggregate query** — no CTE, no subqueries. Expressed via the Kysely builder with two `sql<T>` fragments for the SQLite date functions:

```ts
db.selectFrom('employees')
  .where('country', '=', country)
  .select(({ fn }) => [
    fn.countAll<number>().as('count'),
    fn.min<number>('salary').as('min'),
    fn.max<number>('salary').as('max'),
    sql<number | null>`CAST(ROUND(AVG(salary)) AS INTEGER)`.as('avg'),
    sql<number | null>`AVG((julianday('now') - julianday(hireDate)) / 365.25)`.as('avgTenureYears'),
    sql<number>`SUM(CASE WHEN hireDate >= date('now','-12 months') THEN 1 ELSE 0 END)`.as('newHiresLast12Months'),
  ])
  .executeTakeFirstOrThrow();
```

The equivalent SQL (for review):

```sql
SELECT
  COUNT(*)                                                              AS count,
  MIN(salary)                                                           AS min,
  MAX(salary)                                                           AS max,
  CAST(ROUND(AVG(salary)) AS INTEGER)                                   AS avg,
  AVG((julianday('now') - julianday(hireDate)) / 365.25)                AS avgTenureYears,
  SUM(CASE WHEN hireDate >= date('now','-12 months') THEN 1 ELSE 0 END) AS newHiresLast12Months
FROM employees
WHERE country = ?;
```

When `count = 0`: `min`/`max`/`avg`/`avgTenureYears` come back as `NULL` (no rows to aggregate); `newHiresLast12Months` comes back as `0` (SUM of an empty set is NULL in SQL but `COALESCE` isn't needed here — the service short-circuits before any field is read). The repository returns `{ count: 0, ...nulls }` and the service throws `NotFoundError` before any `NULL` reaches the response.

The departments query is also straight Kysely:

```ts
db.selectFrom('employees')
  .where('country', '=', country)
  .select([
    'department',
    sql<number>`COUNT(*)`.as('headcount'),
    sql<number>`CAST(ROUND(AVG(salary)) AS INTEGER)`.as('avgSalary'),
  ])
  .groupBy('department')
  .orderBy('headcount', 'desc')
  .orderBy('department', 'asc')
  .execute();
```

Both queries hit `idx_employees_country` (no new indexes needed — NFR-3 honored).

### Repository — return types

```ts
export interface CountryAggregate {
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  avgTenureYears: number | null;
  newHiresLast12Months: number;
}

export interface DepartmentBreakdownRow {
  department: string;
  headcount: number;
  avgSalary: number;
}
```

`CountryAggregate` is internal to the repository/service boundary — it carries the `| null` shape so the service can detect empty cleanly. The public `CountryInsightsResponse` (in `shared/`) does **not** have nullable fields; by the time it's built, the service has guaranteed `count > 0`.

### Controller — validation

```ts
const COUNTRY_CODES = Object.keys(COUNTRIES) as [string, ...string[]];
const paramsSchema = z.object({
  country: z.enum(COUNTRY_CODES),
});
```

`z.enum` produces a `400 VALIDATION_ERROR` for any unknown code. The frontend's dropdown is also driven from `COUNTRIES`, so a manual URL is the only way to reach this branch.

### Route wiring

New file `backend/src/routes/insights.ts`:

```ts
const r = Router();
r.get('/country/:country', (req, res, next) => controller.byCountry(req, res).catch(next));
export default r;
```

`backend/src/server.ts` adds: `app.use('/api/insights', insightsRouter)`.

### Files created / modified

```
backend/src/repositories/InsightsRepository.ts          (NEW)
backend/src/services/InsightsService.ts                 (NEW)
backend/src/controllers/InsightsController.ts           (NEW)
backend/src/routes/insights.ts                          (NEW)
backend/src/server.ts                                   (wire /api/insights)
backend/tests/repositories/InsightsRepository.test.ts   (NEW)
backend/tests/services/InsightsService.test.ts         (NEW)
backend/tests/controllers/InsightsController.test.ts    (NEW)
shared/src/types.ts                                     (add CountryInsightsResponse)
shared/src/index.ts                                     (export)
```

---

## 5. Frontend

Follows engineering-design §8 conventions: MUI-only, default light theme, `sx` 8px scale, explicit loading/empty/error states.

### `api/insights.ts`

```ts
export async function getCountryInsights(country: string): Promise<CountryInsightsResult>
```

Calls `/api/insights/country/:country`. Wraps the existing typed fetch client. **Maps the `404 COUNTRY_NOT_FOUND` response to a domain branch** rather than an error throw:

```ts
type CountryInsightsResult =
  | { kind: 'ok'; data: CountryInsightsResponse }
  | { kind: 'empty' };
```

Hard errors (network, 5xx, validation 400) still throw — the page renders them as an alert. This keeps "no employees in this country" a data state, not an error state, while the UI still has a clean error path for genuine failures.

### `useCountryInsights(country)` hook

`frontend/src/hooks/useCountryInsights.ts` — owns the fetch loop, mirrors `useEmployeesList`'s shape:

```ts
export function useCountryInsights(country: string | null): {
  result: CountryInsightsResult | null;   // null while no country selected
  isLoading: boolean;
  error: string | null;
};
```

`useEffect` on `[country]`. No-op when `country === null`. Cancellation flag handles unmount during in-flight fetch. No `refresh` — the data is read-only and doesn't need invalidation here.

### `InsightsPage` — country section

Replaces the placeholder (`Coming with FR-5.`) with the country selector + card.

```tsx
<Stack spacing={3}>
  <Typography variant="h4">Insights</Typography>

  <CountrySelector value={country} onChange={setCountry} />

  {country === null ? (
    <Typography variant="body1" color="text.secondary">
      Select a country to see insights.
    </Typography>
  ) : (
    <CountryInsightsCard country={country} />
  )}

  {/* Section B placeholder — replaced by FR-6 slice */}
  <Typography variant="body2" color="text.secondary">
    Role-in-country insights ship with FR-6.
  </Typography>
</Stack>
```

### `CountrySelector` component

A thin wrapper around MUI `<Autocomplete>` driven by `Object.entries(COUNTRIES)`, displayed as country name with the ISO code as a secondary line. `value` is the ISO code or `null`. Sorted by country name. Lives at `frontend/src/components/CountrySelector.tsx`.

Single-use today (only the Insights page consumes it), but extracted because:
1. It's the natural primitive for FR-6's country part — the FR-6 slice reuses it.
2. The EmployeeDialog's country field is its own form-bound Autocomplete and a separate concern (form integration); merging the two would obscure both.

### `CountryInsightsCard` component

Inputs: `country: string`. Calls `useCountryInsights(country)` internally and renders the four states:

- **Loading** — MUI `<Skeleton>` for the salary numbers and the departments table.
- **Hard error** — `<Alert severity="error">` with the message.
- **Empty (`result.kind === 'empty'`)** — `<Card>` containing "No employees in {countryName} yet." Same card frame as the success state, so the page doesn't visually shift.
- **Success** — three subsections in one `<Card>`:

  1. **Salary distribution.** Mean rendered as the headline (`h4`) — formatted via `Intl.NumberFormat` with `style: 'currency'`, `currency: result.data.currency`, `maximumFractionDigits: 0`. Below it, two caption-styled stats side by side: Min and Max. Total of three salary numbers — keeps the card visually quiet.

  2. **Headcount and tenure.** Three small stats: total count, avg tenure years (formatted with one decimal + " yr"), and `newHiresLast12Months` (formatted as "47 in last 12 months").

  3. **Department breakdown.** MUI `<Table size="small">` with columns Department / Headcount / Avg salary. Avg salary uses the same `Intl.NumberFormat` helper. No paging — at most a handful of departments per country.

Lives at `frontend/src/components/CountryInsightsCard.tsx`. The currency formatter is shared with the rest of the app via a new `frontend/src/lib/formatSalary.ts` helper, extracted from `SalaryCell.tsx` in this slice so the cell and the card format identically.

### Files created / modified

```
shared/src/types.ts                                  (add CountryInsightsResponse + re-export)
frontend/src/api/insights.ts                         (NEW)
frontend/src/api/insights.test.ts                    (NEW)
frontend/src/hooks/useCountryInsights.ts             (NEW)
frontend/src/hooks/useCountryInsights.test.tsx       (NEW)
frontend/src/components/CountrySelector.tsx          (NEW)
frontend/src/components/CountrySelector.test.tsx     (NEW)
frontend/src/components/CountryInsightsCard.tsx      (NEW)
frontend/src/components/CountryInsightsCard.test.tsx (NEW)
frontend/src/lib/formatSalary.ts                     (NEW — extract from SalaryCell)
frontend/src/components/SalaryCell.tsx               (refactor to use formatSalary)
frontend/src/pages/InsightsPage.tsx                  (replace placeholder)
frontend/src/pages/InsightsPage.test.tsx             (NEW)
```

---

## 6. Tests

Per CLAUDE.md TDD discipline. One behavior per test. Real `:memory:` SQLite for the repository.

### Backend repository (`InsightsRepository.test.ts`)

`:memory:` SQLite + `migrate()`. Each test seeds a small, hand-picked fixture so the expected values are obvious from the test.

- `aggregateByCountry` returns `{ count: 0, ...nulls, newHiresLast12Months: 0 }` on an empty table.
- `aggregateByCountry` returns `{ count: 0, ...nulls, newHiresLast12Months: 0 }` when no employees match the country.
- With 3 employees in IN at salaries [100, 200, 300]: returns count=3, min=100, max=300, avg=200.
- With 4 employees in IN at salaries [100, 250, 350, 500]: returns count=4, min=100, max=500, avg=300 (`ROUND(AVG)`).
- Mixed countries: aggregate for IN ignores rows in US.
- Tenure: an employee hired 2 years ago → `avgTenureYears` close to 2.0 (assertion: within ±0.05).
- New hires: 2 employees hired in the last 6 months + 1 hired 2 years ago → `newHiresLast12Months = 2`.
- `departmentsByCountry` returns rows sorted by headcount desc then department asc, with `avgSalary` rounded to integer.
- `departmentsByCountry` returns `[]` when no employees in the country.

### Backend service (`InsightsService.test.ts`)

Mocked repository.

- `byCountry` throws `NotFoundError("COUNTRY_NOT_FOUND")` when the aggregate's `count === 0` — and **does not call** `departmentsByCountry` (short-circuit verified by jest mock).
- `byCountry` returns the assembled response when `count > 0`: calls both repo methods, sets `currency` from `COUNTRIES`, rounds `avgTenureYears` to one decimal, copies all integer fields through unchanged, includes `departments` from the second call.
- `byCountry` rounds `2.34` → `2.3` and `2.35` → `2.4` (sanity-check the rounding).

### Backend controller (`InsightsController.test.ts`)

Supertest + mocked service. The service is mocked because the controller's only job is validation + serialization.

- `GET /api/insights/country/IN` → `200`, service called with `"IN"`, response body matches the canned service return.
- `GET /api/insights/country/XX` → `400 VALIDATION_ERROR` (`XX` not in `COUNTRIES`).
- `GET /api/insights/country/in` → `400 VALIDATION_ERROR` (case-sensitive; `COUNTRIES` keys are uppercase).
- `GET /api/insights/country/IN` when service throws `NotFoundError("COUNTRY_NOT_FOUND")` → `404` with that code.
- `GET /api/insights/country/IN` when service throws unexpected error → `500` (middleware behavior — covers the error wiring, not a behavior of the controller per se).

### Frontend (`Jest + RTL`)

- **`api/insights.test.ts`** — `getCountryInsights` maps `404 COUNTRY_NOT_FOUND` to `{ kind: 'empty' }`. Other 4xx/5xx throw.
- **`useCountryInsights.test.tsx`** — `renderHook`:
  - returns `{ result: null, isLoading: false }` when `country === null` (no fetch).
  - fetches on country change; exposes `result` on success.
  - sets `result` to the empty domain branch when api returns `{ kind: 'empty' }`.
  - sets `error` when the api throws.
- **`CountrySelector.test.tsx`** — renders all `COUNTRIES` entries, sorted by name; selecting "India" calls `onChange("IN")`.
- **`CountryInsightsCard.test.tsx`** — given a mocked `useCountryInsights`:
  - shows skeleton when `isLoading`.
  - shows the inline empty card for `{ kind: 'empty' }` (not an error alert).
  - shows the error alert when `error` is set.
  - renders mean as the headline, min/max as captions, all formatted in the response's currency.
  - renders the department table sorted by headcount desc with avg salary formatted.
- **`InsightsPage.test.tsx`** — initial render shows "Select a country to see insights." selecting a country mounts `CountryInsightsCard`.

### Live browser verification (Playwright MCP, per CLAUDE.md)

Performed before declaring the slice shippable:

1. Fresh seed: `rm backend/data/app.db*`, `npm run seed --workspace backend -- --reset`.
2. Start backend + frontend in the background. Wait for both health endpoints.
3. Open `/insights`. Confirm the placeholder hint "Select a country to see insights." is visible.
4. Pick India. Confirm the country card renders with all numbers formatted in INR, mean visually dominant, departments table populated.
5. Pick a country present in the seed but with very few employees (or change the seed temporarily) to verify the small-N rendering.
6. Use devtools to force a `404` on the endpoint for a country with no employees — confirm the inline empty state ("No employees in {country} yet.") renders inside the card frame, **not** the red `<Alert>`. (If the seed always populates every country, this is the only way to drive the empty branch in-browser.)
7. Force a `500` and confirm the red alert renders.

---

## 7. Performance / scaling notes

- The aggregate query runs against `idx_employees_country` for the filter. At 10k rows with ~5 countries, each country has ~2k rows; a flat aggregate over 2k rows is sub-millisecond on SQLite. No table scan, no temporary file pressure.
- The departments query is `GROUP BY department` on the same filter — same index, sub-millisecond at this size.
- We deliberately didn't reach for percentiles or median in v1. If those come back into scope, the natural shape is a row-number CTE (`ROW_NUMBER() OVER (ORDER BY salary)` + `LIMIT 1 OFFSET …`), still single-query, still cheap at this scale.

---

## 8. Out of scope reminders

- No new schema, no new indexes (the two existing `country` indexes cover both queries).
- No median, no percentiles, no histogram — explicitly deferred.
- No FX conversion. All numbers are in the country's local currency.
- No charts — plain numeric display per engineering-design §8.
- No URL state for the selected country (deferred; the page is cheap to re-pick).
- No caching layer in front of the endpoint — at 10k rows the queries are fast enough that a cache adds complexity without measurable benefit.
- No CSV/JSON export of the insight.
- No FR-6 endpoints or UI sections (`/job-titles`, `/job-title`, role card) — those land in `insights-role`.

---

**Next:** writing-plans skill turns this into `docs/plans/insights-country/plan.md` (used by the implementing agents, not committed — see `.gitignore`).
