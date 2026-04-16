import { useNavigate, useAuxOutlet } from '@s-flex/xfw-url';
import { useSidebar } from '@s-flex/xfw-ui';
import { getBlock } from 'xfw-get-block';
import { SidebarPanel } from './SidebarPanel';
import { usePages } from './hooks/usePages';
import type { MenuContentEntry } from './types';

type PageSidebarProps = {
  menuContent: Map<string, MenuContentEntry>;
};

function SidebarOutlet({ outlet, index, content }: { outlet: string; index: number; content: { code: string; block: Record<string, unknown>; }[]; }) {
  const navigate = useNavigate();
  const outletPath = useAuxOutlet({ outlet });
  const code = outletPath ? outletPath.replace(/^\//, '') : '';
  const title = code ? getBlock(content, code, 'title') : '';

  useSidebar({
    identifier: `outlet-${outlet}`,
    side: 'right',
    index,
    isVisible: !!outletPath,
    title,
    navs: [{ path: `(${outlet}:)` }],
    content: () => <SidebarPanel code={code} />,
    deps: [code, navigate],
  });

  return null;
}

export function PageSidebar({ menuContent: _menuContent }: PageSidebarProps) {
  const { content } = usePages();

  return (
    <>
      <SidebarOutlet outlet="sidebar" index={0} content={content} />
      <SidebarOutlet outlet="detail" index={1} content={content} />
    </>
  );
}
