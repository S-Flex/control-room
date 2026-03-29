import type { I18n, NavItem } from "@/types/content";
import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type SidebarSide = "left" | "right";

export interface SidebarContainer {
    identifier: string;
    content: React.ReactNode;
    isVisible: boolean;
    height: number;
    sortOrder: number;
    side: SidebarSide;
    index: number;
    overrideWidth?: string;
    navs?: NavItem[];
    title?: string | I18n<'text'>;
}

type SidebarContextType = {
    containers: SidebarContainer[];
    left: SidebarContainer[];
    right: SidebarContainer[];
    leftIndices: number[];
    rightIndices: number[];
    setContainer: (container: SidebarContainer) => void;
    removeContainer: (identifier: string) => void;
};

// Helper to filter out duplicate indices, keeping only the first container for each index
function uniqueByIndex(arr: SidebarContainer[]) {
    const seen = new Set<number>();
    return arr.filter(c => {
        if (seen.has(c.index)) return false;
        seen.add(c.index);
        return true;
    });
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode; }> = ({ children }) => {
    const [containers, setContainers] = useState<SidebarContainer[]>([]);

    const setContainer = useCallback((container: SidebarContainer) => {
        setContainers(prev => {
            const idx = prev.findIndex(c => c.identifier === container.identifier);
            if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], ...container };
                return updated;
            }
            return [...prev, container];
        });
    }, []);

    const removeContainer = useCallback((identifier: string) => {
        setContainers(prev => prev.filter(c => c.identifier !== identifier));
    }, []);


    // Compute left and right containers, sorted by index (lower index closer to center)
    const left = useMemo(() =>
        uniqueByIndex(
            containers
                .filter(c => c.side === "left" && c.isVisible)
                .sort((a, b) => a.index - b.index)
        ), [containers]
    );
    const right = useMemo(() =>
        uniqueByIndex(
            containers
                .filter(c => c.side === "right" && c.isVisible)
                .sort((a, b) => a.index - b.index)
        ), [containers]
    );

    // Compute left and right indices (unique, sorted)
    const leftIndices = useMemo(() =>
        Array.from(new Set(
            containers
                .filter(c => c.side === "left" && c.isVisible)
                .map(c => c.index)
        )).sort((a, b) => a - b),
        [containers]
    );
    const rightIndices = useMemo(() =>
        Array.from(new Set(
            containers
                .filter(c => c.side === "right" && c.isVisible)
                .map(c => c.index)
        )).sort((a, b) => a - b),
        [containers]
    );

    return (
        <SidebarContext.Provider value={{ containers, left, right, leftIndices, rightIndices, setContainer, removeContainer }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebarContext = () => {
    const ctx = useContext(SidebarContext);
    if (!ctx) throw new Error("useSidebarContext must be used within SidebarProvider");
    return ctx;
};
