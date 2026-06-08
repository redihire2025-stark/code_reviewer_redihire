#!/bin/sh
# docker-entrypoint.sh
# Runs DB migrations on every deploy, then starts the server.
# Prisma migrate deploy is idempotent — safe to run on every startup.
# If migrations fail, the container exits immediately with a non-zero code,
# which causes Render to mark the deploy as failed (better than a broken server).

set -e

echo "🔄 Running database migrations..."
node_modules/.bin/prisma migrate deploy

echo "✅ Migrations complete. Starting server..."
exec node dist/app.js
