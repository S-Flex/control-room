import type { SidebarContainer, SidebarSide } from "../types";
import { useSidebarContext } from "../providers/sidebar-provider";
import { Link } from "react-aria-components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SidebarProps = {
    side: SidebarSide;
    idx: number;
};

export const Sidebar: React.FC<SidebarProps> = ({ side, idx }) => {
    const { containers } = useSidebarContext();
    const [isExpanded, setIsExpanded] = useState(true);
    const [width, setWidth] = useState(20); // percent
    const liveWidthRef = useRef(width);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const visibleContainers = useMemo(
        () => containers.filter(
            c => c.side === side && c.index === idx && c.isVisible,
        ),
        [containers, side, idx],
    );

    const rafRef = useRef<number | null>(null);

    const onDragStart = useCallback(() => {
        setIsResizing(true);
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";
        if (sidebarRef.current) {
            sidebarRef.current.style.transition = "none";
        }
    }, []);

    const onDrag = useCallback((e: MouseEvent) => {
        if (!isResizing || !sidebarRef.current) return;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            const rect = sidebarRef.current!.getBoundingClientRect();
            let newWidth;
            if (side === "left") {
                newWidth = ((e.clientX - rect.left) / window.innerWidth) * 100;
            } else {
                newWidth = ((rect.right - e.clientX) / window.innerWidth) * 100;
            }
            newWidth = Math.max(10, Math.min(50, newWidth));
            liveWidthRef.current = newWidth;
            sidebarRef.current!.style.width = `${newWidth}%`;
        });
    }, [isResizing, side]);

    const onDragEnd = useCallback(() => {
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (sidebarRef.current) {
            sidebarRef.current.style.transition = "";
        }
        setWidth(liveWidthRef.current);
    }, []);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener("mousemove", onDrag);
            window.addEventListener("mouseup", onDragEnd);
            return () => {
                window.removeEventListener("mousemove", onDrag);
                window.removeEventListener("mouseup", onDragEnd);
            };
        }
    });

    const sidebarBase = useMemo(() => [
        "relative flex h-screen transition-all duration-200 bg-primary shadow-xl",
        isExpanded ? "" : "overflow-hidden",
    ].filter(Boolean).join(" "), [isExpanded]);

    if (visibleContainers.length === 0) return null;

    const sidebarWidth = isExpanded ? `${width}%` : "1rem";

    return (
        <div
            ref={sidebarRef}
            className={sidebarBase}
            style={{ width: sidebarWidth, minWidth: 0, zIndex: 100 }}
        >
            {/* Resize handle */}
            <div
                className="absolute top-0 h-screen z-[1015] bg-border-secondary_alt"
                style={{
                    width: "1px",
                    left: side === "right" ? 0 : undefined,
                    right: side === "left" ? 0 : undefined,
                    cursor: isResizing ? "col-resize" : "ew-resize",
                }}
                onMouseDown={onDragStart}
            >
                <div className="w-[3px] h-full -translate-x-1/2" />
            </div>

            {/* Content */}
            <div
                className="flex-1 overflow-hidden overflow-y-auto"
                style={{ width: isExpanded ? "100%" : "calc(100%-0.75rem)" }}
            >
                {visibleContainers.map((container, i) => (
                    <SidebarContainerComponent
                        key={container.identifier}
                        container={container}
                        index={i}
                        last={i === visibleContainers.length - 1}
                    />
                ))}
            </div>

            {/* Collapse/expand toggle */}
            <div
                className={[
                    "w-4 h-full z-30 flex items-center justify-center cursor-pointer",
                    isExpanded ? "absolute top-0 bottom-0" : "",
                    side === "left" && isExpanded ? "right-0" : "",
                    side === "right" && isExpanded ? "left-0" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => setIsExpanded(e => !e)}
            >
                <div className="flex w-full h-full items-center justify-center text-gray-300 text-xs font-black">
                    {(side === "left") === isExpanded
                        ? <i className="fa-solid fa-chevron-left"></i>
                        : <i className="fa-solid fa-chevron-right"></i>
                    }
                </div>
            </div>
        </div>
    );
};

/**
 * Renders a single sidebar container with header (title + nav actions) and content.
 * Nav actions with a `path` use react-aria-components Link, which integrates with
 * AriaRouterProvider for xfw-url partial path navigation.
 */
const SidebarContainerComponent: React.FC<{
    container: SidebarContainer;
    index: number;
    last: boolean;
}> = ({ container }) => {
    return (
        <div>
            <div className="flex items-center justify-between px-3 py-2 border-secondary bg-primary">
                <header className="relative z-1 w-full px-4 pt-6 md:px-6">
                    <h1 className="text-md font-semibold text-primary md:text-lg">
                        {container.title ?? "Sidebar"}
                    </h1>

                    <div className="absolute top-3 right-3 shrink-0 flex gap-1">
                        {container.navs?.map((nav, i) => {
                            const key = nav.key ?? nav.path ?? String(i);
                            if (nav.path) {
                                return (
                                    <Link
                                        key={key}
                                        href={nav.path}
                                        className="inline-flex items-center justify-center p-1.5 rounded-md hover:bg-primary_hover transition"
                                    >
                                        {nav.icon}
                                    </Link>
                                );
                            }
                            return (
                                <button
                                    key={key}
                                    onClick={nav.onClick}
                                    className="inline-flex items-center justify-center p-1.5 rounded-md hover:bg-primary_hover transition"
                                >
                                    {nav.icon}
                                </button>
                            );
                        })}
                    </div>
                </header>
            </div>
            {container.content}
        </div>
    );
};
