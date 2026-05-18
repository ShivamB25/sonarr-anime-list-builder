#!/bin/sh
set -e

if [ "$1" = "cloudflare-dev" ]; then
  shift
  exec node node_modules/wrangler/bin/wrangler.js dev --ip 0.0.0.0 --port "${PORT:-8787}" "$@"
fi

if [ "$1" = "deploy" ]; then
  shift
  exec node node_modules/wrangler/bin/wrangler.js deploy "$@"
fi

exec bun src/server/local.ts "$@"
