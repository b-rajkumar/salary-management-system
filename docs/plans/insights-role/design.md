# FR-6 — Role-in-Country Insights (Design)

**Date:** 2026-05-24
**Status:** Approved
**Slice:** Second insights slice. Builds on the country view shipped in `insights-country/`. Adds the job-title picker, the role aggregate endpoint, and refactors the Insights page from "two stacked sections" into a single filter-driven view.

Companion to [PRD §5 FR-6](../../prd.md) and [Engineering Design §5–§6](../../engineering-design.md).

The FR-5 design assumed FR-6 would land as a second card stacked below the country card. **This design supersedes that.** Treating the role as a *filter* on the country view (rather than a parallel report) gives HR the comparison they actually need — role salary against country mean — and removes a duplicated stat-card row from the page.

---

## 1. Scope

### In scope

- **Two backend endpoints** under `/api/insights`:
  - `GET /api/insights/country/:country/job-titles` — picker source.
  - `GET /api/insights/country/:country/job-title?title=...` — role-in-country aggregate.
- **Case-insensitive job-title matching.** Picker collapses casings (`MIN(jobTitle) GROUP BY LOWER(jobTitle)`); aggregate matches with `COLLATE NOCASE`. See §4 and the new `decisions.md` entry.
- **Schema migration.** Replace `idx_employees_country_jobTitle` (binary collation, will not serve `COLLATE NOCASE` predicates) with `idx_employees_country_jobTitle_nocase` (case-insensitive). Honors NFR-3.
- **Shared type.** `RoleInsightsResponse` — same shape as `CountryInsightsResponse` minus `departments`.
- **Page refactor.** `CountryInsightsCard` is replaced by `InsightsCard`, a single component driven by `{ country, role }` page state. Role-aware salary card, conditional departments table, comparison delta when a role is selected.
- **New `JobTitleSelector` component.** MUI `<Autocomplete>` parallel to `CountrySelector`; disabled until a country is picked.
- **Visual range bar** inside the salary card — a 24px-tall SVG track from min to max with a marker at mean. Adds shape to the distribution without introducing a chart library.

### Out of scope (deliberate)

- Median, percentiles, histograms — same deferral as FR-5.
- Cross-country role comparison ("Software Engineer in IN vs US"). Not requested.
- Role-level department breakdown. Departments are a country-level concept; a "Software Engineer in India" works in one department for the most part, and showing a sub-table for a single role adds noise.
- URL state (`?country=IN&role=Software%20Engineer`). Cheap to re-pick; not needed for v1.
- Caching layer. Queries are sub-millisecond at 10k rows.

---

## 2. API contract

### `GET /api/insights/country/:country/job-titles`

```
200 → ["Product Manager", "Sales Director", "Software Engineer"]
400 → VALIDATION_ERROR  if :country is not in COUNTRIES
```

Behavior:
- Returns a plain JSON array of distinct job titles in that country, **collapsed by case** (one row per `LOWER(jobTitle)`), sorted alphabetically (`ORDER BY LOWER(jobTitle)`).
- Display casing is picked deterministically via `MIN(jobTitle)` — for a set of `{"It Manager", "IT Manager"}` the picker shows `IT Manager` (uppercase sorts before lowercase under default collation, so `MIN` picks it).
- Empty country returns `[]` — **not** a 404. The picker handles an empty list itself (disabled state with "No roles in {country}").
- No envelope object. The service returns `string[]`; the controller serializes it directly — consistent with how `byCountry` returns the final response shape and the controller does no extra shaping.

### `GET /api/insights/country/:country/job-title?title=Software%20Engineer`

```
200 → RoleInsightsResponse
400 → VALIDATION_ERROR  if :country invalid OR title missing/empty
404 → ROLE_NOT_FOUND   if no employees match (country, title) case-insensitively
```

Behavior:
- `title` is URL-decoded and matched with `jobTitle = ? COLLATE NOCASE` against the indexed column.
- The 404 is a safety net for the race "HR clicks a title that was just deleted." The picker shouldn't produce a title that won't match.

