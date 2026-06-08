import type { Octokit } from '@octokit/rest';
import type { GitHubFile, GitHubReviewComment } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Files matching these patterns are never reviewed.
// Reviewing generated/vendored files wastes tokens and produces noise.
const IGNORED_PATTERNS = [
  /^dist\//,
  /^build\//,
  /^coverage\//,
  /^node_modules\//,
  /^\.next\//,
  /^storybook-static\//,
  /^generated\//,
  /\.min\.(js|css)$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /^\.husky\//,
  /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
];

export function shouldIgnoreFile(filename: string): boolean {
  return IGNORED_PATTERNS.some((pattern) => pattern.test(filename));
}

/**
 * Fetch all changed files for a pull request, filtering out ignored paths.
 * GitHub paginates at 30 files per page — we handle up to 300 files.
 */
export async function getPullRequestFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<GitHubFile[]> {
  const allFiles: GitHubFile[] = [];
  let page = 1;

  while (page <= 10) {
    const { data } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 30,
      page,
    });

    if (data.length === 0) break;

    for (const file of data) {
      if (!shouldIgnoreFile(file.filename) && file.patch) {
        allFiles.push({
          filename: file.filename,
          status: file.status as GitHubFile['status'],
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch,
          sha: file.sha,
        });
      }
    }

    if (data.length < 30) break;
    page++;
  }

  logger.info(
    { owner, repo, pullNumber, fileCount: allFiles.length },
    'Fetched PR files'
  );

  return allFiles;
}

/**
 * Post a batch review to a pull request.
 * We use the Reviews API (not individual comment API) to batch all comments
 * into a single review event — this avoids notification spam and respects
 * GitHub's secondary rate limits.
 */
export async function postPullRequestReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  commitId: string,
  body: string,
  comments: GitHubReviewComment[]
): Promise<number> {
  const { data } = await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    commit_id: commitId,
    body,
    event: 'COMMENT',
    comments: comments.map((c) => ({
      path: c.path,
      position: c.position,
      body: c.body,
    })),
  });

  logger.info(
    { owner, repo, pullNumber, reviewId: data.id, commentCount: comments.length },
    'Posted GitHub review'
  );

  return data.id;
}

/**
 * Load repository-specific coding standards from .ai-review/rules.md.
 * Returns null if the file doesn't exist (most repos won't have it).
 */
export async function loadCustomRules(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<{ content: string; sha: string } | null> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: '.ai-review/rules.md',
    });

    if ('content' in data && data.encoding === 'base64') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { content, sha: data.sha };
    }
    return null;
  } catch (err: unknown) {
    // 404 is expected — most repos won't have custom rules
    if (isNotFoundError(err)) {
      return null;
    }
    logger.warn({ owner, repo, err }, 'Failed to load custom rules');
    return null;
  }
}

/**
 * Get diff position for a specific line in a GitHub patch.
 * GitHub uses "position" (1-indexed line count within the patch)
 * rather than actual file line numbers for review comments.
 */
export function getDiffPosition(patch: string, targetLine: number): number | undefined {
  const lines = patch.split('\n');
  let currentLine = 0;
  let position = 0;

  for (const line of lines) {
    position++;
    if (line.startsWith('@@')) {
      // Parse @@ -X,Y +A,B @@ header
      const match = line.match(/\+(\d+)/);
      if (match) {
        currentLine = parseInt(match[1], 10) - 1;
      }
      continue;
    }
    if (!line.startsWith('-')) {
      currentLine++;
    }
    if (currentLine === targetLine) {
      return position;
    }
  }

  return undefined;
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: number }).status === 404
  );
}
