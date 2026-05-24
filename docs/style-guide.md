# Style Guide — TypeScript / JavaScript

Concise rules. Anything not covered here defers to Prettier and the ESLint config at the repo root.

What's automated (see `eslint.config.mjs` for the full set):

- **Prettier** — indentation, quotes, semicolons, trailing commas, line width.
- **ESLint — structure**: blank line after a `const`/`let` group and before every `return`.
- **ESLint — correctness**: strict equality (`===`), `no-var`, `prefer-const`, `no-throw-literal`, `no-duplicate-imports`, `no-implicit-coercion` (use `Boolean(x)` not `!!x`), `no-return-await`, `no-useless-concat`/`no-useless-rename`.
- **ESLint — cleanliness**: `prefer-template` (no string concatenation), `object-shorthand`, `prefer-arrow-callback`, `arrow-body-style: as-needed`, `curly: all` (braces around every `if`/`else` body).
- **ESLint — TypeScript**: `consistent-type-imports` (inline style: `import { type Foo }`), `consistent-type-definitions` (`interface` for object shapes), `no-inferrable-types`, `no-unused-vars` (prefix with `_` to escape), `no-explicit-any` (warn), `no-non-null-assertion` (warn).

Tests get relaxed rules (no-explicit-any, no-non-null-assertion disabled) — mock plumbing makes those hard to avoid cleanly.

Run `npm run lint` to check, `npm run lint:fix` to apply auto-fixes. Everything below this header that isn't on the list above is enforced by review.

---

## Formatting

Blank lines inside a function body carry structure. The ESLint rule enforces the three patterns below; everything else is your call.

- Group consecutive `const` / `let` declarations together — no blank line between them.
- One blank line after a declaration group, before the next statement.
- One blank line before every `return`.

```ts
function summarize(input: Input): Result {
  const parsed = parseInput(input);
  const cleaned = sanitize(parsed);
  const merged = mergeWith(defaults, cleaned);

  const enriched = enrich(merged);

  return format(enriched);
}
```

Don't fight the rule for trivial functions — single-statement bodies need no internal whitespace. The rule kicks in once you have declarations followed by other work.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Classes, types, interfaces | `PascalCase` | `EmployeesController`, `EmployeeCreateInput` |
| Variables, functions, methods | `camelCase` | `createEmployee`, `currencyForCountry` |
| Top-level immutable primitives | `SCREAMING_SNAKE_CASE` | `MAX_PAGE_SIZE`, `MIGRATIONS_DIR` |
| File: class | `PascalCase.ts` | `EmployeesController.ts` |
| File: function / module of data | lowercase | `countries.ts`, `migrate.ts` |
| Booleans | start with `is`, `has`, `can`, `should` | `isOpen`, `hasError`, `canSubmit` |

Names describe **what**, not **how**. `getUsers()`, not `fetchUsersFromCacheOrApi()`. Implementation can change; the name shouldn't.

## Types

- Prefer `interface` for object shapes that may be extended; `type` for unions, intersections, and aliases.
- Use `as const satisfies T` for static maps. You keep narrow literal types *and* get compile-time shape checking:

  ```ts
  export const COUNTRIES = {
    US: { name: 'United States', currency: 'USD' },
  } as const satisfies Record<string, Country>;
  ```

- Avoid `any`. If you need an escape hatch, use `unknown` and narrow.
- Avoid non-null assertions (`!`). Narrow with a conditional, or `?? throw new Error('…')`.
- Don't duplicate types between client and server. Put them in `shared/`.

## Imports

Group imports, blank line between groups, in this order:

1. Node built-ins (`node:fs`, `node:path`)
2. Third-party packages (`express`, `kysely`, `react`)
3. Internal workspace packages (`@app/shared`)
4. Relative imports (`./db/client`, `../lib/errors`)

Use named imports. Default exports only when the module genuinely exports one thing (e.g. a Vite config).

## Functions

- One responsibility per function. If you can't describe it in one sentence, split it.
- Early return for guard clauses. Flat control flow over nested.
- Async: always `await`. Don't mix `.then()` and `await` in the same function.
- Pure where you can. Side effects belong in clearly named functions (`createDb`, `migrate`).

## Errors

- Throw typed `AppError` subclasses (`ValidationError`, `ConflictError`, `NotFoundError`) at the layer that originates the failure.
- Catch driver-specific errors (e.g. `SQLITE_CONSTRAINT_UNIQUE`) at the repository boundary and rethrow as `AppError`. Services and controllers never see raw driver errors.
- Don't catch what you can't meaningfully handle. Let unknown errors bubble to the global handler.

## Null vs undefined

- Default to `undefined` for "absence". Use `null` only when an external API or DB column returns it.
- Prefer `??` over `||` for defaults — `||` is wrong when `0`, `''`, or `false` is a valid value.

## Classes

- Constructor injection over module-level singletons. Tests pass mocks to the constructor; production wires real implementations in the composition root (`buildApp`).
- Layout top-to-bottom: static fields → instance fields → constructor → public methods → private methods.
- Use regular methods (`async create(req, res) { … }`), not arrow-function class properties (`create = async (req, res) => { … }`), unless you specifically need lexical `this` binding when passing the method naked.

## Comments

- Default: don't write any. Well-named identifiers and types do the work.
- Write a comment only when the *why* isn't obvious from the code: a workaround, a constraint, a subtle invariant.
- Never write a comment that restates the code.
- No section banners (`// --- setup ---`). Use blank lines to mark structure.

## Tests

- One behavior per test. Test names read in plain English: `creates an employee with valid input`, `rejects a duplicate email with 409`.
- Use `beforeEach` for setup repeated across tests in a `describe` block. Avoid `buildX` helpers when `beforeEach` reads better.
- Mock at layer boundaries. Repository tests use a real `:memory:` SQLite; service tests mock the repository; controller tests mock the service via supertest. Don't mock what you own internally.

## Exports

- Named exports. Default exports only when the module is genuinely one thing.
- Don't barrel-re-export internal modules. `shared/src/index.ts` is the public surface of a workspace package and rightly re-exports; an internal `routes/index.ts` doing `export * from './employees'` is noise.

## Project structure

- Shared types live in `shared/`. Both apps import from `@app/shared`. API-contract drift is a compile error.
- Backend layers (controller → service → repository) are organized by-layer, not by-feature. Class names carry their layer suffix.
- Validation lives at the HTTP boundary (Zod in the controller). Internal callers trust their inputs.
