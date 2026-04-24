import { SectionRenderer } from './widgets/SectionRenderer';
import { SidebarMeta, useSidebar } from '@s-flex/xfw-sidebar';
import type { PageArea } from './types';
import type { ContentEntry } from './hooks/usePages';

type PageFooterProps = {
  footerConfig?: PageArea;
  content?: ContentEntry[];
};

export function PageFooter({ footerConfig, content }: PageFooterProps) {
  if (!footerConfig) return null;

  useSidebar({
    identifier: 'production-lines-footer',
    side: 'bottom',
    index: 0,
    title: 'Footer',
    content: () => {
      const section = {
        class_name: footerConfig.class_name,
        grid: footerConfig.grid,
        cols: footerConfig.cols,
        sections: footerConfig.sections,
      };

      return (
        <>
          <SidebarMeta side="bottom" title="Footer" />
          <div className="planning-bottom">
            <SectionRenderer section={section} content={content ?? []} />
          </div>
        </>
      );
    },
    deps: [footerConfig, content],
  });

  return null;
}
