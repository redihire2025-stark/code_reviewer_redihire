import pLimit from 'p-limit';
import { getInstallationOctokit } from '../github/auth.js';
import {
  getPullRequestFiles,
  postPullRequestReview,
  loadCustomRules,
} from '../github/service.js';
import { getAIProvider } from '../ai/index.js';
import { buildGitHubComments, buildSummaryBody } from '../reviews/formatter.js';
import {
  upsertRepository,
  upsertPullRequest,
  createReview,
  findExistingReview,
  updateReviewStatus,
  completeReview,
  failReview,
  getCodingRules,
  upsertCodingRules,
} from '../database/repository.js';
import { logger } from '../utils/logger.js';
import type { GitHubWebhookPayload, ProcessPRResult, FileToReview } from '../types/index.js';

// Limit concurrent PR reviews to prevent overwhelming Groq or GitHub API
const reviewConcurrencyLimiter = pLimit(5);

/**
 * Main entry point for processing a PR webhook event.
 *
 * Flow:
 * 1. Persist repository + PR data
 * 2. Check for duplicate review (idempotency by headSha)
 * 3. Fetch changed files from GitHub
 * 4. Load custom coding rules
 * 5. Send to Groq for analysis
 * 6. Post review to GitHub
 * 7. Persist results to database
 */
export async function processPullRequest(
  payload: GitHubWebhookPayload
): Promise<ProcessPRResult> {
  return reviewConcurrencyLimiter(async () => {
    const startTime = Date.now();
    const { pull_request: pr, repository: repo, installation } = payload;
    const [owner, repoName] = repo.full_name.split('/');

    logger.info(
      { repo: repo.full_name, pr: pr.number, sha: pr.head.sha, action: payload.action },
      'Processing PR webhook'
    );

    // Step 1: Persist repository and PR
    const dbRepo = await upsertRepository({
      githubId: BigInt(repo.id),
      fullName: repo.full_name,
      owner,
      name: repoName,
      installationId: BigInt(installation.id),
    });

    const dbPR = await upsertPullRequest({
      repositoryId: dbRepo.id,
      githubPrId: BigInt(pr.id),
      number: pr.number,
      title: pr.title,
      author: pr.user.login,
      headSha: pr.head.sha,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      state: pr.state,
      htmlUrl: pr.html_url,
      isDraft: pr.draft,
    });

    // Step 2: Idempotency check — don't re-review the same commit SHA
    const existingReview = await findExistingReview(dbPR.id, pr.head.sha);
    if (existingReview && existingReview.status === 'completed') {
      logger.info(
        { reviewId: existingReview.id, sha: pr.head.sha },
        'Review already exists for this SHA, skipping'
      );
      return {
        reviewId: existingReview.id,
        prNumber: pr.number,
        repository: repo.full_name,
        status: 'completed',
        score: existingReview.overallScore ?? undefined,
        commentsPosted: existingReview.totalComments,
      };
    }

    // Step 3: Create pending review record
    const review = await createReview({
      pullRequestId: dbPR.id,
      headSha: pr.head.sha,
    });

    await updateReviewStatus(review.id, 'processing');

    try {
      // Step 4: Get authenticated Octokit for this installation
      const octokit = await getInstallationOctokit(installation.id);

      // Step 5: Fetch changed files
      const files = await getPullRequestFiles(octokit, owner, repoName, pr.number);

      if (files.length === 0) {
        logger.info({ repo: repo.full_name, pr: pr.number }, 'No reviewable files found');
        await failReview(review.id, 'No reviewable files found in this PR');
        return {
          reviewId: review.id,
          prNumber: pr.number,
          repository: repo.full_name,
          status: 'failed',
          commentsPosted: 0,
        };
      }

      // Step 6: Load custom coding rules (from .ai-review/rules.md)
      const customRules = await loadAndCacheCustomRules(
        octokit,
        owner,
        repoName,
        dbRepo.id
      );

      // Step 7: Send to Groq for analysis
      const aiProvider = getAIProvider();
      const reviewFiles: FileToReview[] = files.map((f) => ({
        path: f.filename,
        patch: f.patch ?? '',
        additions: f.additions,
        deletions: f.deletions,
      }));

      const aiResult = await aiProvider.reviewCode({
        repository: repo.full_name,
        prNumber: pr.number,
        prTitle: pr.title,
        author: pr.user.login,
        files: reviewFiles,
        customRules: customRules ?? undefined,
      });

      // Step 8: Build GitHub-formatted comments
      const filePatchMap = new Map(files.map((f) => [f.filename, f.patch ?? '']));
      const githubComments = buildGitHubComments(aiResult.issues, filePatchMap);

      const summaryBody = buildSummaryBody(
        aiResult.summary,
        aiResult.issues,
        repo.full_name,
        pr.number
      );

      // Step 9: Post review to GitHub
      let githubReviewId: number | undefined;
      try {
        githubReviewId = await postPullRequestReview(
          octokit,
          owner,
          repoName,
          pr.number,
          pr.head.sha,
          summaryBody,
          githubComments
        );
      } catch (githubErr) {
        // Don't fail the whole review if GitHub posting fails
        // The results are still valuable and stored in DB
        logger.error(
          { err: githubErr, repo: repo.full_name, pr: pr.number },
          'Failed to post GitHub review — results stored in DB only'
        );
      }

      // Step 10: Persist results to database
      const processingMs = Date.now() - startTime;
      await completeReview({
        reviewId: review.id,
        result: aiResult,
        githubReviewId,
        summaryBody,
        processingMs,
      });

      logger.info(
        {
          repo: repo.full_name,
          pr: pr.number,
          score: aiResult.summary.overallScore,
          issues: aiResult.issues.length,
          processingMs,
          tokensUsed: aiResult.tokensUsed,
        },
        'PR review completed'
      );

      return {
        reviewId: review.id,
        prNumber: pr.number,
        repository: repo.full_name,
        status: 'completed',
        score: aiResult.summary.overallScore,
        commentsPosted: githubComments.length,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(
        { err, repo: repo.full_name, pr: pr.number },
        'PR review failed'
      );
      await failReview(review.id, errorMessage);

      return {
        reviewId: review.id,
        prNumber: pr.number,
        repository: repo.full_name,
        status: 'failed',
        commentsPosted: 0,
      };
    }
  });
}

/**
 * Load and cache custom rules from the repository.
 * We check the DB cache first (using file SHA for invalidation)
 * before hitting the GitHub API.
 */
async function loadAndCacheCustomRules(
  octokit: ReturnType<typeof getInstallationOctokit> extends Promise<infer T> ? T : never,
  owner: string,
  repo: string,
  repositoryId: string
): Promise<string | null> {
  const rulesFromGitHub = await loadCustomRules(octokit, owner, repo);

  if (!rulesFromGitHub) {
    return null;
  }

  // Check if we already have the latest version cached
  const cached = await getCodingRules(repositoryId);
  if (cached && cached.fileSha === rulesFromGitHub.sha) {
    return cached.content;
  }

  // Cache the new version
  await upsertCodingRules({
    repositoryId,
    content: rulesFromGitHub.content,
    fileSha: rulesFromGitHub.sha,
  });

  return rulesFromGitHub.content;
}
