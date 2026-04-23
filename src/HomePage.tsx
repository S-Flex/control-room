export function HomePage() {
  return (
    <div className="home-page">
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
        <a href="/inflow-manual" className="home-btn">Inflow</a>
        <a href="/robotics" className="home-btn">Robotics</a>
      </div>
    </div>
  );
}
