import { getBlock } from 'xfw-get-block';
import type { UiLabel } from './types';

type PageFooterProps = {
  uiLabels: UiLabel[];
  offTrackCount: number;
};

export function PageFooter({ uiLabels, offTrackCount }: PageFooterProps) {
  return (
    <div className="planning-bottom">
      <div className="planning-bottom-inner">
        <div className="planning-off-track">
          {getBlock(uiLabels, 'off_track', 'title')}
          <span className="planning-badge">{offTrackCount}</span>
        </div>
      </div>
    </div>
  );
}
