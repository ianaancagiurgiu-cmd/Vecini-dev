import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { LangSwitch } from '../components/ui.jsx';
import { PRIVACY } from '../i18n/privacy.js';
import { OPERATOR_NAME, CONTACT_EMAIL, POLICY_UPDATED } from '../lib/legal.js';
import { formatDate } from '../lib/format.js';

/*
  Politica de confidențialitate.

  Reachable signed out as much as signed in: the moment somebody most wants
  to read it is before they have handed anything over, on the sign-up form.
  So it lives outside /app, needs no session, and goes back to wherever it
  was opened from rather than to a fixed screen.
*/

// The address is a link, wherever the text mentions it.
function withEmail(text) {
  const parts = text.split('{email}');
  return parts.flatMap((part, i) => (i === 0 ? [part] : [
    <a key={i} href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--green-600)', fontWeight: 600 }}>{CONTACT_EMAIL}</a>,
    part,
  ]));
}
const fill = (text) => withEmail(text.replaceAll('{operator}', OPERATOR_NAME));

export default function Privacy() {
  const nav = useNavigate();
  const loc = useLocation();
  const { lang } = useApp();
  const doc = PRIVACY[lang] || PRIVACY.ro;

  // Opened from inside the app or from a form: back is back. Arrived on its
  // own (a link from elsewhere, a fresh tab): back is the start.
  const back = () => (loc.key !== 'default' ? nav(-1) : nav('/'));

  return (
    <div className="screen screen-anim" style={{ paddingBottom: 40 }}>
      <div className="pad" style={{ paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={back} aria-label="←"
          style={{ background: 'none', border: 'none', color: 'var(--green-600)', padding: '8px 0', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <LangSwitch />
      </div>

      <article className="pad" style={{ paddingTop: 10 }}>
        <h1 className="display" style={{ fontSize: 28, margin: '0 0 6px' }}>{doc.title}</h1>
        <div className="faint" style={{ fontSize: 13, marginBottom: 18 }}>{doc.updated}: {formatDate(new Date(POLICY_UPDATED).getTime(), lang)}</div>
        <p style={{ fontSize: 15.5, lineHeight: 1.55, margin: '0 0 8px', fontWeight: 600, color: 'var(--green-ink)' }}>{doc.intro}</p>

        {doc.sections.map((sec) => (
          <section key={sec.h} style={{ marginTop: 22 }}>
            <h2 className="serif" style={{ fontSize: 19, fontWeight: 600, margin: '0 0 8px' }}>{sec.h}</h2>
            {(sec.p || []).map((text, i) => (
              <p key={i} style={{ fontSize: 14.5, lineHeight: 1.6, margin: '0 0 10px', color: '#3f433b' }}>{fill(text)}</p>
            ))}
            {sec.list && (
              <ul style={{ margin: '0 0 10px', paddingLeft: 20 }}>
                {sec.list.map((text, i) => (
                  <li key={i} style={{ fontSize: 14.5, lineHeight: 1.55, marginBottom: 6, color: '#3f433b' }}>{fill(text)}</li>
                ))}
              </ul>
            )}
            {(sec.after || []).map((text, i) => (
              <p key={i} style={{ fontSize: 14.5, lineHeight: 1.6, margin: '0 0 10px', color: '#3f433b' }}>{fill(text)}</p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
