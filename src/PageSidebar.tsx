import { useNavigate, useAuxOutlet } from '@s-flex/xfw-url';
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
  let title = getBlock(menuContent, menuCode, 'title');
  // Fallback: try the code directly (for sidebars not tied to resource menu items)
  if (title === menuCode) title = getBlock(menuContent, sidebarCode, 'title');

  return (
    <SidebarPanel
      code={sidebarCode}
      title={title}
      onClose={() => navigate('(sidebar:)')}
    />
  );
}
