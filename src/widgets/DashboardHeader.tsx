import { useEffect, useState } from 'react';

export function DashboardHeader({ className = '' }: { className?: string }) {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`dashboard-header ${className}`}>
      <div className="dashboard-header-left">
        <a href="/" className="planning-home-btn" title="Home">
          <img src="/img/probo.svg" alt="Home" className="planning-home-logo" />
        </a>
        <div>
          <div className="header-title">Control Room</div>
          <div className="header-subtitle">Production floor overview</div>
        </div>
      </div>
      <div className="header-right">
        <div className="header-date">{date}</div>
        <div className="header-clock">{time}</div>
      </div>
    </div>
  );
}
