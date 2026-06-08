# AI PR Reviewer — Complete Setup & Deployment Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [GitHub App Setup](#github-app-setup)
4. [Local Development](#local-development)
5. [PostgreSQL Setup](#postgresql-setup)
6. [Render Deployment (Backend)](#render-deployment-backend)
7. [Netlify Deployment (Frontend)](#netlify-deployment-frontend)
8. [Groq API Setup](#groq-api-setup)
9. [Connecting the GitHub Webhook](#connecting-the-github-webhook)
10. [Custom Coding Rules](#custom-coding-rules)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
GitHub PR opened
     │
     ▼  HMAC-SHA256 signed webhook
Render (Express API)
     │
     ├── Validate signature
     ├── Fetch PR diff from GitHub
     ├── Load custom rules (optional)
     ├── Send diff to Groq
     ├── Parse AI response
     ├── Post review to GitHub PR ──► Inline comments appear in PR
     └── Store in PostgreSQL
                │
                ▼
     Netlify (React Dashboard)
     └── Dashboard / History / Analytics / Insights
```

---

## Prerequisites

- **Node.js 20+** — `node --version`
- **PostgreSQL 15+** — for local development
- **GitHub account** with ability to create GitHub Apps
- **Groq account** — free tier at https://console.groq.com
- **Render account** — https://render.com (free tier works for MVP)
- **Netlify account** — https://netlify.com (free tier works)

---

## GitHub App Setup

This is the most important step. A GitHub App gets installed on repositories and
receives webhooks automatically — no per-repo configuration required.

### Step 1 — Create the App

1. Go to https://github.com/settings/apps
2. Click **New GitHub App**
3. Fill in:
   - **Name**: `AI PR Reviewer` (or any unique name)
   - **Homepage URL**: your Netlify URL (or `https://example.com` for now)
   - **Webhook URL**: `https://your-render-app.onrender.com/api/github/webhook`
     *(You'll get this URL after deploying to Render. You can set a placeholder now.)*
   - **Webhook Secret**: Generate a strong secret:
     ```bash
     openssl rand -hex 32
     ```
     Save this — you'll need it as `GITHUB_WEBHOOK_SECRET`.

### Step 2 — Set Permissions

Under **Repository permissions**:
| Permission | Access |
|------------|--------|
| Pull requests | Read & Write |
| Contents | Read |
| Metadata | Read |
| Checks | Read & Write |

### Step 3 — Subscribe to Events

Under **Subscribe to events**, check:
- ✅ Pull request

### Step 4 — Generate Private Key

1. After creating the app, scroll to **Private keys**
2. Click **Generate a private key**
3. A `.pem` file downloads automatically
4. Convert it for use as an environment variable:

```bash
# Convert multi-line PEM to single-line for .env
cat your-app.private-key.pem | awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' 
```

Copy the output — this is your `GITHUB_PRIVATE_KEY`.

### Step 5 — Note Your App ID

The App ID is shown at the top of your app's settings page. This is `GITHUB_APP_ID`.

### Step 6 — Install the App on Repositories

1. Go to your app's page on GitHub
2. Click **Install App**
3. Choose the repositories you want to review
4. Click **Install**

---

## Local Development

### 1. Clone and Install

```bash
git clone <your-repo>
cd ai-pr-reviewer

# Install backend
cd backend
npm install
npx prisma generate

# Install frontend
cd ../frontend
npm install
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env with your actual values
```

### 3. Set Up Local Database

```bash
# Create the database
createdb ai_pr_reviewer

# Run migrations
cd backend
npx prisma migrate dev --name init
```

### 4. Start Development Servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend  
cd frontend
npm run dev
```

Backend runs on http://localhost:3000
Frontend runs on http://localhost:5173

### 5. Test Webhooks Locally

Use [smee.io](https://smee.io) or [ngrok](https://ngrok.com) to forward GitHub webhooks to localhost:

```bash
# Using smee
npm install -g smee-client
smee -u https://smee.io/your-channel-id -t http://localhost:3000/api/github/webhook

# Using ngrok
ngrok http 3000
# Use the ngrok URL as your webhook URL in GitHub App settings
```

---

## PostgreSQL Setup

### Local

```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15
createdb ai_pr_reviewer

# Ubuntu/Debian
sudo apt install postgresql-15
sudo -u postgres createdb ai_pr_reviewer
```

### Run Migrations

```bash
cd backend

# Development (creates migration files)
npx prisma migrate dev --name init

# Production (applies existing migrations)
npx prisma migrate deploy

# Explore data in browser UI
npx prisma studio
```

---

## Render Deployment (Backend)

### Option A — Using render.yaml (Recommended)

1. Push the repo to GitHub
2. In Render dashboard: **New** → **Blueprint**
3. Connect your GitHub repo
4. Render reads `backend/render.yaml` and creates:
   - Web service (Docker)
   - PostgreSQL database
5. Add the secret environment variables in the Render dashboard:
   - `GITHUB_APP_ID`
   - `GITHUB_PRIVATE_KEY` (paste the single-line version with `\n` characters)
   - `GITHUB_WEBHOOK_SECRET`
   - `GROQ_API_KEY`

### Option B — Manual Setup

1. **New** → **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
4. Add all environment variables from `.env.example`
5. Create a **PostgreSQL** database separately and use its connection string as `DATABASE_URL`

### Health Check

Render will hit `GET /api/health` every 30 seconds. If it fails 3 times consecutively,
Render restarts the service.

### Important: Cold Starts

On the **Starter** (free) plan, Render spins down services after 15 minutes of inactivity.
The next request will take ~50 seconds (cold start). This will cause GitHub to retry the
webhook, which is handled gracefully.

For production, upgrade to the **Standard** plan ($7/mo) to eliminate cold starts.

---

## Netlify Deployment (Frontend)

### Option A — Netlify CLI

```bash
cd frontend
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

### Option B — GitHub Integration (Recommended)

1. Push repo to GitHub
2. In Netlify: **New site** → **Import from Git**
3. Select your repo
4. Build settings (auto-detected from `netlify.toml`):
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Add environment variable:
   - `VITE_API_URL` = `https://your-render-app.onrender.com`
6. Click **Deploy**

---

## Groq API Setup

1. Create account at https://console.groq.com
2. Go to **API Keys** → **Create API Key**
3. Copy the key (starts with `gsk_`)
4. Add as `GROQ_API_KEY` environment variable

### Model Selection

The default model is `deepseek-r1-distill-llama-70b`. This model:
- Has strong code analysis capabilities
- Supports the JSON output format needed for structured reviews
- Is available on Groq's fast inference infrastructure

Alternative: `llama-3.1-70b-versatile` for faster but potentially less detailed reviews.

---

## Connecting the GitHub Webhook

After deploying to Render:

1. Copy your Render service URL: `https://ai-pr-reviewer-api.onrender.com`
2. Go to your GitHub App settings: https://github.com/settings/apps
3. Click **Edit** on your app
4. Update **Webhook URL** to: `https://ai-pr-reviewer-api.onrender.com/api/github/webhook`
5. Ensure **Active** is checked
6. Save changes

### Test the Webhook

1. Open a test PR in an installed repository
2. Check Render logs: **Dashboard** → your service → **Logs**
3. You should see:
   ```
   Processing PR webhook  { repo: "owner/repo", pr: 1 }
   Fetched PR files       { fileCount: 3 }
   Starting Groq review   { chunks: 1 }
   Posted GitHub review   { reviewId: 12345 }
   PR review completed    { score: 7.5, issues: 4 }
   ```
4. Check your GitHub PR — AI review comments should appear

---

## Custom Coding Rules

Add repository-specific rules by creating `.ai-review/rules.md` in your repo root.
The reviewer loads this file automatically on every PR review.

See the example at `.ai-review/rules.md` in this repository for format guidance.

Rules are cached in the database using the file's Git SHA for invalidation —
updating the file triggers a fresh cache on the next PR.

---

## Troubleshooting

### Webhook returns 401 Unauthorized

**Cause**: Webhook secret mismatch.
**Fix**: Verify `GITHUB_WEBHOOK_SECRET` in Render matches exactly what you set in GitHub App settings. No extra spaces or newlines.

### "Cannot find module" errors at startup

**Cause**: TypeScript not compiled or Prisma client not generated.
**Fix**:
```bash
cd backend
npx prisma generate
npm run build
```

### GitHub review comments not appearing

**Cause**: File positions in the diff couldn't be computed.
**Fix**: Check Render logs for "Failed to post GitHub review". This usually means the installation token is expired or has insufficient permissions. Verify the GitHub App has `Pull Requests: Read & Write` permission.

### Groq returns empty or malformed JSON

**Cause**: Model occasionally deviates from JSON format instructions.
**Fix**: The system has fallback parsing — an empty issues array is returned and stored. The summary body is still posted to GitHub. Consider switching to `llama-3.1-70b-versatile` if this persists.

### Reviews are slow (> 60 seconds)

**Cause**: Large PRs trigger chunked review (multiple Groq calls).
**Fix**: This is expected behavior for PRs with > ~50 changed files. The GitHub webhook handler responds with 202 immediately, so GitHub won't timeout. Groq's fast inference keeps this to ~10-30s for most PRs.

### "P2002 Unique constraint failed" in logs

**Cause**: GitHub sent the same webhook twice (it retries on timeout).
**Fix**: The idempotency check (`findExistingReview`) handles this — the duplicate is silently ignored. This log is informational, not an error.

### Database connection errors on Render

**Cause**: PostgreSQL free tier has a connection limit (97 connection hours/month).
**Fix**: Ensure `DATABASE_URL` is set correctly. Check the database isn't paused in the Render dashboard. For high traffic, upgrade to the $7/month database tier.

---

## Running Tests

```bash
cd backend

# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only  
npm run test:integration

# With coverage report
npm test -- --coverage
```

---

## Security Checklist

Before going to production, verify:

- [ ] `GITHUB_WEBHOOK_SECRET` is at least 32 random characters
- [ ] `GITHUB_PRIVATE_KEY` is stored only in environment variables, never in code
- [ ] `.env` is in `.gitignore`
- [ ] Render environment variables are marked as "Secret"
- [ ] CORS origin in `src/app.ts` is set to your actual Netlify URL
- [ ] Rate limiting is enabled (it is by default)
- [ ] The GitHub App only has the minimum required permissions
