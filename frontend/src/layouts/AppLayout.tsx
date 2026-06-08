import { NavLink, Outlet } from 'react-router-dom';
import styles from './AppLayout.module.css';

const NAV_LINKS = [
  { to: '/', label: '📊 Dashboard', end: true },
  { to: '/reviews', label: '🔍 PR Reviews' },
  { to: '/analytics', label: '📈 Analytics' },
  { to: '/insights', label: '💡 Dev Insights' },
];

export function AppLayout() {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🤖</span>
          <span className={styles.logoText}>AI Reviewer</span>
        </div>
        <nav className={styles.nav}>
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
