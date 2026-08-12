function StatusBar() {
  return (
    <div className="statusbar">
      <span className="statusbar__time">9:41</span>
      <span className="statusbar__icons" aria-hidden>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none"><rect x="0" y="7" width="3" height="5" rx="1" fill="#232620"/><rect x="4.5" y="4.5" width="3" height="7.5" rx="1" fill="#232620"/><rect x="9" y="2" width="3" height="10" rx="1" fill="#232620"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="#232620" opacity=".35"/></svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none"><path d="M8.5 2.5c2.3 0 4.4.9 6 2.4M8.5 2.5c-2.3 0-4.4.9-6 2.4M8.5 6.2c1.2 0 2.3.5 3.1 1.3M8.5 6.2c-1.2 0-2.3.5-3.1 1.3" stroke="#232620" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8.5" cy="10" r="1.1" fill="#232620"/></svg>
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="1" y="1" width="21" height="11" rx="3" stroke="#232620" strokeWidth="1.2" opacity=".5"/><rect x="2.5" y="2.5" width="16" height="8" rx="1.6" fill="#232620"/><rect x="23.5" y="4.5" width="1.6" height="4" rx=".8" fill="#232620" opacity=".5"/></svg>
      </span>
    </div>
  );
}

export function PhoneChrome({ children }) {
  return (
    <div className="stage">
      <div className="phone">
        <div className="phone__notch" />
        <StatusBar />
        <div className="phone__scroll">
          {children}
        </div>
      </div>
    </div>
  );
}