Response (200):

```json
{
  "country": "IN",
  "jobTitle": "Software Engineer",
  "currency": "INR",
  "count": 47,
  "salary": { "min": 1400000, "max": 3800000, "avg": 2250000 },
  "tenure": { "avgYears": 2.8, "newHiresLast12Months": 9 }
}
```

`jobTitle` is echoed back from the request (preserves the picker's chosen display casing). All numeric conventions match FR-5: integer salary in local currency, `avgYears` rounded to one decimal at the service layer, `newHiresLast12Months` as an integer.

---

## 3. Shared package

`shared/src/types.ts` adds:

```ts
export interface RoleInsightsResponse {
  country: string;     // ISO alpha-2
  jobTitle: string;    // echoed from the request
  currency: string;    // ISO alpha-3
  count: number;
  salary: { min: number; max: number; avg: number };
  tenure: { avgYears: number; newHiresLast12Months: number };
}
```

Re-exported from `shared/src/index.ts`. The job-titles endpoint returns `string[]`, which doesn't need a dedicated shared type — the wrapper would only exist for the controller to add a key, which adds no value here.

---

## 4. Backend

### Migration — `backend/migrations/002_role_index_nocase.sql`

```sql
DROP INDEX idx_employees_country_jobTitle;

CREATE INDEX idx_employees_country_jobTitle_nocase
  ON employees (country, jobTitle COLLATE NOCASE);
```

Rationale: the original binary-collation index cannot serve `WHERE country = ? AND jobTitle = ? COLLATE NOCASE`. The new index can. Nothing else in the codebase relies on the old index (only FR-6 reads `jobTitle` under a filter), so dropping it keeps the schema honest. The runner applies new migrations on startup — no manual step required.

### Layering (per CLAUDE.md)

`InsightsRepository` adds two methods and refactors to share the aggregate SQL:

```ts
// Private helper — same shape as today's aggregateByCountry, plus optional jobTitle filter
private buildAggregateQuery(filter: { country: string; jobTitle?: string })

async aggregateByCountry(country)                       // unchanged behavior — now built on the helper
async aggregateByCountryAndRole(country, jobTitle)      // NEW
async distinctJobTitles(country): Promise<string[]>     // NEW
```

The helper returns a Kysely query builder pre-configured with the SELECT list and the country WHERE. Each public method finalizes it (adds the jobTitle WHERE if applicable, executes).

`InsightsService` adds:

```ts
async byCountryAndRole(country, jobTitle): Promise<RoleInsightsResponse>
async jobTitlesByCountry(country): Promise<string[]>
```

`byCountryAndRole` mirrors `byCountry`: calls the aggregate, throws `NotFoundError("ROLE_NOT_FOUND")` when `count === 0`, otherwise assembles the response (echoes `jobTitle` from the input, attaches `currency` from `COUNTRIES`, rounds `avgYears` to one decimal).

`jobTitlesByCountry` is a thin pass-through; it returns the repository's `string[]` unchanged. The controller serializes that array directly with `res.json(titles)` — no wrapping, no extra fields. This mirrors `byCountry`, where the service returns the final shape and the controller just hands it to Express.

`InsightsController` adds:

```ts
async jobTitles(req, res)         // GET /country/:country/job-titles
async byCountryAndRole(req, res)  // GET /country/:country/job-title?title=...
```

Validation:
- `:country` validated against `COUNTRIES` keys (same `paramsSchema` as today, exported and reused).
- `?title=` validated as a non-empty trimmed string. Empty / whitespace-only → `400 VALIDATION_ERROR`.

### Route wiring

```ts
r.get('/country/:country/job-titles',  (req, res, next) => controller.jobTitles(req, res).catch(next));
r.get('/country/:country/job-title',   (req, res, next) => controller.byCountryAndRole(req, res).catch(next));
```

### SQL for the new queries

**Picker:**

```sql
SELECT MIN(jobTitle) AS jobTitle
FROM employees
WHERE country = ?
GROUP BY LOWER(jobTitle)
ORDER BY LOWER(jobTitle);
```

Served by `idx_employees_country_jobTitle_nocase` (the leading `country` column is enough; the `LOWER(jobTitle)` GROUP BY is a sort that fits cleanly given the nocase ordering of the second column).

**Role aggregate** — same select list as `aggregateByCountry`, with one extra WHERE:

```sql
SELECT
  COUNT(*) AS count,
  MIN(salary) AS min, MAX(salary) AS max,
  CAST(ROUND(AVG(salary)) AS INTEGER) AS avg,
  AVG((julianday('now') - julianday(hireDate)) / 365.25) AS avgTenureYears,
  COALESCE(SUM(CASE WHEN hireDate >= date('now','-12 months') THEN 1 ELSE 0 END), 0) AS newHiresLast12Months
FROM employees
WHERE country = ?
  AND jobTitle = ? COLLATE NOCASE;
```

Served by `idx_employees_country_jobTitle_nocase`.

---

## 5. Frontend

### Page state

`InsightsPage` owns:

```ts
const [country, setCountry] = useState<string | null>(null);
const [role,    setRole]    = useState<string | null>(null);  // null === "All roles"
```

When `setCountry(next)` fires, `setRole(null)` fires in the same handler. The role picker is **disabled** until a country is picked.

### Page layout

```
Insights
[Country: ▼]   [Role: ▼  (disabled until country)]

(if country === null)
  "Pick a country to see insights."

(if country !== null)
  <InsightsCard country={country} role={role} />
```

### `InsightsCard` (replaces `CountryInsightsCard`)

Single component, two data sources:

```ts
const country = useCountryInsights(props.country);   // existing FR-5 hook
const role    = useRoleInsights(props.country, props.role); // NEW; no-op when role === null
```

Render branches:
- **Country still loading** → skeleton (same as today).
- **Country empty** → inline empty card "No employees in {countryName} yet." Role picker upstream is disabled in this branch.
- **Country loaded, role === null** → today's FR-5 layout: salary card + 3 stat cards + departments table.
- **Country loaded, role !== null, role loading** → role-area skeleton (just the salary + 3 stat cards) overlaying the previous values to avoid layout jump; departments table fades out.
- **Country loaded, role !== null, role empty** → keep the four card frames; show "No {role} in {country}" inside the salary card. (Picker race only.)
- **Country loaded, role !== null, role loaded** → role data fills the cards; departments table hidden; salary card shows the comparison delta line.

### Salary card

When `role === null`:

```
Mean salary (in {country})
₹18,20,000
Range ₹6,00,000 – ₹45,00,000
[──────●──────────────────] ← range bar
```

When `role !== null`:

```
Mean salary — {role} in {country}
₹22,50,000
Range ₹14,00,000 – ₹38,00,000
[──────────●──────────────] ← range bar
+24% vs all roles in {country}     ← comparison delta
```

**Comparison delta** is computed on the frontend:

```ts
const delta = (role.salary.avg - country.salary.avg) / country.salary.avg;
// rendered as: `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}% vs all roles in ${countryName}`
```

