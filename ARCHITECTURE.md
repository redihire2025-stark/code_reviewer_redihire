# AI PR Reviewer — Architecture & Risk Analysis

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GITHUB                                  │
│  Developer opens PR → Webhook fires → POST /api/github/webhook  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS + HMAC-SHA256 signature
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RENDER (Backend API)                         │
│                                                                 │
│  Express + TypeScript                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ Webhook     │→ │ PR Processor │→ │ Groq AI Provider    │   │
│  │ Handler     │  │ Service      │  │ (with retry logic)  │   │
│  └─────────────┘  └──────────────┘  └─────────────────────┘   │
│         │                │                    │                 │
│         ▼                ▼                    ▼                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ Signature   │  │ GitHub API   │  │ Review Comment      │   │
│  │ Validator   │  │ Client       │  │ Formatter           │   │
│  └─────────────┘  └──────────────┘  └─────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│                   ┌─────────────┐                               │
│                   │ PostgreSQL  │ (Prisma ORM)                  │
│                   │ Database    │                               │
│                   └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                      │ REST API
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NETLIFY (Frontend)                            │
│  React + Vite + TypeScript                                      │
│  Dashboard / PR History / Analytics / Developer Insights        │
└─────────────────────────────────────────────────────────────────┘
```

## Risk Analysis & Mitigations

### 1. Scalability Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large PRs hitting Groq token limits | High | Diff chunking (max 8000 tokens/chunk), parallel chunk processing |
| Webhook queue backup under high load | High | In-memory queue with concurrency limiter (max 5 concurrent reviews) |
| GitHub API rate limits (5000 req/hr/install) | Medium | Token caching, request batching, exponential backoff |
| Database connection pool exhaustion | Medium | Prisma connection pool config, max 10 connections on free tier |

### 2. Security Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Forged webhooks | Critical | HMAC-SHA256 signature validation on every request |
| Private key exposure | Critical | Env var only, never logged, PEM format validation |
| Prompt injection via PR content | High | Sanitize diff content, system prompt isolation |
| SQL injection | Medium | Prisma parameterized queries (no raw SQL) |
| Token leakage in logs | Medium | Redact secrets from all log output |

### 3. GitHub API Rate Limit Risks

- **Installation tokens** expire in 1 hour → cache per installation ID
- **REST rate limit**: 5000/hr per installation → batch file fetches
- **Review posting**: 1 review per PR per run (not per comment) → use review batch API
- **Secondary rate limits**: max 100 content requests/min → add 200ms delay between file fetches

### 4. Groq Cost & Reliability Risks

| Risk | Mitigation |
|------|------------|
| Large diffs → high token count | Filter generated files, chunk diffs, truncate at 8000 tokens |
| Duplicate reviews (webhook replay) | Idempotency key per PR SHA in DB |
| Groq outage | Retry with exponential backoff (3 attempts), graceful degradation |
| Malformed JSON responses | Zod schema validation + fallback parsing |

### 5. Deployment Risks

| Risk | Mitigation |
|------|------------|
| Render free tier cold starts (50s) | Health check endpoint, upgrade to paid for production |
| Netlify build failures | Type checking in CI, separate build step |
| DB migration failures | Prisma migrate deploy in Dockerfile entrypoint |
| Environment variable misconfiguration | Startup validation that crashes fast with clear errors |

## Design Decisions

### Why Express over Fastify/Hono?
Mature ecosystem, better Prisma middleware support, team familiarity.

### Why raw fetch for Groq instead of SDK?
The Groq SDK is a thin wrapper — using raw fetch gives us full control over retry logic, streaming, and request shaping without dependency on SDK versioning.

### Why store raw diff in DB?
Enables re-review without re-fetching from GitHub (useful when GitHub token expires).

### Why not use GitHub Actions instead of a GitHub App?
GitHub App gets a webhook for ALL repositories it's installed on — zero per-repo configuration. GitHub Actions requires per-repo workflow files.

### Chunking Strategy
PRs > 8000 tokens are split by file. Each file's diff is reviewed independently then results are merged. This prevents context window overflow and keeps reviews focused.
