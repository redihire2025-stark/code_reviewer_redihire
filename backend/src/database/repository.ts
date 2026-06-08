import { prisma } from './client.js';
import type {
  ReviewResult,
  ReviewIssue,
  ReviewStatus,
} from '../types/index.js';

// ─── Repository ──────────────────────────────────────────────

export async function upsertRepository(params: {
  githubId: number | bigint;
  fullName: string;
  owner: string;
  name: string;
  installationId: number | bigint;
}) {
  return prisma.repository.upsert({
    where: { githubId: params.githubId },
    create: params,
    update: {
      installationId: params.installationId,
      fullName: params.fullName,
    },
  });
}

export async function getRepositoryByGithubId(githubId: number | bigint) {
  return prisma.repository.findUnique({ where: { githubId } });
}

// ─── Pull Request ────────────────────────────────────────────

export async function upsertPullRequest(params: {
  repositoryId: string;
  githubPrId: number | bigint;
  number: number;
  title: string;
  author: string;
  headSha: string;
  baseBranch: string;
  headBranch: string;
  state: string;
  htmlUrl: string;
  isDraft: boolean;
}) {
  return prisma.pullRequest.upsert({
    where: {
      repositoryId_number: {
        repositoryId: params.repositoryId,
        number: params.number,
      },
    },
    create: params,
    update: {
      headSha: params.headSha,
      state: params.state,
      title: params.title,
      isDraft: params.isDraft,
    },
  });
}

// ─── Review ──────────────────────────────────────────────────

export async function createReview(params: {
  pullRequestId: string;
  headSha: string;
}) {
  return prisma.review.create({
    data: {
      pullRequestId: params.pullRequestId,
      headSha: params.headSha,
      status: 'pending',
    },
  });
}

export async function findExistingReview(pullRequestId: string, headSha: string) {
  return prisma.review.findUnique({
    where: { pullRequestId_headSha: { pullRequestId, headSha } },
  });
}

export async function updateReviewStatus(reviewId: string, status: ReviewStatus) {
  return prisma.review.update({
    where: { id: reviewId },
    data: { status },
  });
}

export async function completeReview(params: {
  reviewId: string;
  result: ReviewResult;
  githubReviewId?: number;
  summaryBody: string;
  processingMs: number;
}) {
  const { reviewId, result, githubReviewId, summaryBody, processingMs } = params;
  const { summary, issues, tokensUsed } = result;

  const categoryCounts = issues.reduce(
    (acc, issue) => {
      const cat = issue.category;
      acc[cat] = (acc[cat] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return prisma.$transaction([
    prisma.review.update({
      where: { id: reviewId },
      data: {
        status: 'completed',
        overallScore: summary.overallScore,
        filesReviewed: summary.filesReviewed,
        totalComments: issues.length,
        criticalCount: summary.criticalCount,
        highCount: summary.highCount,
        mediumCount: summary.mediumCount,
        lowCount: summary.lowCount,
        summaryBody,
        githubReviewId,
        tokensUsed,
        processingMs,
        completedAt: new Date(),
      },
    }),
    prisma.reviewComment.createMany({
      data: issues.map((issue: ReviewIssue) => ({
        reviewId,
        filePath: issue.filePath,
        line: issue.line ?? null,
        severity: issue.severity,
        category: issue.category,
        problem: issue.problem,
        whyItMatters: issue.whyItMatters,
        suggestedFix: issue.suggestedFix,
        improvedCode: issue.improvedCode ?? null,
        learningInsight: issue.learningInsight,
      })),
    }),
    prisma.reviewMetrics.create({
      data: {
        reviewId,
        bugsFound: categoryCounts['Bugs'] ?? 0,
        tsIssues: categoryCounts['TypeScript'] ?? 0,
        reactIssues: categoryCounts['React'] ?? 0,
        perfIssues: categoryCounts['Performance'] ?? 0,
        securityIssues: categoryCounts['Security'] ?? 0,
        archIssues: categoryCounts['Architecture'] ?? 0,
        qualityIssues: categoryCounts['CodeQuality'] ?? 0,
        testingIssues: categoryCounts['Testing'] ?? 0,
        strengths: summary.strengths,
        improvements: summary.improvements,
        learningRecs: summary.learningRecommendations,
      },
    }),
  ]);
}

export async function failReview(reviewId: string, errorMessage: string) {
  return prisma.review.update({
    where: { id: reviewId },
    data: {
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
    },
  });
}

// ─── Dashboard Queries ───────────────────────────────────────

export async function getDashboardStats() {
  const [totalReviews, avgScore, criticalTotal, reviewsByStatus] =
    await Promise.all([
      prisma.review.count({ where: { status: 'completed' } }),
      prisma.review.aggregate({
        _avg: { overallScore: true },
        where: { status: 'completed' },
      }),
      prisma.review.aggregate({
        _sum: { criticalCount: true },
        where: { status: 'completed' },
      }),
      prisma.review.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

  return {
    totalReviews,
    averageScore: avgScore._avg.overallScore ?? 0,
    totalCritical: criticalTotal._sum.criticalCount ?? 0,
    reviewsByStatus,
  };
}

export async function getRecentReviews(limit = 20, offset = 0) {
  return prisma.review.findMany({
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    where: { status: 'completed' },
    include: {
      pullRequest: {
        include: { repository: { select: { fullName: true } } },
      },
      metrics: true,
    },
  });
}

export async function getRepositoryAnalytics(repositoryId: string) {
  const reviews = await prisma.review.findMany({
    where: {
      pullRequest: { repositoryId },
      status: 'completed',
    },
    include: { metrics: true, comments: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return reviews;
}

// ─── Coding Rules ────────────────────────────────────────────

export async function getCodingRules(repositoryId: string) {
  return prisma.codingRule.findUnique({ where: { repositoryId } });
}

export async function upsertCodingRules(params: {
  repositoryId: string;
  content: string;
  fileSha: string;
}) {
  return prisma.codingRule.upsert({
    where: { repositoryId: params.repositoryId },
    create: params,
    update: { content: params.content, fileSha: params.fileSha },
  });
}
