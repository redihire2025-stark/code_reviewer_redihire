import styles from './ScoreBadge.module.css';

interface ScoreBadgeProps {
  score: number | null;
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  if (score === null) return <span className={styles.pending}>—</span>;

  const color =
    score >= 8 ? 'green' : score >= 6 ? 'yellow' : score >= 4 ? 'orange' : 'red';

  return (
    <span className={`${styles.badge} ${styles[color]}`}>
      {score.toFixed(1)}
    </span>
  );
}
