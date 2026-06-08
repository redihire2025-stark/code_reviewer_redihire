import type { Request, Response } from 'express';
import { processPullRequest } from '../services/review.service.js';
import { logger } from '../utils/logger.js';
import type { GitHubWebhookPayload } from '../types/index.js';

const HANDLED_ACTIONS = new Set(['opened', 'synchronize', 'reopened']);

/**
 * Handle incoming GitHub webhook events.
 *
 * We respond immediately with 202 Accepted and process asynchronously.
 * GitHub expects a response within 10 seconds or it retries the webhook,
 * but AI review can take 30+ seconds for large PRs.
 */
export async function handleGitHubWebhook(req: Request, res: Response): Promise<void> {
  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'];

  logger.debug({ event, deliveryId }, 'Webhook received');

  // Only handle pull_request events
  if (event !== 'pull_request') {
    res.status(200).json({ message: `Event '${event}' acknowledged but not processed` });
    return;
  }

  const payload = req.body as GitHubWebhookPayload;

  // Only handle meaningful PR actions
  if (!HANDLED_ACTIONS.has(payload.action)) {
    logger.debug({ action: payload.action }, 'Ignoring PR action');
    res.status(200).json({ message: `Action '${payload.action}' not processed` });
    return;
  }

  // Skip draft PRs — reviewing drafts wastes tokens on incomplete work
  if (payload.pull_request.draft) {
    logger.debug({ pr: payload.number }, 'Skipping draft PR');
    res.status(200).json({ message: 'Draft PR skipped' });
    return;
  }

  // Acknowledge immediately — process async
  res.status(202).json({
    message: 'PR review queued',
    pr: payload.number,
    repository: payload.repository.full_name,
  });

  // Process without awaiting so we don't block the response
  processPullRequest(payload).catch((err) => {
    logger.error(
      { err, deliveryId, repo: payload.repository.full_name, pr: payload.number },
      'Unhandled error in PR processing'
    );
  });
}
