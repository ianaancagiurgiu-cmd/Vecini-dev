import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader } from '../components/ui.jsx';

export default function Admin() {
  const nav = useNavigate();
  const { data, t, isStaff, role } = useApp();
  if (!isStaff) return <Navigate to="/app" replace />;

  const pending = data.discussions.filter((d) => d.status === 'pending').length;
  const openIssues = data.issues.filter((i) => i.status !== 'resolved').length;
  const activePolls = data.polls.filter((p) => !p.closed && p.endsAt > Date.now()).length;

  const Stat = ({ n, label, tint }) => (
    <div style={{ flex: 1, background: tint.bg, borderRadius: 15, padding: '15px 14px' }}>
      <div className="display" style={{ fontSize: 27, color: tint.fg, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: tint.fg, marginTop: 4, opacity: .9 }}>{label}</div>
    </div>
  );

  const Item = ({ icon, label, sub, onClick, badge, adminOnly }) => (
    (adminOnly && role !== 'admin') ? null : (
      <button onClick={onClick} className="card" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{label}</div>
          <div className="faint" style={{ fontSize: 12.5, marginTop: 1 }}>{sub}</div>
        </div>
        {badge > 0 && <span style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999, background: 'var(--terracotta)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>}
        <span className="faint" style={{ fontSize: 18 }}>›</span>
      </button>
    )
  );

  return (
    <div className="screen">
      <ScreenHeader title={t('admin_title')} onBack={() => nav('/app')} kicker={role === 'admin' ? t('role_admin') : t('role_moderator')} />
      <div className="pad" style={{ paddingTop: 18 }}>
        {pending > 0 && (
          <div style={{ background: 'var(--status-prog-bg)', borderRadius: 14, padding: '13px 15px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--amber)' }}>{pending} {t('admin_pending')}.</span>
          </div>
        )}

        <div className="eyebrow" style={{ marginBottom: 10 }}>{t('admin_stats')}</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <Stat n={data.community.memberCount} label={t('admin_members')} tint={{ bg: 'var(--status-done-bg)', fg: 'var(--green-500)' }} />
          <Stat n={openIssues} label={t('dash_open_issues')} tint={{ bg: 'var(--status-prog-bg)', fg: 'var(--status-prog-fg)' }} />
          <Stat n={activePolls} label={t('dash_active_polls')} tint={{ bg: 'var(--status-new-bg)', fg: 'var(--status-new-fg)' }} />
        </div>
        {/* How many people have given up their account here. A number and
            nothing else: what is stored behind it is a community and a date,
            with no trace of who they were. Only shown once it is not zero, so
            it does not sit there as a permanent nought. */}
        {data.deletedAccounts > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <Stat n={data.deletedAccounts} label={t('admin_deleted_accounts')} tint={{ bg: 'var(--section-bg)', fg: 'var(--ink-400)' }} />
            <div style={{ flex: 2 }} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
          <Item icon="🛡️" label={t('admin_moderation')} sub={t('admin_mod_queue')} onClick={() => nav('/app/admin/moderation')} badge={pending} />
          <Item icon="👥" label={t('admin_members_title')} sub={`${data.members.length} ${t('admin_members')}`} onClick={() => nav('/app/admin/members')} adminOnly />
          <Item icon="⚙︎" label={t('admin_settings')} sub={data.community.code} onClick={() => nav('/app/admin/settings')} adminOnly />
        </div>
      </div>
    </div>
  );
}
