import type { SidebarSide } from "../types";
import { useSidebarContext } from "../providers/sidebar-provider";
import React, { useEffect } from "react";

type SidebarPortalProps = {
    identifier: string;
    side: SidebarSide;
    index: number;
    sortOrder?: number;
    isVisible?: boolean;
    overrideWidth?: string;
    children: React.ReactNode;
};

/**
 * Lower-level component for registering sidebar content directly.
 * Renders nothing — actual display is handled by the Sidebar component.
 */
export const SidebarPortal: React.FC<SidebarPortalProps> = ({
    identifier,
    side,
    index,
    sortOrder = 1,
    isVisible = true,
    overrideWidth,
    children,
}) => {
    const { setContainer, removeContainer } = useSidebarContext();

    useEffect(() => {
        setContainer({
            identifier,
            content: children,
            isVisible,
            height: 33,
            sortOrder,
            side,
            index,
            overrideWidth,
        });
        return () => removeContainer(identifier);
    }, [identifier, side, index, sortOrder, isVisible, overrideWidth, setContainer, removeContainer, children]);

    return null;
};
