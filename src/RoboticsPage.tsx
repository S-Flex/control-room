import { useEffect } from 'react';
import { AppHeader } from './AppHeader';
import { PageHeader } from './PageHeader';

const VIDEO_ID = 'AE7BTELVAs4';

export function RoboticsPage() {
  useEffect(() => {
    document.title = 'Robotics';
  }, []);

  return (
    <div className="planning-page">
      <div className="planning-main">
        <AppHeader />
        <PageHeader>
          <h2 className="robotics-title">Robotics</h2>
        </PageHeader>
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
