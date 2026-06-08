import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useAsync } from '../hooks/useAsync';
import { api } from '../services/api';
import styles from './Analytics.module.css';

export function AnalyticsPage() {
  const reviews = useAsync(() => api.getReviews(50));

  const categoryData = () => {
    if (!reviews.data) return [];
    const totals = {
      Bugs: 0, TypeScript: 0, React: 0, Performance: 0,
      Security: 0, Architecture: 0, 'Code Quality': 0, Testing: 0,
    };
    for (const r of reviews.data) {
      if (r.metrics) {
        totals.Bugs += r.metrics.bugsFound;
        totals.TypeScript += r.metrics.tsIssues;
        totals.React += r.metrics.reactIssues;
        totals.Performance += r.metrics.perfIssues;
        totals.Security += r.metrics.securityIssues;
        totals.Architecture += r.metrics.archIssues;
        totals['Code Quality'] += r.metrics.qualityIssues;
        totals.Testing += r.metrics.testingIssues;
      }
    }
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  };

  const scoreDistribution = () => {
    if (!reviews.data) return [];
    const buckets: Record<string, number> = {
      '9-10': 0, '7-9': 0, '5-7': 0, '3-5': 0, '0-3': 0,
    };
    for (const r of reviews.data) {
      const s = r.overallScore ?? 0;
      if (s >= 9) buckets['9-10']++;
      else if (s >= 7) buckets['7-9']++;
      else if (s >= 5) buckets['5-7']++;
      else if (s >= 3) buckets['3-5']++;
      else buckets['0-3']++;
    }
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Repository Analytics</h1>
        <p>Common issues and patterns across all reviewed PRs</p>
      </header>

      {reviews.loading && <div className={styles.loading}>Analyzing reviews...</div>}

      {!reviews.loading && (
        <div className={styles.grid}>
          <section className={styles.chartCard}>
            <h2>Issues by Category</h2>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={categoryData()}>
                <PolarGrid stroke="#21262d" />
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fill: '#8b949e', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d' }}
                />
                <Radar dataKey="value" stroke="#58a6ff" fill="#58a6ff" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </section>

          <section className={styles.chartCard}>
            <h2>Score Distribution</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={scoreDistribution()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="range" tick={{ fill: '#8b949e', fontSize: 12 }} />
                <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d' }}
                />
                <Bar dataKey="count" fill="#3fb950" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className={`${styles.chartCard} ${styles.fullWidth}`}>
            <h2>Category Breakdown</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData()} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#8b949e', fontSize: 12 }} width={100} />
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d' }}
                />
                <Bar dataKey="value" fill="#d29922" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>
      )}
    </div>
  );
}
