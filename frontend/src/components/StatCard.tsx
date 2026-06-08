import styles from './StatCard.module.css';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  subtitle?: string;
}

export function StatCard({ label, value, icon, color = 'blue', subtitle }: StatCardProps) {
  return (
    <div className={`${styles.card} ${styles[color]}`}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.content}>
        <div className={styles.value}>{value}</div>
        <div className={styles.label}>{label}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
    </div>
  );
}