Rendered in a muted color, smaller than the headline. Positive deltas in default text color; negative in a slightly desaturated red. (Keeps the visual quiet — this is data, not an alert.)

The delta is omitted when `country.salary.avg === 0` (impossible given the 404 short-circuit, but defensive).

### Visual range bar

A small inline component, `<SalaryRangeBar min mean max />`:

- A 24px-tall flex row.
- Background `<Box>` with rounded corners, light gray, full width.
- Foreground marker `<Box>` positioned with `left: ${((mean - min) / (max - min)) * 100}%` (clamped 0–100 for the `min === max` degenerate case → marker centered).
- Small caption row below with `min` on the left and `max` on the right, body2 muted text.

No charting library. No axes, no ticks, no gridlines — the intent is *shape*, not measurement. The exact numbers live above.

When `min === max` (only one employee in the role), the bar renders as a single full-width filled band; the caption shows just the one number.

### `JobTitleSelector` component

MUI `<Autocomplete>` matching the `CountrySelector` API:

```ts
interface Props {
  country: string | null;
  value: string | null;
  onChange: (jobTitle: string | null) => void;
}
```

Behavior:
- Disabled when `country === null`. Helper text: "Pick a country first."
- When `country` changes, the component refetches its options via `useJobTitles(country)`.
- The visible "All roles" option is **not** a server-returned title — it's prepended in the component as a sentinel. Selecting it calls `onChange(null)`.
- Empty-titles list (`country` has zero employees, or the picker hasn't loaded yet): selector is disabled with "No roles in {country}" / "Loading roles…" helper text.

### `useJobTitles(country)` and `useRoleInsights(country, role)`

Same shape as `useCountryInsights` — `[country, role]` effect dependency, cancellation flag on unmount, no `refresh`. `useRoleInsights` is a no-op when `role === null` and returns `{ result: null, isLoading: false, error: null }`.

`useRoleInsights` exposes the same `{ kind: 'ok' | 'empty' }` discriminator as `useCountryInsights`; the api wrapper maps `404 ROLE_NOT_FOUND` to `{ kind: 'empty' }`.

### Files

```
shared/src/types.ts                                   (+ RoleInsightsResponse)

backend/migrations/002_role_index_nocase.sql          (NEW)
backend/src/repositories/InsightsRepository.ts        (+ 2 methods, factor private helper)
backend/src/services/InsightsService.ts               (+ 2 methods)
backend/src/controllers/InsightsController.ts         (+ 2 handlers)
backend/src/routes/insights.ts                        (+ 2 routes)
backend/tests/repositories/InsightsRepository.test.ts (extend)
backend/tests/services/InsightsService.test.ts       (extend)
backend/tests/controllers/InsightsController.test.ts (extend)

frontend/src/api/insights.ts                          (+ getJobTitles, getRoleInsights with empty branch)
frontend/src/api/insights.test.ts                     (extend)
frontend/src/hooks/useJobTitles.ts                    (NEW + test)
frontend/src/hooks/useRoleInsights.ts                 (NEW + test)
frontend/src/components/JobTitleSelector.tsx          (NEW + test)
frontend/src/components/SalaryRangeBar.tsx            (NEW + test)
frontend/src/components/InsightsCard.tsx              (NEW — replaces CountryInsightsCard)
frontend/src/components/InsightsCard.test.tsx         (NEW)
frontend/src/components/CountryInsightsCard.tsx       (DELETE)
frontend/src/components/CountryInsightsCard.test.tsx  (DELETE)
frontend/src/pages/InsightsPage.tsx                   (wire the new layout)
frontend/src/pages/InsightsPage.test.tsx              (extend)
```

`CountryInsightsCard` is deleted because `InsightsCard` subsumes it. The page's behavior with `role === null` matches today's FR-5 output exactly — verified by the existing FR-5 page tests, which port over to `InsightsPage` against the new component.

---

## 6. Tests

Per CLAUDE.md TDD discipline. One behavior per test. Real `:memory:` SQLite for the repository.

### Backend — `InsightsRepository.test.ts` (extend)

- `distinctJobTitles` returns alphabetically sorted titles for the country.
- `distinctJobTitles` collapses casing — two rows `IT Manager` and `it manager` produce one entry (the lexicographic min, `IT Manager`).
- `distinctJobTitles` returns `[]` for an empty country.
- `aggregateByCountryAndRole` returns the aggregate row when rows match.
- `aggregateByCountryAndRole` returns `count: 0` (and nulls / zero) when no rows match.
- `aggregateByCountryAndRole` matches case-insensitively — query for `software engineer` returns the row stored as `Software Engineer`.
- `aggregateByCountryAndRole` does NOT bleed across countries — rows in US with the same title don't count toward IN.

### Backend — `InsightsService.test.ts` (extend)

- `byCountryAndRole` throws `NotFoundError("ROLE_NOT_FOUND")` when count is 0.
- `byCountryAndRole` echoes the input `jobTitle` verbatim into the response (preserves picker casing).
- `byCountryAndRole` attaches the country's currency.
- `byCountryAndRole` rounds `avgYears` to one decimal.
- `jobTitlesByCountry` passes through the repo's array unchanged.

### Backend — `InsightsController.test.ts` (extend)

- `GET /country/IN/job-titles` → 200 with the service's return.
- `GET /country/XX/job-titles` → 400 VALIDATION_ERROR.
- `GET /country/IN/job-title?title=Engineer` → 200 with the service's return.
- `GET /country/IN/job-title` (missing title) → 400 VALIDATION_ERROR.
- `GET /country/IN/job-title?title=%20` (whitespace) → 400 VALIDATION_ERROR.
- `GET /country/IN/job-title?title=Nope` when service throws ROLE_NOT_FOUND → 404 with code.

### Frontend

- **`api/insights.test.ts`** — `getJobTitles` returns the titles array. `getRoleInsights` maps `404 ROLE_NOT_FOUND` to `{ kind: 'empty' }`; other 4xx/5xx throw.
- **`useJobTitles.test.tsx`** — `country === null` → no fetch. Country change → fetch + expose titles. Error path sets error.
- **`useRoleInsights.test.tsx`** — `role === null` → no fetch. Role change → fetch. Empty branch surfaces `{ kind: 'empty' }`.
- **`JobTitleSelector.test.tsx`** — disabled when `country === null`. Renders "All roles" option that calls `onChange(null)`. Renders the fetched titles. Selecting one calls `onChange(title)`.
- **`SalaryRangeBar.test.tsx`** — marker positioned correctly (assert via inline style `left` percentage). `min === max` degenerate case renders as full band.
- **`InsightsCard.test.tsx`** — covers the seven render branches in §5 above, including the comparison delta when role is set.
- **`InsightsPage.test.tsx`** — initial render. Country change clears role. Picking a role mounts the role view inside the card. Empty role surfaces the inline message.

### Live browser (Playwright MCP, per CLAUDE.md)

Per CLAUDE.md "Verifying UI changes" — fresh DB + seed, drive the browser:

1. `/insights` initial — "Pick a country to see insights." visible.
2. Pick India → country view renders (salary card with range bar, three stat cards, departments table).
3. Pick a role from the dropdown → role view renders (departments table disappears, comparison delta appears).
4. Switch country → role auto-resets to "All roles" and the country view re-renders.
5. Force a `404 ROLE_NOT_FOUND` (via temporary data manipulation or devtools) → "No {role} in {country}" inline.
6. Force a `500` → red alert.

---

## 7. Doc updates this triggers

Will draft and confirm before editing:

- **`prd.md` FR-6** — clarify: (a) titles in the picker are collapsed case-insensitively and matched case-insensitively; (b) the page presents role as a filter on the country view, with a comparison-to-country delta; (c) the salary card carries a min–mean–max visual range bar.
- **`engineering-design.md` §4** — replace `(country, jobTitle)` index with `(country, jobTitle COLLATE NOCASE)`; note the migration.
- **`engineering-design.md` §5** — add the two new endpoint rows.
- **`engineering-design.md` §8** — note the `SalaryRangeBar` as the one accepted visual primitive on the Insights page.
- **`decisions.md`** — new entry: *Role insights are a filter on the country view, not a parallel report.* Captures the layout change and the comparison-delta intent.
- **`decisions.md`** — new entry: *Job-title matching is case-insensitive.* Captures the picker collapsing + COLLATE NOCASE + the new index.
- **`README.md` "What's shipped"** — move FR-6 from Deferred to Shipped once landed.

---

## 8. Out of scope reminders

- No new schema beyond the index swap. No new columns.
- No median, no percentiles, no histogram. The range bar is shape only.
- No FX conversion. Salaries are in the country's local currency throughout.
- No URL state. No caching layer. No CSV/JSON export.
- No cross-country role comparison.
- No role-level department breakdown.

---

**Next:** writing-plans skill turns this into `docs/plans/insights-role/plan.md` (gitignored — used by the implementing agents).
