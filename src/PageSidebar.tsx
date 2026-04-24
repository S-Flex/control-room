import { useAuxOutlet, useNavigate } from '@s-flex/xfw-url';
import { useSidebar } from '@s-flex/xfw-sidebar';
import { getBlock } from 'xfw-get-block';
import { SidebarPanel } from './SidebarPanel';
import { usePages } from './hooks/usePages';
import { NavButtonsComponent } from '@s-flex/xfw-ui';


function SidebarOutletRegistration({
  outlet,
  code,
  title,
  index,
}: {
  outlet: string;
  code: string;
  title: string;
  index: number;
}) {
  const closePath = `(sidebar:-${code})`;

  useSidebar({
    identifier: `${outlet}:${code}`,
    index,
    side: 'right',
    title,
    reopenPath: code,
    navs: (
      <NavButtonsComponent
        key={`sidebar-close-${code}`}
        nav={[{
          path: closePath,
          type: 'link',
          icon: 'XClose',
        }]}
      />
    ),
    content: () => (
      <SidebarPanel
        code={code}
      />
    ),
    deps: [code],
  });

  return null;
}

function SidebarOutlet({
  outlet,
  index,
  content,
}: {
  outlet: string;
  index: number;
  content: { code: string; block: Record<string, unknown>; }[];
}) {
  const outletPath = useAuxOutlet({ outlet });

  if (!outletPath) return null;
  const codes = outletPath
    .split(';')
    .map(path => path.trim().replace(/^\/+/, ''))
    .filter(Boolean);

  return (
    <>
      {codes.map((code, idx) => {
        const title = getBlock(content, code, 'title');
        return (
          <SidebarOutletRegistration
            key={`${outlet}:${code}`}
            outlet={outlet}
            code={code}
            title={title}
            index={index + idx * 10}
          />
        );
      })}
    </>
  );
}

export function PageSidebar() {
  const { content } = usePages();

  return (
    <>
      <SidebarOutlet outlet="sidebar" index={100} content={content} />
      <SidebarOutlet outlet="detail" index={110} content={content} />
    </>
  );
}
