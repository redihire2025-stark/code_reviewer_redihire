import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import { format } from 'date-fns';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import { StatCard } from '../components/StatCard';
import { ScoreBadge } from '../components/ScoreBadge';
import styles from './Dashboard.module.css';

export function DashboardPage() {
  const stats = useAsync(() => api.getDashboardStats());
  const reviews = useAsync(() => api.getReviews(10));

  const trendData = (reviews.data ?? [])
    .filter((r) => r.overallScore !== null)
    .slice()
    .reverse()
    .map((r) => ({
      date: format(new Date(r.createdAt), 'MM/dd'),
      score: r.overallScore!,
      issues: r.criticalCount + r.highCount,
    }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Dashboard</h1>
        <p>Redihire Code Reviewer — AI-powered pull request analysis</p>
      </header>

      {stats.loading ? (
        <div className={styles.loading}>Loading stats...</div>
      ) : stats.error ? (
        <div className={styles.error}>Failed to load: {stats.error}</div>
      ) : (
        <div className={styles.statsGrid}>
          <StatCard
            label="Total Reviews"
            value={stats.data?.totalReviews ?? 0}
            icon="🔍"
            color="blue"
          />
          <StatCard
            label="Average Score"
            value={`${(stats.data?.averageScore ?? 0).toFixed(1)}/10`}
            icon="⭐"
            color="green"
          />
          <StatCard
            label="Critical Issues"
            value={stats.data?.totalCritical ?? 0}
            icon="🔴"
            color="red"
          />
        </div>
      )}

      <div className={styles.chartsRow}>
        <section className={styles.chartCard}>
          <h2>Score Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="date" tick={{ fill: '#8b949e', fontSize: 12 }} />
              <YAxis domain={[0, 10]} tick={{ fill: '#8b949e', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#58a6ff"
                strokeWidth={2}
                dot={{ r: 3, fill: '#58a6ff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className={styles.chartCard}>
          <h2>Issues Found</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="date" tick={{ fill: '#8b949e', fontSize: 12 }} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d' }}
              />
              <Bar dataKey="issues" fill="#f85149" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className={styles.recentReviews}>
        <h2>Recent Reviews</h2>
        {reviews.loading ? (
          <div className={styles.loading}>Loading reviews...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Repository</th>
                <th>PR</th>
                <th>Author</th>
                <th>Score</th>
                <th>Issues</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {(reviews.data ?? []).map((review) => (
                <tr key={review.id}>
                  <td className={styles.repo}>{review.pullRequest.repository.fullName}</td>
                  <td>
                    <a
                      href={review.pullRequest.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.prLink}
                    >
                      #{review.pullRequest.number}
                    </a>
                  </td>
                  <td className={styles.author}>{review.pullRequest.author}</td>
                  <td>
                    <ScoreBadge score={review.overallScore} />
                  </td>
                  <td>
                    <span className={styles.issueCount}>
                      {review.criticalCount > 0 && (
                        <span className={styles.critical}>🔴 {review.criticalCount}</span>
                      )}
                      {review.highCount > 0 && (
                        <span className={styles.high}>🟠 {review.highCount}</span>
                      )}
                      {review.mediumCount > 0 && (
                        <span className={styles.medium}>🟡 {review.mediumCount}</span>
                      )}
                    </span>
                  </td>
                  <td className={styles.date}>
                    {format(new Date(review.createdAt), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
