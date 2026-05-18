FROM oven/bun:1.2.20 AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build

WORKDIR /app

COPY . .
RUN bunx vite build

FROM oven/bun:1.2.20 AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV SQLITE_PATH=/app/data/airing-list.sqlite

COPY --from=build /app ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/data

EXPOSE 8787

ENTRYPOINT ["./docker-entrypoint.sh"]
