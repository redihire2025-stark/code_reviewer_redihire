# 🤖 AI PR Reviewer

A production-ready platform that automatically reviews GitHub Pull Requests using Groq AI and posts educational review comments directly inside GitHub.

## What It Does

When a developer opens, updates, or reopens a Pull Request:

1. **GitHub fires a webhook** to the backend API
2. **Signature is validated** (HMAC-SHA256)
3. **Changed files are fetched** from GitHub (ignoring generated/vendor files)
4. **Optional custom rules** are loaded from `.ai-review/rules.md`
5. **Code diff is sent to Groq** for analysis
6. **AI generates educational comments** with problem, context, fix, and learning insight
7. **Comments are posted inline** directly on the changed lines in GitHub
8. **Summary review appears** at the top of the PR
9. **Results are stored** in PostgreSQL
10. **Dashboard shows** review history, analytics, and developer insights

## Architecture

| Component | Technology | Hosting |
|-----------|------------|---------|
| Backend API | Node.js + TypeScript + Express | Render |
| Database | PostgreSQL + Prisma | Render |
| AI Provider | Groq (deepseek-r1-distill-llama-70b) | Groq Cloud |
| Frontend | React + TypeScript + Vite | Netlify |
| Auth | GitHub App (JWT + installation tokens) | GitHub |

## Quick Start

See [docs/SETUP.md](docs/SETUP.md) for the complete setup guide.

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Configure environment
cd backend && cp .env.example .env
# Edit .env with your credentials

# Run migrations
cd backend && npx prisma migrate dev --name init

# Start development
cd backend && npm run dev        # http://localhost:3000
cd frontend && npm run dev       # http://localhost:5173
```

## Project Structure

```
ai-pr-reviewer/
├── backend/
│   ├── src/
│   │   ├── ai/              # Groq provider + abstraction interface
│   │   ├── github/          # Auth, file fetching, review posting
│   │   ├── webhooks/        # Signature validation, event handler
│   │   ├── reviews/         # Comment formatter, summary builder
│   │   ├── services/        # PR review orchestration
│   │   ├── database/        # Prisma client + repository layer
│   │   ├── routes/          # Express router
│   │   ├── middleware/       # Rate limiting
│   │   ├── config/          # Env validation
│   │   ├── types/           # TypeScript interfaces
│   │   └── utils/           # Logger
│   ├── prisma/schema.prisma # Database schema
│   ├── tests/               # Unit + integration tests
│   ├── Dockerfile
│   └── render.yaml
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, PRHistory, Analytics, DevInsights
│   │   ├── components/      # StatCard, ScoreBadge
│   │   ├── layouts/         # AppLayout with sidebar nav
│   │   ├── hooks/           # useAsync data fetching
│   │   ├── services/        # API client
│   │   └── types/           # TypeScript interfaces
│   └── netlify.toml
├── docs/
│   └── SETUP.md             # Complete setup guide
└── .ai-review/
    └── rules.md             # Example custom coding rules
```

## Adding AI Providers

The system uses a provider abstraction. To add a new provider:

1. Create `backend/src/ai/your-provider.ts` implementing `AIProvider`:
   ```typescript
   export class YourProvider implements AIProvider {
     async reviewCode(payload: ReviewPayload): Promise<ReviewResult> { ... }
   }
   ```
2. Register it in `backend/src/ai/index.ts`:
   ```typescript
   const providers = {
     groq: () => new GroqProvider(),
     yourProvider: () => new YourProvider(), // add here
   };
   ```

## Review Comment Format

Every AI-generated comment includes:

- **Severity**: Critical / High / Medium / Low
- **Category**: Bugs / TypeScript / React / Performance / Security / Architecture / CodeQuality / Testing
- **Problem**: Clear description of the issue
- **Why It Matters**: Consequences and context
- **Suggested Fix**: How to resolve it
- **Improved Code**: Working code example
- **Learning Insight**: The underlying principle to learn

## Custom Coding Rules

Add `.ai-review/rules.md` to any repository to inject team-specific standards into every review. See the example in this repo.

## License

MIT
