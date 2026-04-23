import { useEffect } from 'react';

const VIDEO_ID = 'AE7BTELVAs4';

export function RoboticsPage() {
  useEffect(() => {
    document.title = 'Robotics';
  }, []);

  return (
    <div className="planning-page">
      <div className="planning-main">
        <header className="planning-header">
          <div className="planning-header-left">
            <a href="/" className="planning-home-btn" title="Home">
              <img src="/img/probo.svg" alt="Home" className="planning-home-logo" />
            </a>
            <h2 className="robotics-title">Robotics</h2>
          </div>
        </header>
        <div className="robotics-content">
          <div className="robotics-video-wrapper">
            <iframe
              className="robotics-video"
              src={`https://www.youtube.com/embed/${VIDEO_ID}`}
              title="Robotics"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
}
