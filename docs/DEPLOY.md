# Deployment Guide — Zero Local PostgreSQL Required

Everything runs in the cloud. You need only a browser and git.

---

## What Gets Deployed Where

| What | Where | Cost |
|------|-------|------|
| PostgreSQL database | Render (auto-provisioned) | Free (90 days then $7/mo) |
| Backend API | Render | Free (with cold starts) |
| Frontend dashboard | Netlify | Free forever |
| AI reviews | Groq Cloud | Free tier (generous) |

---

## Prerequisites — accounts only, no local installs needed

- [ ] [GitHub account](https://github.com) — you already have this
- [ ] [Render account](https://render.com) — sign up free, connect with GitHub
- [ ] [Netlify account](https://netlify.com) — sign up free, connect with GitHub
- [ ] [Groq account](https://console.groq.com) — sign up free

---

## Step 1 — Push the code to GitHub

```bash
cd ai-pr-reviewer
git init
git add .
git commit -m "Initial commit"
# Create a new repo on github.com then:
git remote add origin https://github.com/YOUR_USERNAME/ai-pr-reviewer.git
git push -u origin main
```

---

## Step 2 — Deploy Backend + Database on Render

Render reads `backend/render.yaml` and creates the database and web service automatically.

### 2a. Connect repo to Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New** → **Blueprint**
3. Click **Connect a repository** → select your `ai-pr-reviewer` repo
4. **Root Directory**: type `backend` (this tells Render where `render.yaml` lives)
5. Click **Apply**

Render now creates:
- ✅ PostgreSQL database (`ai-pr-reviewer-db`)
- ✅ Web service (`ai-pr-reviewer-api`) — Docker build starts immediately

### 2b. Watch the first build

Go to your web service → **Logs** tab. The build takes ~3-5 minutes.
You'll see:
```
==> Building Docker image...
==> Starting service...
🔄 Running database migrations...
✅ Migrations complete. Starting server...
AI PR Reviewer API running  { port: 3000 }
```

The database tables are created automatically by `prisma migrate deploy` on first boot.
**You never need to touch the database directly.**

### 2c. Note your backend URL

Once deployed, Render shows your URL at the top:
```
https://ai-pr-reviewer-api.onrender.com
```
Copy this — you need it in Steps 3 and 4.

---

## Step 3 — Deploy Frontend on Netlify

### 3a. Connect repo to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site** → **Import an existing project**
3. Click **Deploy with GitHub** → select your `ai-pr-reviewer` repo
4. Netlify reads `frontend/netlify.toml` automatically. Verify:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

### 3b. Add the backend URL as an environment variable

Before clicking Deploy:
1. Click **Show advanced** → **New variable**
2. Key: `VITE_API_URL`
3. Value: `https://ai-pr-reviewer-api.onrender.com` (your Render URL from Step 2c)
4. Click **Deploy site**

Build takes ~1 minute. Your dashboard is now live at:
```
https://something-random-123.netlify.app
```

### 3c. (Optional) Add a custom domain

In Netlify: **Site settings** → **Domain management** → **Add custom domain**.

---

## Step 4 — Create the GitHub App

The GitHub App is what connects repositories to your reviewer.

### 4a. Create the app

1. Go to [github.com/settings/apps](https://github.com/settings/apps)
2. Click **New GitHub App**
3. Fill in:

| Field | Value |
|-------|-------|
| GitHub App name | `AI PR Reviewer` (must be unique across GitHub) |
| Homepage URL | Your Netlify URL |
| Webhook URL | `https://ai-pr-reviewer-api.onrender.com/api/github/webhook` |
| Webhook secret | Run `openssl rand -hex 32` in terminal, paste the output |

4. **Repository permissions** — set these exactly:

| Permission | Level |
|-----------|-------|
| Contents | Read |
| Metadata | Read |
| Pull requests | Read & write |
| Checks | Read & write |

5. Under **Subscribe to events**, check: ✅ **Pull request**

6. Set **Where can this GitHub App be installed?** → **Any account** (or "Only on this account" if private use)

7. Click **Create GitHub App**

### 4b. Generate a private key

On your app's settings page:
1. Scroll to **Private keys**
2. Click **Generate a private key**
3. A `.pem` file downloads — open it in a text editor

Convert it to a single-line format for Render:
```bash
# macOS/Linux — run this, copy the output
cat ~/Downloads/your-app-name.*.private-key.pem | awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}'
```

The output looks like:
```
-----BEGIN RSA PRIVATE KEY-----\nMIIEow...very long base64...\n-----END RSA PRIVATE KEY-----\n
```

### 4c. Note your App ID

At the top of the app settings page you'll see **App ID: 123456**. Copy it.

---

## Step 5 — Add secrets to Render

1. Go to your Render web service
2. Click **Environment** tab
3. Add these variables (click **Add Environment Variable** for each):

| Key | Value |
|-----|-------|
| `GITHUB_APP_ID` | The number from Step 4c (e.g. `123456`) |
| `GITHUB_PRIVATE_KEY` | The single-line PEM from Step 4b |
| `GITHUB_WEBHOOK_SECRET` | The `openssl rand -hex 32` output from Step 4a |
| `GROQ_API_KEY` | Your Groq key (see Step 6) |
| `FRONTEND_URL` | Your Netlify URL (e.g. `https://abc-123.netlify.app`) |

4. Click **Save Changes** — Render redeploys automatically

---

## Step 6 — Get Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up / log in
3. Click **API Keys** → **Create API Key**
4. Name it `ai-pr-reviewer`, copy the key (starts with `gsk_`)
5. Add it to Render as `GROQ_API_KEY` (Step 5)

---

## Step 7 — Install the GitHub App on a repository

1. Go to [github.com/settings/apps](https://github.com/settings/apps)
2. Click your app name → **Install App**
3. Choose your account or organization
4. Select **Only select repositories** → pick a repo to test with
5. Click **Install**

---

## Step 8 — Test it end-to-end

1. Open a Pull Request in the repository where you installed the app
2. Wait ~30-60 seconds (cold start on free Render tier is ~30s)
3. Check your PR — you should see AI review comments appear inline

**Check Render logs if nothing appears:**
- Render dashboard → your service → **Logs**
- Look for: `Processing PR webhook` and `PR review completed`

---

## Troubleshooting

### "Service unavailable" on first webhook

**Cause**: Render free tier cold starts (~30s).
**Fix**: GitHub automatically retries webhooks after 1 minute. The second attempt succeeds. This is expected on the free plan.

### Render build fails: "Cannot find prisma"

**Fix**: Make sure the **Root Directory** in Render is set to `backend`. The `render.yaml` and `Dockerfile` must be at the root of what Render sees.

### "Invalid webhook signature" in Render logs

**Fix**: Copy the webhook secret **exactly** from `openssl rand -hex 32` — no spaces, no quotes. Paste it identically into both GitHub App settings and Render `GITHUB_WEBHOOK_SECRET`.

### "P1001: Can't reach database server"

**Cause**: DATABASE_URL not set, or database still initializing.
**Fix**: In Render, verify the `DATABASE_URL` env var shows `fromDatabase` (not blank). The database takes ~2 minutes to be ready on first create — redeploy the web service after the DB shows "Available".

### GitHub App posts no comments but logs show "PR review completed"

**Fix**: Ensure **Pull requests: Read & Write** permission is set on the GitHub App. If you added it after installation, go to the app's installation settings and click **Review new permissions**.

### Netlify shows blank page

**Fix**: Check that `VITE_API_URL` in Netlify points to your Render URL **without** a trailing slash:
- ✅ `https://ai-pr-reviewer-api.onrender.com`
- ❌ `https://ai-pr-reviewer-api.onrender.com/`

---

## After Deployment Checklist

- [ ] Backend health check passes: `curl https://your-api.onrender.com/api/health`
- [ ] Frontend loads at your Netlify URL
- [ ] Test PR gets reviewed automatically
- [ ] Review comments appear inline in GitHub
- [ ] Dashboard shows the review at your Netlify URL
- [ ] Set `FRONTEND_URL` on Render to lock down CORS to your exact Netlify domain
