export function StatusBar() {
  return (
    <div className="sheet-status">
      <div className="status-item">
        <div className="status-icon teal">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round"/><circle cx="9" cy="7" r="4"/></svg>
        </div>
        <span className="status-label">Printer operators</span>
        <span className="status-value">4</span>
      </div>
      <div className="status-sep" />
      <div className="status-item">
        <div className="status-icon orange">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round"/><circle cx="9" cy="7" r="4"/></svg>
        </div>
        <span className="status-label">Cutter operators</span>
        <span className="status-value">3</span>
      </div>
      <div className="status-sep" />
      <div className="status-item">
        <div className="status-icon blue">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round"/><circle cx="9" cy="7" r="4"/></svg>
        </div>
        <span className="status-label">Binners</span>
        <span className="status-value">5</span>
      </div>
      <div className="status-sep" />
      <div className="status-item">
        <div className="status-icon sick">
          <svg viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round"/></svg>
        </div>
        <span className="status-label">Sick</span>
        <span className="status-value">2</span>
      </div>
    </div>
  );
}
