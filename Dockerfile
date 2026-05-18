FROM oven/bun:1.2.20 AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build

WORKDIR /app

COPY . .
RUN bunx vite build
RUN bun build --compile --target=bun-linux-arm64 --outfile server src/server/local.ts

FROM debian:bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV SQLITE_PATH=/app/data/airing-list.sqlite
ENV ASSETS_DIR=/app/dist/client

COPY --from=build /app/server ./server
COPY --from=build /app/dist/client ./dist/client
COPY --from=build /app/drizzle ./drizzle
RUN mkdir -p /app/data

EXPOSE 8787

ENTRYPOINT ["./server"]
