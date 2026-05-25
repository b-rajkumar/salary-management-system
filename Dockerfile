# syntax=docker/dockerfile:1.6

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
