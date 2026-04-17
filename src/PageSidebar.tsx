import { useNavigate, useAuxOutlet } from '@s-flex/xfw-url';
import { getBlock } from 'xfw-get-block';
import { SidebarPanel } from './SidebarPanel';
import { usePages } from './hooks/usePages';
import type { MenuContentEntry } from './types';

type PageSidebarProps = {
  menuContent: Map<string, MenuContentEntry>;
};

function SidebarOutlet({ outlet, content }: { outlet: string; content: { code: string; block: Record<string, unknown> }[] }) {
  const navigate = useNavigate();
  const outletPath = useAuxOutlet({ outlet });

  if (!outletPath) return null;

  const code = outletPath.replace(/^\//, '');
  const title = getBlock(content, code, 'title');

  return (
    <SidebarPanel
      code={code}
      title={title}
      onClose={() => navigate(`(${outlet}:)`)}
    />
  );
}

export function PageSidebar({ menuContent }: PageSidebarProps) {
  const { content } = usePages();

  return (
    <>
      <SidebarOutlet outlet="sidebar" content={content} />
      <SidebarOutlet outlet="detail" content={content} />
    </>
  );
}
