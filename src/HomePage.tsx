export function HomePage() {
  return (
    <div className="home-page">
      <a href="/" className="home-corner home-corner-left" title="Probo Hub">
        <img src="/img/probo.svg" alt="Probo" className="home-logo" />
      </a>
      <a href="/robotics" className="home-corner home-corner-right" title="Robotics">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="9" width="14" height="11" rx="2" />
          <path d="M12 9V5" />
          <circle cx="12" cy="3.5" r="1.5" />
          <path d="M5 13H3M21 13h-2" />
          <circle cx="9.5" cy="14" r="1.2" />
          <circle cx="14.5" cy="14" r="1.2" />
          <path d="M9 18h6" />
        </svg>
      </a>

      <h1 className="home-title">Probo Hub BETA</h1>
      <div className="home-login-card">
        <h2 className="home-login-heading">Account</h2>
        <label className="home-login-label">
          Email
          <input className="home-login-input" type="email" placeholder="ceesbolijn@probo.com" disabled />
        </label>
        <label className="home-login-label">
          Password
          <input className="home-login-input" type="password" placeholder="*******" disabled />
        </label>
        <button className="home-login-btn" disabled>Logged in</button>
      </div>
      <div className="home-buttons">
        <a href="/control-room" className="home-btn">Control Room</a>
        <a href="/production-lines" className="home-btn">Production Lines</a>
        <a href="/production-board" className="home-btn">Production Board</a>
        <a href="/inflow-manual" className="home-btn">Inflow</a>
      </div>
    </div>
  );
}
