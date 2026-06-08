# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────
FROM node:20-alpine AS production

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Install ALL deps (including prisma CLI needed for migrate deploy)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy built output and prisma files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma/

# Entrypoint script: run migrations then start server
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
