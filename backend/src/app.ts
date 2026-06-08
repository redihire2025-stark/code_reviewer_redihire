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

app.use(helmet());
app.set('trust proxy', 1); // Required for rate limiting behind Render's proxy

// CORS: allow any Netlify subdomain + local development.
// For tighter security after deploy, replace the regex with your exact URL:
//   origin: ['https://your-app-name.netlify.app', 'http://localhost:5173']
const ALLOWED_ORIGIN = process.env.FRONTEND_URL;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);

      // Allow explicit FRONTEND_URL env var (set this on Render after Netlify deploy)
      if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) return callback(null, true);

      // Allow any netlify.app subdomain + localhost during development
      if (
        /^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin) ||
        /^http:\/\/localhost:\d+$/.test(origin)
      ) {
        return callback(null, true);
      }

      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(compression());

// ─── Body Parsing ─────────────────────────────────────────────
// CRITICAL: The webhook route must receive a raw Buffer for HMAC validation.
// We use express.raw() for /api/github/webhook and express.json() for everything else.
// The route-level raw middleware is applied inside the router where needed.

app.use('/api/github/webhook', express.raw({ type: 'application/json', limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));

// ─── Rate Limiting ────────────────────────────────────────────

app.use('/api', apiRateLimit);

// ─── Routes ──────────────────────────────────────────────────

app.use('/api', apiRouter);

// ─── Error Handler ────────────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error({ err: err.message, stack: err.stack }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  }
);

// ─── Startup ──────────────────────────────────────────────────

async function start() {
  try {
    await connectDatabase();

    app.listen(config.port, () => {
      logger.info(
        { port: config.port, env: config.nodeEnv },
        `AI PR Reviewer API running`
      );
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

start();

export default app;
