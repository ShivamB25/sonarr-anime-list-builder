FROM oven/bun:1.4.0 AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build

WORKDIR /app

COPY . .
RUN bun run typecheck
RUN bun run build:client
RUN bun build --compile --outfile server src/server/local.ts

FROM debian:bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV SQLITE_PATH=/app/data/airing-list.sqlite
ENV ASSETS_DIR=/app/dist/client

COPY --from=build /app/server ./server
COPY --from=build /app/dist/client ./dist/client
COPY --from=build /app/drizzle ./drizzle
RUN groupadd --system app \
    && useradd --system --gid app --home-dir /nonexistent --shell /usr/sbin/nologin app \
    && mkdir -p /app/data \
    && chmod 0555 /app/server \
    && chmod -R a=rX /app/dist /app/drizzle \
    && chown app:app /app/data \
    && chmod 0700 /app/data

EXPOSE 8787
USER app

ENTRYPOINT ["./server"]
