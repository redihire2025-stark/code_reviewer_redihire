import { z } from 'zod';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type {
  AIProvider,
  ReviewPayload,
  ReviewResult,
  ReviewIssue,
  ReviewSummary,
  FileToReview,
} from '../types/index.js';

// ─── Response Schema Validation ──────────────────────────────
// We validate all AI responses with Zod to catch malformed outputs
// before they corrupt the database or cause runtime errors.

const IssueSchema = z.object({
  severity: z.enum(['Critical', 'High', 'Medium', 'Low']),
  category: z.enum([
    'Bugs',
    'TypeScript',
    'React',
    'Performance',
    'Security',
    'Architecture',
    'CodeQuality',
    'Testing',
  ]),
  filePath: z.string(),
  line: z.number().optional(),
  problem: z.string().min(1),
  whyItMatters: z.string().min(1),
  suggestedFix: z.string().min(1),
  improvedCode: z.string().optional(),
  learningInsight: z.string().min(1),
});

const SummarySchema = z.object({
  overallScore: z.number().min(0).max(10),
  filesReviewed: z.number(),
  criticalCount: z.number(),
  highCount: z.number(),
  mediumCount: z.number(),
  lowCount: z.number(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  learningRecommendations: z.array(z.string()),
});

const ReviewResponseSchema = z.object({
  issues: z.array(IssueSchema),
  summary: SummarySchema,
});

// ─── Chunking ────────────────────────────────────────────────
// Groq has context window limits. We estimate tokens at ~4 chars/token
// and split large PRs into chunks of at most MAX_CHUNK_CHARS characters.
const MAX_CHUNK_CHARS = 32_000; // ~8000 tokens
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─── Groq Provider Implementation ───────────────────────────

export class GroqProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiKey = config.groq.apiKey;
    this.model = config.groq.model;
  }

  async reviewCode(payload: ReviewPayload): Promise<ReviewResult> {
    const chunks = this.chunkFiles(payload.files);
    logger.info(
      { repo: payload.repository, pr: payload.prNumber, chunks: chunks.length },
      'Starting Groq review'
    );

    const allIssues: ReviewIssue[] = [];
    let totalTokens = 0;

    // Review each chunk independently, then merge results
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logger.debug(
        { chunk: i + 1, total: chunks.length, files: chunk.length },
        'Reviewing chunk'
      );

      const chunkResult = await this.reviewChunk(payload, chunk);
      allIssues.push(...chunkResult.issues);
      totalTokens += chunkResult.tokensUsed;
    }

    // Build the summary after merging all chunk results
    const summary = this.buildSummary(allIssues, payload.files.length);

    return { issues: allIssues, summary, tokensUsed: totalTokens };
  }

  private chunkFiles(files: FileToReview[]): FileToReview[][] {
    const chunks: FileToReview[][] = [];
    let currentChunk: FileToReview[] = [];
    let currentChunkSize = 0;

    for (const file of files) {
      const fileSize = (file.patch ?? '').length;

      if (currentChunkSize + fileSize > MAX_CHUNK_CHARS && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentChunkSize = 0;
      }

      // If a single file exceeds the limit, truncate its patch
      const patch =
        fileSize > MAX_CHUNK_CHARS
          ? file.patch.slice(0, MAX_CHUNK_CHARS) + '\n... [truncated]'
          : file.patch;

      currentChunk.push({ ...file, patch });
      currentChunkSize += patch.length;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [[]];
  }

  private async reviewChunk(
    payload: ReviewPayload,
    files: FileToReview[]
  ): Promise<{ issues: ReviewIssue[]; tokensUsed: number }> {
    const systemPrompt = this.buildSystemPrompt(payload.customRules);
    const userPrompt = this.buildUserPrompt(payload, files);

    const rawResponse = await this.callGroqWithRetry(systemPrompt, userPrompt);

    const parsed = this.parseResponse(rawResponse.content);
    return { issues: parsed.issues, tokensUsed: rawResponse.tokensUsed };
  }

  private buildSystemPrompt(customRules?: string): string {
    return `You are a Senior Software Engineer and code reviewer specializing in React, TypeScript, Zustand, React Three Fiber, educational games, state machines, and animation flows.

Your role is to be a mentor, not just a bug-finder. Every issue must be educational, teaching the developer WHY something is wrong and HOW to fix it properly.

## Review Domains
- **Bugs**: Logic issues, runtime errors, edge cases, state synchronization
- **TypeScript**: Unsafe any, missing types, poor interfaces, type safety
- **React**: Hook dependencies, memory leaks, unnecessary re-renders, anti-patterns
- **Performance**: Expensive loops, redundant calculations, rendering inefficiencies
- **Security**: Exposed secrets, injection vulnerabilities, unsafe inputs
- **Architecture**: Separation of concerns, reusability, scalability
- **CodeQuality**: Naming, readability, duplication, complexity
- **Testing**: Missing tests, missing edge cases

## Specialized Detection
Watch especially for:
- Zustand misuse or incorrect state mutations
- Prompt flow issues in educational games
- Reinforcement logic / game progression issues
- Audio sequencing problems
- Incorrect React Three Fiber patterns (missing dispose, geometry reuse)
- Memory leaks in useEffect without cleanup
- Race conditions in async state updates

${customRules ? `## Repository-Specific Rules\n${customRules}\n` : ''}

## Response Format
You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.

Return this exact structure:
{
  "issues": [
    {
      "severity": "Critical | High | Medium | Low",
      "category": "Bugs | TypeScript | React | Performance | Security | Architecture | CodeQuality | Testing",
      "filePath": "path/to/file.tsx",
      "line": 42,
      "problem": "Clear description of the problem",
      "whyItMatters": "Why this is problematic and consequences",
      "suggestedFix": "How to fix it",
      "improvedCode": "// Fixed code example",
      "learningInsight": "The underlying principle or pattern to learn"
    }
  ],
  "summary": {
    "overallScore": 7.5,
    "filesReviewed": 3,
    "criticalCount": 0,
    "highCount": 1,
    "mediumCount": 3,
    "lowCount": 2,
    "strengths": ["Good TypeScript usage", "Clean component structure"],
    "improvements": ["Add error boundaries", "Improve test coverage"],
    "learningRecommendations": ["Study React.memo usage", "Learn Zustand selectors"]
  }
}

Only include real issues you find. If the code is good, return an empty issues array with a high score.`;
  }

  private buildUserPrompt(payload: ReviewPayload, files: FileToReview[]): string {
    const fileList = files
      .map(
        (f) =>
          `### File: ${f.path}\n(+${f.additions} -${f.deletions})\n\`\`\`diff\n${f.patch}\n\`\`\``
      )
      .join('\n\n');

    return `Review this pull request:

**Repository**: ${payload.repository}
**PR #${payload.prNumber}**: ${payload.prTitle}
**Author**: ${payload.author}

## Changed Files

${fileList}

Provide a thorough educational review. Focus on issues that genuinely matter — avoid nitpicking trivial style issues unless they create real problems.`;
  }

  private async callGroqWithRetry(
    systemPrompt: string,
    userPrompt: string,
    maxRetries = 3
  ): Promise<{ content: string; tokensUsed: number }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 4096,
            temperature: 0.2, // Low temperature for consistent, factual reviews
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();

          // Rate limited — wait and retry
          if (response.status === 429) {
            const retryAfter = parseInt(
              response.headers.get('retry-after') ?? '5',
              10
            );
            logger.warn(
              { attempt, retryAfter },
              'Groq rate limited, waiting...'
            );
            await sleep(retryAfter * 1000);
            continue;
          }

          throw new Error(`Groq API error ${response.status}: ${errorBody}`);
        }

        const data = (await response.json()) as GroqResponse;
        const content = data.choices[0]?.message?.content ?? '';
        const tokensUsed = data.usage?.total_tokens ?? 0;

        return { content, tokensUsed };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn(
          { attempt, maxRetries, error: lastError.message },
          'Groq request failed, retrying...'
        );

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          await sleep(Math.pow(2, attempt - 1) * 1000);
        }
      }
    }

    throw lastError ?? new Error('Groq request failed after all retries');
  }

  private parseResponse(content: string): { issues: ReviewIssue[]; summary: ReviewSummary } {
    // Strip any markdown code fences the model might add despite instructions
    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let raw: unknown;
    try {
      raw = JSON.parse(cleaned);
    } catch {
      logger.error({ content: cleaned.slice(0, 500) }, 'Failed to parse Groq response as JSON');
      // Return empty result rather than crashing the whole review
      return {
        issues: [],
        summary: {
          overallScore: 5,
          filesReviewed: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          strengths: [],
          improvements: ['AI review failed to parse — manual review recommended'],
          learningRecommendations: [],
        },
      };
    }

    const result = ReviewResponseSchema.safeParse(raw);
    if (!result.success) {
      logger.warn({ errors: result.error.errors }, 'Groq response failed schema validation');
      // Try to salvage what we can
      const partial = raw as Record<string, unknown>;
      return {
        issues: [],
        summary: {
          overallScore: 5,
          filesReviewed: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          strengths: [],
          improvements: ['AI review response was malformed — partial results only'],
          learningRecommendations: [],
          ...(typeof partial.summary === 'object' ? partial.summary : {}),
        } as ReviewSummary,
      };
    }

    return result.data;
  }

  private buildSummary(issues: ReviewIssue[], filesReviewed: number): ReviewSummary {
    const criticalCount = issues.filter((i) => i.severity === 'Critical').length;
    const highCount = issues.filter((i) => i.severity === 'High').length;
    const mediumCount = issues.filter((i) => i.severity === 'Medium').length;
    const lowCount = issues.filter((i) => i.severity === 'Low').length;

    // Score algorithm: start at 10, deduct for issues
    const score = Math.max(
      0,
      10 - criticalCount * 2.5 - highCount * 1.5 - mediumCount * 0.5 - lowCount * 0.1
    );

    return {
      overallScore: parseFloat(score.toFixed(1)),
      filesReviewed,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      strengths: [],
      improvements: [],
      learningRecommendations: [],
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

interface GroqResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { total_tokens: number };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
