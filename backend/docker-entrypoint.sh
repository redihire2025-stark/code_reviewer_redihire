#!/bin/sh
set -e

echo "🔄 Running database migrations..."
# Use DIRECT_URL for migrations (bypasses pgBouncer which blocks DDL)
# Falls back to DATABASE_URL if DIRECT_URL not set
MIGRATE_URL="${DIRECT_URL:-$DATABASE_URL}"
DATABASE_URL="$MIGRATE_URL" node_modules/.bin/prisma migrate deploy

echo "✅ Migrations complete. Starting server..."
exec node dist/app.js
