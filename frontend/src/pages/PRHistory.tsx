import { useState } from 'react';
import { format } from 'date-fns';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { ScoreBadge } from '../components/ScoreBadge';
import styles from './PRHistory.module.css';

export function PRHistoryPage() {
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const reviews = useAsync(() => api.getReviews(LIMIT, offset), [offset]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Pull Request Reviews</h1>
        <p>Complete AI review history — powered by Redihire</p>
      </header>

      {reviews.loading && <div className={styles.loading}>Loading reviews...</div>}
      {reviews.error && <div className={styles.error}>{reviews.error}</div>}

      {!reviews.loading && (
        <>
          <div className={styles.reviewList}>
            {(reviews.data ?? []).map((review) => (
              <article key={review.id} className={styles.reviewCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.prInfo}>
                    <span className={styles.repo}>
                      {review.pullRequest.repository.fullName}
                    </span>
                    <a
                      href={review.pullRequest.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.prTitle}
                    >
                      #{review.pullRequest.number} — {review.pullRequest.title}
                    </a>
                  </div>
                  <ScoreBadge score={review.overallScore} />
                </div>

                <div className={styles.cardMeta}>
                  <span>👤 {review.pullRequest.author}</span>
                  <span>📁 {review.filesReviewed} files</span>
                  <span>💬 {review.totalComments} comments</span>
                  {review.processingMs && (
                    <span>⏱ {(review.processingMs / 1000).toFixed(1)}s</span>
                  )}
                  <span>📅 {format(new Date(review.createdAt), 'MMM d, yyyy HH:mm')}</span>
                </div>

                <div className={styles.issueCounts}>
                  {review.criticalCount > 0 && (
                    <span className={styles.critical}>
                      🔴 {review.criticalCount} Critical
                    </span>
                  )}
                  {review.highCount > 0 && (
                    <span className={styles.high}>🟠 {review.highCount} High</span>
                  )}
                  {review.mediumCount > 0 && (
                    <span className={styles.medium}>🟡 {review.mediumCount} Medium</span>
                  )}
                  {review.lowCount > 0 && (
                    <span className={styles.low}>🔵 {review.lowCount} Low</span>
                  )}
                </div>

                {review.metrics?.strengths && review.metrics.strengths.length > 0 && (
                  <div className={styles.strengths}>
                    <strong>✅ Strengths:</strong>{' '}
                    {review.metrics.strengths.slice(0, 2).join(' · ')}
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            >
              ← Previous
            </button>
            <span className={styles.pageInfo}>
              Showing {offset + 1}–{offset + (reviews.data?.length ?? 0)}
            </span>
            <button
              className={styles.pageBtn}
              disabled={(reviews.data?.length ?? 0) < LIMIT}
              onClick={() => setOffset(offset + LIMIT)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
