import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import type { ReviewSummary } from '../types/index';
import styles from './DevInsights.module.css';

interface DeveloperStats {
  author: string;
  reviewCount: number;
  averageScore: number;
  topIssues: string[];
  topRecs: string[];
}

function computeDeveloperStats(reviews: ReviewSummary[]): DeveloperStats[] {
  const byAuthor = new Map<string, ReviewSummary[]>();
  for (const r of reviews) {
    const author = r.pullRequest.author;
    if (!byAuthor.has(author)) byAuthor.set(author, []);
    byAuthor.get(author)!.push(r);
  }

  return Array.from(byAuthor.entries())
    .map(([author, authorReviews]) => {
      const scored = authorReviews.filter((r) => r.overallScore !== null);
      const avg = scored.length
        ? scored.reduce((s, r) => s + r.overallScore!, 0) / scored.length
        : 0;

      // Collect all recommendations across reviews
      const allRecs = authorReviews.flatMap((r) => r.metrics?.learningRecs ?? []);
      const recCount = new Map<string, number>();
      for (const rec of allRecs) recCount.set(rec, (recCount.get(rec) ?? 0) + 1);
      const topRecs = Array.from(recCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([rec]) => rec);

      // Find most common issue improvements
      const allImprovements = authorReviews.flatMap((r) => r.metrics?.improvements ?? []);
      const topIssues = [...new Set(allImprovements)].slice(0, 3);

      return {
        author,
        reviewCount: authorReviews.length,
        averageScore: parseFloat(avg.toFixed(1)),
        topIssues,
        topRecs,
      };
    })
    .sort((a, b) => b.reviewCount - a.reviewCount);
}

export function DevInsightsPage() {
  const reviews = useAsync(() => api.getReviews(100));

  const developers = reviews.data ? computeDeveloperStats(reviews.data) : [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Developer Insights</h1>
        <p>Individual developer patterns, trends, and learning recommendations</p>
      </header>

      {reviews.loading && <div className={styles.loading}>Analyzing developer patterns...</div>}

      <div className={styles.devGrid}>
        {developers.map((dev) => (
          <article key={dev.author} className={styles.devCard}>
            <div className={styles.devHeader}>
              <div className={styles.avatar}>{dev.author[0].toUpperCase()}</div>
              <div>
                <div className={styles.devName}>{dev.author}</div>
                <div className={styles.devMeta}>
                  {dev.reviewCount} review{dev.reviewCount !== 1 ? 's' : ''} ·{' '}
                  avg score {dev.averageScore}/10
                </div>
              </div>
              <div
                className={`${styles.scorePill} ${
                  dev.averageScore >= 8
                    ? styles.green
                    : dev.averageScore >= 6
                    ? styles.yellow
                    : styles.red
                }`}
              >
                {dev.averageScore}
              </div>
            </div>

            {dev.topIssues.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>🔧 Areas to Improve</div>
                <ul className={styles.list}>
                  {dev.topIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {dev.topRecs.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>📚 Learning Recommendations</div>
                <ul className={styles.list}>
                  {dev.topRecs.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
