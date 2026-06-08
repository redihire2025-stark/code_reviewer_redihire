import { formatIssueComment, buildSummaryBody } from '../../src/reviews/formatter';
import type { ReviewIssue, ReviewSummary } from '../../src/types/index';

const mockIssue: ReviewIssue = {
  severity: 'High',
  category: 'React',
  filePath: 'src/components/Game.tsx',
  line: 42,
  problem: 'Missing useEffect dependency array causes infinite loop',
  whyItMatters: 'The effect runs on every render, causing excessive API calls',
  suggestedFix: 'Add [score] to the dependency array',
  improvedCode: 'useEffect(() => { fetchData(); }, [score]);',
  learningInsight: 'Always specify dependencies to control when effects run',
};

const mockSummary: ReviewSummary = {
  overallScore: 7.5,
  filesReviewed: 3,
  criticalCount: 0,
  highCount: 1,
  mediumCount: 2,
  lowCount: 1,
  strengths: ['Good TypeScript types', 'Clear component names'],
  improvements: ['Add error handling', 'Extract magic numbers to constants'],
  learningRecommendations: ['Study React hooks best practices'],
};

describe('formatIssueComment', () => {
  it('includes severity emoji', () => {
    const comment = formatIssueComment(mockIssue);
    expect(comment).toContain('🟠'); // High severity
  });

  it('includes all required sections', () => {
    const comment = formatIssueComment(mockIssue);
    expect(comment).toContain('**Problem**');
    expect(comment).toContain('**Why It Matters**');
    expect(comment).toContain('**Suggested Fix**');
    expect(comment).toContain('**Learning Insight**');
  });

  it('includes improved code block when provided', () => {
    const comment = formatIssueComment(mockIssue);
    expect(comment).toContain('```typescript');
    expect(comment).toContain(mockIssue.improvedCode!);
  });

  it('omits code block when improvedCode is absent', () => {
    const issueWithoutCode = { ...mockIssue, improvedCode: undefined };
    const comment = formatIssueComment(issueWithoutCode);
    expect(comment).not.toContain('```typescript');
  });
});

describe('buildSummaryBody', () => {
  it('includes repo and PR number', () => {
    const body = buildSummaryBody(mockSummary, [mockIssue], 'acme/game', 42);
    expect(body).toContain('acme/game');
    expect(body).toContain('#42');
  });

  it('includes the overall score', () => {
    const body = buildSummaryBody(mockSummary, [mockIssue], 'acme/game', 42);
    expect(body).toContain('7.5/10');
  });

  it('includes strengths and improvements', () => {
    const body = buildSummaryBody(mockSummary, [mockIssue], 'acme/game', 42);
    expect(body).toContain('Good TypeScript types');
    expect(body).toContain('Add error handling');
  });

  it('uses green emoji for high scores', () => {
    const highScoreSummary = { ...mockSummary, overallScore: 9 };
    const body = buildSummaryBody(highScoreSummary, [], 'acme/game', 1);
    expect(body).toContain('🟢');
  });

  it('uses red emoji for low scores', () => {
    const lowScoreSummary = { ...mockSummary, overallScore: 2 };
    const body = buildSummaryBody(lowScoreSummary, [], 'acme/game', 1);
    expect(body).toContain('🔴');
  });
});
