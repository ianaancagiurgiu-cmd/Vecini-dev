import { NavLink } from 'react-router-dom';
import { useApp } from '../state/store.jsx';

const Icon = ({ d, fill }) => (
  <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
    <path d={d} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill={fill ? 'currentColor' : 'none'} />
  </svg>
);

const items = [
  { to: '/app', end: true, key: 'nav_home', d: 'M3 10.5L12 3l9 7.5M5 9.5V20h14V9.5' },
  { to: '/app/announcements', key: 'nav_announcements', d: 'M4 8h11l4-3v14l-4-3H4zM4 8v6' },
  { to: '/app/discussions', key: 'nav_discussions', d: 'M4 5h16v10H9l-4 4V5z' },
  { to: '/app/issues', key: 'nav_issues', d: 'M12 3l9 16H3L12 3zM12 10v4M12 16.5v.5' },
  { to: '/app/polls', key: 'nav_polls', d: 'M5 21V10M12 21V4M19 21v-7' },
];

export default function BottomNav() {
  const { t } = useApp();
  return (
    <nav style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 100,
      background: 'rgba(250,247,240,.92)', backdropFilter: 'blur(14px)',
      borderTop: '1px solid var(--border)', display: 'flex',
      padding: '8px 6px calc(8px + env(safe-area-inset-bottom, 0px))',
    }}>
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end}
          style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '4px 0', color: isActive ? 'var(--green-600)' : 'var(--ink-300)',
            fontSize: 10.5, fontWeight: isActive ? 700 : 600, textDecoration: 'none',
          })}>
          {({ isActive }) => (<><Icon d={it.d} fill={isActive} />{t(it.key)}</>)}
        </NavLink>
      ))}
    </nav>
  );
}
