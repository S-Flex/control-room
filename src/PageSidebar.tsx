import { useNavigate, useAuxOutlet } from 'xfw-url';
import { getBlock } from 'xfw-get-block';
import { SidebarPanel } from './SidebarPanel';
import type { MenuContentEntry } from './types';

type PageSidebarProps = {
  menuContent: Map<string, MenuContentEntry>;
};

export function PageSidebar({ menuContent }: PageSidebarProps) {
  const navigate = useNavigate();
  const sidebarOutlet = useAuxOutlet({ outlet: 'sidebar' });

  if (!sidebarOutlet) return null;

  const sidebarCode = sidebarOutlet.replace(/^\//, '');
  const menuCode = 'resource.' + sidebarCode;
  const title = getBlock(menuContent, menuCode, 'title');

  return (
    <SidebarPanel
      code={sidebarCode}
      title={title}
      onClose={() => navigate('(sidebar:)')}
    />
  );
}
