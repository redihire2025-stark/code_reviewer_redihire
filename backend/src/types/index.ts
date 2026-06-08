// ============================================================
// Core domain types for the AI PR Reviewer platform
// ============================================================

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export type ReviewCategory =
  | 'Bugs'
  | 'TypeScript'
  | 'React'
  | 'Performance'
  | 'Security'
  | 'Architecture'
  | 'CodeQuality'
  | 'Testing';

export type ReviewStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ─── AI Provider Abstraction ────────────────────────────────

/**
 * A single issue found during code review.
 * Designed for educational output — every field must be populated.
 */
export interface ReviewIssue {
  severity: Severity;
  category: ReviewCategory;
  filePath: string;
  line?: number; // The line number in the diff (position) for inline comments
  problem: string;
  whyItMatters: string;
  suggestedFix: string;
  improvedCode?: string;
  learningInsight: string;
}

export interface ReviewSummary {
  overallScore: number; // 0-10
  filesReviewed: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  strengths: string[];
  improvements: string[];
  learningRecommendations: string[];
}

export interface ReviewResult {
  issues: ReviewIssue[];
  summary: ReviewSummary;
  tokensUsed: number;
}

/**
 * Provider abstraction. Only Groq is implemented; others can be added
 * by implementing this interface and registering in src/ai/index.ts
 */
export interface AIProvider {
  reviewCode(payload: ReviewPayload): Promise<ReviewResult>;
}

export interface ReviewPayload {
  repository: string;
  prNumber: number;
  prTitle: string;
  author: string;
  files: FileToReview[];
  customRules?: string; // Content of .ai-review/rules.md
}

export interface FileToReview {
  path: string;
  patch: string; // Raw git diff patch
  additions: number;
  deletions: number;
}

// ─── GitHub Types ────────────────────────────────────────────

export interface GitHubWebhookPayload {
  action: 'opened' | 'synchronize' | 'reopened' | 'closed';
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: string;
    draft: boolean;
    html_url: string;
    head: { sha: string; ref: string };
    base: { ref: string };
    user: { login: string };
  };
  repository: {
    id: number;
    full_name: string;
    name: string;
    owner: { login: string };
    private: boolean;
  };
  installation: { id: number };
}

export interface GitHubFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  sha: string;
}

export interface GitHubReviewComment {
  path: string;
  position?: number;
  body: string;
}

export interface GitHubReviewRequest {
  commit_id: string;
  body: string;
  event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';
  comments: GitHubReviewComment[];
}

// ─── Service Response Types ──────────────────────────────────

export interface ProcessPRResult {
  reviewId: string;
  prNumber: number;
  repository: string;
  status: ReviewStatus;
  score?: number;
  commentsPosted: number;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  github: {
    appId: string;
    privateKey: string;
    webhookSecret: string;
  };
  groq: {
    apiKey: string;
    model: string;
  };
}
