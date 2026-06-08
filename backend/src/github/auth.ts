import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Installation token cache: GitHub tokens are valid for 1 hour.
// We cache them to avoid re-generating on every webhook.
interface CachedToken {
  token: string;
  expiresAt: Date;
}

const tokenCache = new Map<number, CachedToken>();

/**
 * Get a cached installation token, refreshing if within 5 minutes of expiry.
 * This is the primary auth mechanism for all GitHub API calls against a repo.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  const now = new Date();

  // Use cached token if it has more than 5 minutes remaining
  if (cached && cached.expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return cached.token;
  }

  const auth = createAppAuth({
    appId: config.github.appId,
    privateKey: config.github.privateKey,
  });

  const { token, expiresAt } = await auth({
    type: 'installation',
    installationId,
  });

  tokenCache.set(installationId, {
    token,
    expiresAt: new Date(expiresAt),
  });

  logger.debug({ installationId, expiresAt }, 'Generated new installation token');
  return token;
}

/**
 * Create an authenticated Octokit instance for a specific installation.
 * All GitHub API calls should use this — never use a personal access token.
 */
export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const token = await getInstallationToken(installationId);
  return new Octokit({ auth: token });
}

/**
 * Clear cached token for an installation (useful if token is revoked).
 */
export function clearInstallationTokenCache(installationId: number): void {
  tokenCache.delete(installationId);
}
