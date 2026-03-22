import type { SidebarContainer } from "../types";
import { useSidebarContext } from "../providers/sidebar-provider";
import { useEffect, useMemo } from "react";

export function useSidebar({
    sortOrder = 1,
    isVisible = true,
    content,
    side = "right",
    index = 0,
    deps = [],
    navs = [],
    overrideWidth,
    title,
    identifier,
    height,
}: Partial<Omit<SidebarContainer, "content">> & {
    content: () => React.ReactNode;
    deps?: unknown[];
}) {
    const { setContainer, removeContainer } = useSidebarContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoizedContent = useMemo(content, deps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoNavs = useMemo(() => navs, deps);
    const identifierMemo = useMemo(
        () => identifier || `sidebar-${Math.random().toString(36).substring(2, 15)}`,
        [identifier],
    );

    useEffect(() => {
        setContainer({
            content: memoizedContent,
            isVisible,
            height: height ?? 33,
            sortOrder,
            identifier: identifierMemo,
            index,
            side,
            navs: memoNavs,
            overrideWidth,
            title,
        });
        return () => removeContainer(identifierMemo);
    }, [identifierMemo, sortOrder, isVisible, memoizedContent, setContainer, removeContainer, memoNavs, index, side, overrideWidth, title, height]);
}
