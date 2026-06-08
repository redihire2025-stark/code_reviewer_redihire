export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface DashboardStats {
  totalReviews: number;
  averageScore: number;
  totalCritical: number;
  reviewsByStatus: Array<{ status: string; _count: { status: number } }>;
}

export interface ReviewSummary {
  id: string;
  headSha: string;
  status: string;
  overallScore: number | null;
  filesReviewed: number;
  totalComments: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  summaryBody: string | null;
  processingMs: number | null;
  createdAt: string;
  completedAt: string | null;
  pullRequest: {
    number: number;
    title: string;
    author: string;
    htmlUrl: string;
    repository: { fullName: string };
  };
  metrics: {
    bugsFound: number;
    tsIssues: number;
    reactIssues: number;
    perfIssues: number;
    securityIssues: number;
    archIssues: number;
    qualityIssues: number;
    testingIssues: number;
    strengths: string[];
    improvements: string[];
    learningRecs: string[];
  } | null;
}

export interface RepositoryAnalytics {
  reviews: ReviewSummary[];
  commonIssues: Record<string, number>;
  averageScore: number;
  trend: Array<{ date: string; score: number }>;
}
