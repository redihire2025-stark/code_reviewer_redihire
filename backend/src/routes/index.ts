import { Router } from 'express';
import { validateWebhookSignature, parseWebhookBody } from '../webhooks/validator.js';
import { handleGitHubWebhook } from '../webhooks/handler.js';
import {
  getDashboardStats,
  getRecentReviews,
  getRepositoryAnalytics,
} from '../database/repository.js';
import { logger } from '../utils/logger.js';

export const apiRouter = Router();

// ─── GitHub Webhook ──────────────────────────────────────────

// IMPORTANT: express.raw() must be applied before this route in app.ts
// so req.body is a Buffer for signature validation.
apiRouter.post(
  '/github/webhook',
  validateWebhookSignature,
  parseWebhookBody,
  handleGitHubWebhook
);

// ─── Dashboard API ────────────────────────────────────────────

apiRouter.get('/dashboard/stats', async (_req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch dashboard stats');
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

apiRouter.get('/reviews', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const offset = parseInt(String(req.query.offset ?? '0'), 10);
    const reviews = await getRecentReviews(limit, offset);
    res.json(reviews);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch reviews');
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

apiRouter.get('/repositories/:id/analytics', async (req, res) => {
  try {
    const analytics = await getRepositoryAnalytics(req.params.id);
    res.json(analytics);
  } catch (err) {
    logger.error({ err, repositoryId: req.params.id }, 'Failed to fetch analytics');
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ─── Health Check ────────────────────────────────────────────

apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ai-pr-reviewer',
  });
});
