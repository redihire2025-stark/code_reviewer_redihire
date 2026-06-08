import rateLimit from 'express-rate-limit';

/**
 * General API rate limit: 100 requests per 15 minutes per IP.
 * Applied to all non-webhook routes.
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

/**
 * Webhook rate limit: 300 webhooks per minute per IP.
 * GitHub sends webhooks from multiple IPs — this is intentionally generous.
 * The real protection is the HMAC signature validation.
 */
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded' },
});
