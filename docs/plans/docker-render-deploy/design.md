# Docker Image + Render Deploy (Design)

**Date:** 2026-05-25
**Status:** Landed. Live at https://salary-management-system-o22x.onrender.com/
**Slice:** Deployment story. Adds a containerized build artifact and the Render configuration that runs it.

Companion to [Engineering Design §1, §3](../../engineering-design.md) and the corresponding `decisions.md` entries (added in this slice).

---

## 1. Scope

### In scope

- **`Dockerfile`** — multi-stage build that produces one runtime image containing the built backend, its production-only `node_modules`, the SQL migrations, and the built frontend's static assets.
- **`.dockerignore`** — keeps `node_modules`, `dist`, the host `data/` dir, and `.git` out of the build context.
- **`docker-compose.yml`** — one service for running the production image locally. No volumes; data is ephemeral and matches Render's runtime behavior.
- **`render.yaml`** — declarative Render config: one web service, `env: docker`, no persistent disk, the env vars the image expects.
- **Static SPA serving in `backend/src/app.ts`** — the production binary must serve `frontend/dist` directly because no Vite dev server exists at runtime. SPA `*` fallback so client-side routing works on refresh.
- **Seed refactor** — extract the seed body from `backend/scripts/seed.ts` into a reusable `seed(db)` function under `backend/src/lib/seed.ts`. The CLI script becomes a thin wrapper that calls it.
- **Seed-on-empty in `backend/src/server.ts`** — env-gated (`SEED_ON_EMPTY=1`) inline check that runs `seed(db)` when the `employees` table is empty. Three lines; no new file.
- **Doc updates** — reconcile `engineering-design.md` and add two `decisions.md` entries.
- **README deploy section** — short block describing the live URL, `docker compose up`, and how to flip seeding off.

### Out of scope

- Persistent storage on Render. Free tier doesn't support disks; we explicitly accept ephemeral SQLite + cold-start re-seed. The `$7/mo Starter + disk` upgrade requires only adding a `disk:` block to `render.yaml` — documented but not configured.
- CI/CD beyond Render's built-in build-on-push.
- Multi-arch image builds. Render builds for `linux/amd64`; local dev rebuilds for whatever the dev's machine is. No registry push is needed.
- A separate "empty" Render deployment for evaluating empty-state UX. Empty-state behavior is covered by component tests and a local-Docker env-var flip (`SEED_ON_EMPTY=0`).
- Litestream, LiteFS, or any SQLite replication.
- Switching to Postgres. Considered and rejected — see `decisions.md` entry on the Render-free-tier choice.

---

## 2. Architecture

One image. Two runtime contexts. Identical observable behavior in each.

```
┌──────────────────────────────────────────────────────────────────┐
│ Container (node:20-slim, non-root user)                          │
│                                                                  │
│   /app                                                           │
│   ├── backend/dist/                ← compiled TS                 │
│   ├── backend/migrations/          ← applied at app boot         │
│   ├── backend/node_modules/        ← prod deps only              │
│   ├── frontend/dist/               ← Vite output (static)        │
│   └── shared/dist/                                               │
│                                                                  │
│   /data/app.db                     ← writable container path     │
│                                      (ephemeral in both contexts)│
│                                                                  │
│   PORT=3000   DATABASE_PATH=/data/app.db   SEED_ON_EMPTY=1       │
│   NODE_ENV=production                                            │
│                                                                  │
│   CMD: node backend/dist/server.js                               │
│                                                                  │
│   Routes:                                                        │
│     /api/health             → 200 { ok: true }                   │
│     /api/employees, etc.    → REST endpoints                     │
│     /api/insights/country/* → insights endpoints                 │
│     /*                      → serves frontend/dist/index.html    │
│                              (or the matched static asset)       │
└──────────────────────────────────────────────────────────────────┘

Local:  docker compose up         → image runs, no volume, port 3000
Render: render.yaml web service   → image runs, no disk, public URL
```

The image carries everything it needs. The host (Docker engine or Render) supplies only the port mapping and (optionally) env-var overrides.

