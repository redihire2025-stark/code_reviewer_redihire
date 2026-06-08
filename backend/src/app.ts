import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { apiRouter } from './routes/index.js';
import { apiRateLimit } from './middleware/rate-limit.js';
import { connectDatabase } from './database/client.js';

const app = express();

// ─── Security Middleware ──────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.set('trust proxy', 1);

// CORS: allow Netlify frontend + local development
// Accept any *.netlify.app origin automatically
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow no-origin requests (Postman, webhooks, health checks)
      if (!origin) return callback(null, true);

      // Allow explicit FRONTEND_URL if set
      const allowed = process.env.FRONTEND_URL;
      if (allowed && origin === allowed) return callback(null, true);

      // Allow any netlify.app subdomain
      if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin)) {
        return callback(null, true);
      }

      // Allow localhost for development
      if (/^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }

      // Block everything else
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature-256', 'X-GitHub-Event', 'X-GitHub-Delivery'],
    credentials: true,
  })
);

app.use(compression());

// ─── Body Parsing ─────────────────────────────────────────────
// Webhook route needs raw Buffer for HMAC signature validation
app.use('/api/github/webhook', express.raw({ type: 'application/json', limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));

// ─── Rate Limiting ────────────────────────────────────────────
app.use('/api', apiRateLimit);

// ─── Routes ──────────────────────────────────────────────────
app.use('/api', apiRouter);

// ─── Root health check (no /api prefix) ──────────────────────
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'Redihire Code Reviewer API' });
});

// ─── Error Handler ────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error({ err: err.message }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  }
);

// ─── Startup ──────────────────────────────────────────────────
async function start() {
  try {
    await connectDatabase();
    app.listen(config.port, '0.0.0.0', () => {
      logger.info({ port: config.port, env: config.nodeEnv }, 'Redihire Code Reviewer API running');
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

start();

export default app;
