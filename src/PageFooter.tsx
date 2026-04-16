import { SectionRenderer } from './widgets/SectionRenderer';
import type { PageArea } from './types';
import type { ContentEntry } from './hooks/usePages';

type PageFooterProps = {
  footerConfig?: PageArea;
  content?: ContentEntry[];
};

export function PageFooter({ footerConfig, content }: PageFooterProps) {
  if (!footerConfig) return null;

  const rootSection = {
    class_name: footerConfig.class_name,
    grid: footerConfig.grid,
    cols: footerConfig.cols,
    sections: footerConfig.sections,
  };

  return (
    <div className="planning-bottom">
      <SectionRenderer section={rootSection} content={content ?? []} />
    </div>
  );
}