---

## 3. Image (`Dockerfile`)

**Base:** `node:20-slim` for both build and runtime. `better-sqlite3` ships prebuilt binaries for `linux-x64-glibc`, so no compiler toolchain is needed during install. Alpine would force a source build (Python + build-essential).

**Two stages:**

### Stage `builder`

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json   shared/
COPY backend/package.json  backend/
COPY frontend/package.json frontend/
RUN npm ci

COPY shared   shared
COPY backend  backend
COPY frontend frontend
COPY data     data

RUN npm run build --workspaces --if-present
RUN npm prune --omit=dev --workspaces
```

`tsconfig.base.json` is required at the root because each workspace's `tsconfig.json` extends it. `data/` carries the names files needed by the seed function and must reach the runtime image.

After `npm prune`, `node_modules/` contains only runtime deps. The frontend's dev deps (Vite, jest, etc.) drop out; backend's `ts-node-dev`, `jest`, `tsx`, etc. drop out.

### Stage `runtime`

```dockerfile
FROM node:20-slim AS runtime
WORKDIR /app

RUN useradd --uid 10001 --create-home app \
 && mkdir -p /data \
 && chown app:app /data

USER app

COPY --from=builder --chown=app:app /app/package.json         ./package.json
COPY --from=builder --chown=app:app /app/node_modules         ./node_modules
COPY --from=builder --chown=app:app /app/shared/dist          ./shared/dist
COPY --from=builder --chown=app:app /app/shared/package.json  ./shared/package.json
COPY --from=builder --chown=app:app /app/backend/dist         ./backend/dist
COPY --from=builder --chown=app:app /app/backend/migrations   ./backend/migrations
COPY --from=builder --chown=app:app /app/backend/package.json ./backend/package.json
COPY --from=builder --chown=app:app /app/frontend/dist        ./frontend/dist
COPY --from=builder --chown=app:app /app/data                 ./data

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/app.db \
    SEED_ON_EMPTY=0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "backend/dist/server.js"]
