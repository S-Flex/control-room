import type { ReactNode } from "react";

// Type representing any valid JSON-serializable value
export type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONRecord
    | JSONValue[];

export type JSONRecord = { [key: string]: JSONValue; };

export type ParamDefinition = {
    key: string;
    isOptional?: boolean;
    isQueryParam?: boolean;
    /** When value is not used for a query, but is an output of identities (e.g. when a list lets you select an item, it outputs to query params) */
    isIdentOnly?: boolean;
    defaultValue?: JSONValue;
    /** @deprecated default value for a param */
    val?: JSONValue;
};

export type ParamValue = {
    key: string;
    val: JSONValue;
};

// --- Sidebar / Outlet types ---

export type SidebarSide = "left" | "right";

export interface SidebarNavAction {
    /** Unique key for React list rendering */
    key?: string;
    /** Icon element to display */
    icon?: ReactNode;
    /** Path to navigate to (supports partial paths like "(sidebar:)") */
    path?: string;
    /** Click handler (used when no path is provided) */
    onClick?: () => void;
}

export interface SidebarContainer {
    /** Unique identifier for the container */
    identifier: string;
    /** Content to render inside the sidebar */
    content: ReactNode;
    /** Whether the sidebar is currently visible */
    isVisible: boolean;
    /** Height percentage (used when multiple containers stack vertically) */
    height: number;
    /** Display priority when multiple containers exist at the same index */
    sortOrder: number;
    /** Which side of the screen to render on */
    side: SidebarSide;
    /** Layer index — lower values render closer to center content, multiple sidebars can stack at different indices */
    index: number;
    /** Override the default width (CSS value) */
    overrideWidth?: string;
    /** Navigation actions rendered in the sidebar header */
    navs?: SidebarNavAction[];
    /** Title displayed in the sidebar header */
    title?: ReactNode;
}
