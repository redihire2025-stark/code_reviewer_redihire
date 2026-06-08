import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Validates GitHub webhook HMAC-SHA256 signatures.
 *
 * Security design: we use timingSafeEqual to prevent timing attacks.
 * The raw body must be preserved as a Buffer (not parsed JSON) at this point —
 * this is why we use express.raw() on the webhook route, not express.json().
 *
 * GitHub sends: X-Hub-Signature-256: sha256=<hex_digest>
 */
export function validateWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature || typeof signature !== 'string') {
    logger.warn({ ip: req.ip }, 'Webhook received without signature');
    res.status(401).json({ error: 'Missing webhook signature' });
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    logger.error('Webhook body is not a Buffer — ensure express.raw() is used on this route');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  const expectedSignature = `sha256=${createHmac('sha256', config.github.webhookSecret)
    .update(req.body)
    .digest('hex')}`;

  // Use timingSafeEqual to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    logger.warn({ ip: req.ip }, 'Webhook signature length mismatch');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    logger.warn({ ip: req.ip }, 'Webhook signature verification failed');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  next();
}

/**
 * Parse the raw body Buffer into a JSON object.
 * Called after signature validation succeeds.
 */
export function parseWebhookBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (Buffer.isBuffer(req.body)) {
    req.body = JSON.parse(req.body.toString('utf-8'));
  }
  next();
}