```

**Notes:**

- `SEED_ON_EMPTY=0` in the image so an accidental `docker run` against the bare image doesn't re-seed. Both compose and Render flip it to `1` explicitly.
- npm workspaces hoist all dependencies (including `better-sqlite3`'s prebuilt native binary) to the root `node_modules/`. The runtime stage copies only the root tree — there is no `backend/node_modules` to copy because workspaces don't materialize one.
- `/data` is created in the runtime stage (`mkdir -p /data && chown app:app /data`) so `better-sqlite3` can open `/data/app.db` as the non-root `app` user. The driver creates the file but not the parent directory.
- The healthcheck uses Node's native `fetch` (available in Node 18+), avoiding `curl`/`wget` deps.

---

## 4. `.dockerignore`

```
.git
.gitignore
node_modules
**/node_modules
**/dist
backend/data
**/*.db
**/*.db-shm
**/*.db-wal
docs
*.md
.env*
.vscode
.idea
.DS_Store
```

Keeps the build context under ~10MB. Note that root-level `data/` is **not** ignored — it contains the names files the image needs at runtime; only `backend/data/` (the dev's local SQLite directory) is excluded.

---

## 5. Local run (`docker-compose.yml`)

```yaml
services:
  app:
    build: .
    image: salary-management-system:local
    ports:
      - "3000:3000"
    environment:
      SEED_ON_EMPTY: "${SEED_ON_EMPTY:-1}"
      NODE_ENV: production
```

The `${SEED_ON_EMPTY:-1}` interpolation defaults to `"1"` but lets the reviewer flip it from the shell: `SEED_ON_EMPTY=0 docker compose up` skips the seed.

**Reviewer experience:**

| Command | Result |
|---|---|
| `docker compose up` | Build (first time), run, seed 10k rows, listen on `:3000`. |
| `SEED_ON_EMPTY=0 docker compose up` | Same but empty app. |
| `docker compose down && docker compose up` | Reset. Fresh DB, seeded again. |

No volumes. Every `up` is a fresh container with a fresh `/data/app.db`. Matches Render's runtime exactly, so a bug visible locally is a bug visible on Render and vice versa.

---

## 6. Render deploy (`render.yaml`)

```yaml
services:
  - type: web
    name: salary-management-system
    env: docker
    dockerfilePath: ./Dockerfile
    plan: free
    healthCheckPath: /api/health
    envVars:
      - key: SEED_ON_EMPTY
        value: "1"
      - key: NODE_ENV
        value: production
```

**Runtime behavior on Render free tier:**

- Cold start sequence: container boot (~10s) → migrate (creates schema, sub-second) → seed-on-empty (~5-10s for 10k rows) → `listen()`. First request after a 15-min idle takes ~20-25s. Subsequent requests <100ms.
- `PORT` is set by Render automatically (typically 10000 internally); the app's `parseInt(process.env.PORT ?? '3000', 10)` picks it up.
- `DATABASE_PATH` defaults to `/data/app.db` from the image's `ENV` — Render doesn't override it. `/data` is a regular writable container path; no disk is attached, so the directory and its contents disappear on container restart.

**Path to real persistence (deferred):** add a `disk:` block to the web service and bump to `plan: starter`. No code change. Documented in `decisions.md`.

---

## 7. Code prerequisites

These are not "Docker work" per se, but the Docker image only functions if these land first.

### 7.1 Serve the SPA from Express

`backend/src/app.ts` only routes `/api/*` today because dev mode uses Vite on `:5173` for the SPA. Production runs a single process; the same Express has to serve the static `frontend/dist`.

**Change:** `buildApp` gains a second optional argument — the path to the frontend's static output. `server.ts` passes the default (`path.join(__dirname, '..', '..', 'frontend', 'dist')`, which resolves to `/app/frontend/dist` in the image and to `<repo>/frontend/dist` when running from a local build). Tests pass a tmpdir they own.

After the API routes, add an explicit JSON catch-all for `/api/*` that throws `NotFoundError`, then conditionally mount the static serving + SPA fallback when `frontendDist` is provided and exists on disk. `errorMiddleware` stays last:

```ts
app.use('/api', (_req, _res, next) => {
  next(new NotFoundError('NOT_FOUND', 'Route not found'));
});

if (frontendDist && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(errorMiddleware);
```

The `/api` catch-all using the existing `NotFoundError` → `errorMiddleware` path guarantees unknown API routes always return JSON 404, **independent** of whether the SPA is wired. Without this, an unhandled `/api/*` would fall through to Express's default HTML 404. An earlier draft placed the guard inside the SPA `*` handler — discarded in favor of this explicit form because it makes the API contract uniform across test, dev, and prod runs.

**Tests:** add to `backend/tests/app.test.ts` (new file) — Supertest against a `buildApp(':memory:', tmpDir)` where `tmpDir` contains a fixture `index.html` with a known marker string. `beforeAll` writes the fixture into `os.tmpdir()`; `afterAll` removes it. No reliance on whether the real `frontend/dist/` exists.

1. `GET /` returns the fixture HTML (contains the marker).
2. `GET /some/spa/route` returns the fixture HTML (SPA fallback).
3. `GET /api/unknown` returns a JSON 404 (not HTML).
4. `GET /api/health` returns `{ ok: true }` (regression check that API routes still take priority).

### 7.2 Extract `seed(db)` into a reusable function

`backend/scripts/seed.ts` today is a self-contained CLI. The image needs the seed logic callable in-process.

**Change:**

- Move the body of the seed (open the names files, build rows, run the transaction) into `backend/src/lib/seed.ts` exporting `function seed(db: Kysely<DB>): void`. The function uses `db` as passed in — it does not open its own connection.
- Reduce `backend/scripts/seed.ts` to a wrapper: parse env, open a connection via `createDb`, run `migrate()`, call `seed(db.kysely)`, close, exit.
- The wrapper is what `npm run seed` invokes — unchanged contract from a CLI perspective.

**Tests:** `seed()` is exercised by an existing or new integration test that opens `:memory:`, calls `migrate()`, calls `seed()`, asserts `count(*) === 10000` and `count(distinct email) === 10000`. One behavior, one test.

### 7.3 Seed-on-empty in `server.ts`

Three lines, gated by env var. Inlined into `server.ts` — does not justify its own file.

```ts
if (process.env.SEED_ON_EMPTY === '1') {
  const { count } = db.kysely
    .selectFrom('employees')
    .select(eb => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  if (count === 0) seed(db.kysely);
}
```

Placed **after** `buildApp` (so migrations have run and the table exists) and **before** `app.listen()` (so we never serve traffic against a half-loaded DB).

**Why env-gated, not always-on:** `npm run dev` outside Docker would otherwise auto-seed into the developer's local `backend/data/app.db` on every dev-server restart. Surprising and wasteful. The flag is set only by the image's runtime configuration (compose + render.yaml), not by `dev` scripts.

**Tests:** not added. The branch is three lines of orchestration over already-tested primitives (`seed()` is tested in 7.2; the count query is a one-liner). Per the project's "no tests for trivial code" rule.

---

## 8. Data flow at runtime

**Cold start (both contexts):**

1. Container boots → `node backend/dist/server.js`.
2. `buildApp(dbPath, frontendDist)` → opens DB → runs `migrate()` → creates `employees` table → mounts routes (`/api/health`, `/api/employees`, `/api/insights/*`, `/api` JSON catch-all, `express.static(frontend/dist)`, SPA fallback, `errorMiddleware`).
3. If `SEED_ON_EMPTY=1` and `SELECT COUNT(*) FROM employees === 0`: `seed({ db: db.sqlite, count: 10_000, firstNames, lastNames })` inserts 10k rows in a single transaction via the raw `better-sqlite3` driver.
4. `app.listen(PORT)`.

**Warm request:**

- API call → controller → service → repository → SQLite via `better-sqlite3` (synchronous, sub-millisecond) → JSON response.
- SPA route → `express.static` finds the asset or the fallback returns `index.html`.

**Local restart:**

- `docker compose down`: container stops, `/data` disappears (no volume).
- `docker compose up`: new container, new empty DB, seed runs again. ~10s from start to listening.

**Render cold start (after 15-min idle):**

- Same sequence. User-perceived latency ~20-25s for the first request, then warm.

---

## 9. Error handling

- **Seed throws mid-flight** (e.g., constraint violation, disk full): exception propagates out of `server.ts` → process exits non-zero → Docker/Render restart loop surfaces the log. We do not catch and continue with a half-seeded DB.
- **Static dir missing:** caught at build time (`COPY --from=builder /app/frontend/dist` fails the image build), not at runtime.
- **Port collision (local):** user re-maps in `docker-compose.yml` (`"3001:3000"`).
- **`SEED_ON_EMPTY=1` with a non-empty DB:** count short-circuits; seed is skipped. Idempotent.
- **Unknown API route:** the explicit `/api` catch-all (mounted after the API routers, before the SPA wiring) throws `NotFoundError('NOT_FOUND')` → `errorMiddleware` returns a JSON 404. The SPA HTML is never returned for an API path, regardless of whether `frontendDist` is wired.

---

## 10. Verification

No new unit tests are added for the image itself — its value is operational. Verification is the matrix below; results are captured in the slice's commit message or follow-up note.

### 10.1 Image smoke test (manual, gated on build)

```
docker build -t salary-management-system:local .
docker run --rm -p 3000:3000 -e SEED_ON_EMPTY=1 salary-management-system:local &
sleep 15
curl -fsS http://localhost:3000/api/health                        # → {"ok":true}
curl -fsS "http://localhost:3000/api/employees?pageSize=1" | jq . # → { rows: [...], total: 10000 }
curl -fsS http://localhost:3000/api/insights/country/IN | jq .    # → country aggregate
curl -fsSI http://localhost:3000/                                 # → 200 text/html
```

### 10.2 Local compose

`docker compose up`, then drive the golden path through Playwright MCP per the project's "Verifying UI changes" rule: list page, sort/filter, create, view, edit, delete, country insights. Capture screenshots at key states.

### 10.3 Render deploy

Push the branch, link to Render, wait for first deploy. Visit the public URL, repeat the Playwright golden path. Capture the URL and ~3 screenshots in the README.

### 10.4 Existing test suites continue to pass

`npm test` runs backend + frontend Jest suites. The static-serving wiring and seed extraction must not break any existing test (some adjustments are expected — see 7.1, 7.2).

---

## 11. Doc impact

These changes need explicit approval before being applied, per the project's "never edit a doc without explicit confirmation" rule.

### `engineering-design.md`

The doc already has a §11 Build & Deploy that anticipates this work. Updates are surgical:

- **§1 Tech Stack table — `Container` row.** Current: "Multi-stage Dockerfile / Single artifact, backend serves the static frontend." No change needed.
- **§1 Tech Stack table — `Hosting` row.** Current: "Render — Free web service + persistent disk for SQLite." Replace with: "Render — Free web service. SQLite is ephemeral on the free tier; `SEED_ON_EMPTY=1` rehydrates the demo on cold start. The Starter plan + persistent disk is the upgrade path; documented in §11."
- **§3 Architecture diagram note.** Current: "One process. One container. One database file on a mounted volume." Replace last sentence with: "One database file on the container's writable filesystem — ephemeral on Render free tier and on local Docker; mountable as a volume in a `disk:`-attached Starter deploy."
- **§11 Build & Deploy — `Hosting` line.** Current: "Render web service + 1 GB persistent disk mounted at `/data`. `DATABASE_PATH=/data/app.db`." Replace with: a short two-paragraph block describing the free-tier deploy (env vars, cold-start re-seed, ~20-25s first-request latency, the `$7 Starter + disk` upgrade as a single `render.yaml` block away).
- **§11 Build & Deploy — local dev.** Add a line: "Or `docker compose up` to run the production image locally on `:3000` — same image that Render serves." Existing `npm run dev` line stays.
- **§11 Build & Deploy — `Container start`.** Current step 1 mentions migrations only. Add step "1b. If `SEED_ON_EMPTY=1` and the `employees` table is empty, run the in-process seed." between steps 1 and 2.

No new top-level section is added. §11 absorbs the additions.

### `decisions.md`

- **New entry — "Containerize even though Render builds Node natively."** Reasoning: pins Node version, freezes the `better-sqlite3` native binary build, freezes every transitive dep, decouples from Render's native build image changes, keeps the artifact portable if we ever leave Render. Cost: ~30 lines of Dockerfile and one compose file. Alternative considered: native Render Node build — works today but offers none of the above reproducibility guarantees.
- **New entry — "Render free tier with ephemeral SQLite and seed-on-empty."** Reasoning: $0 cost; the demo workflow is fully exercisable from a cold start; persistence is one `disk:` block and a $7 plan-bump away with no code change. Alternative considered: Postgres on Render free tier — works, but invalidates several `decisions.md` entries about SQLite, doubles the operational surface, and the demo doesn't benefit.

### `README.md`

- New short **Deploy** section: live URL, "how to run locally with Docker" (`docker compose up`), "how to run empty-state" (`SEED_ON_EMPTY=0 docker compose up`), and a note on cold-start latency.

---

## 12. Open assumptions

- `frontend/dist` is built before the Docker `COPY` step. The `npm run build --workspaces --if-present` line in the builder stage runs `frontend`'s `tsc -b && vite build`, which produces `frontend/dist`. Verified by inspection of `frontend/package.json`.
- `better-sqlite3@11.x` has a `linux-x64-glibc` prebuilt for Node 20. Verified on the npm package's `prebuilds/` listing — falls back to source build on Alpine but works out of the box on slim.
- `docker compose` v2 syntax is acceptable (no `version:` key needed). Standard since 2023.
- Render's `env: docker` builds from `dockerfilePath`. Verified against Render's current docs.
