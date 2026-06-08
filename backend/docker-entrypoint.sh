#!/bin/sh
set -e

echo "=== AI PR Reviewer Starting ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo YES || echo NO)"
echo "DIRECT_URL set: $([ -n "$DIRECT_URL" ] && echo YES || echo NO)"
echo "GITHUB_APP_ID set: $([ -n "$GITHUB_APP_ID" ] && echo YES || echo NO)"
echo "GROQ_API_KEY set: $([ -n "$GROQ_API_KEY" ] && echo YES || echo NO)"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Please add it in Render Environment tab."
  exit 1
fi

echo ""
echo "Running database migrations..."
MIGRATE_URL="${DIRECT_URL:-$DATABASE_URL}"
DATABASE_URL="$MIGRATE_URL" node_modules/.bin/prisma migrate deploy
echo "Migrations complete."

echo "Starting server..."
exec node dist/app.js
