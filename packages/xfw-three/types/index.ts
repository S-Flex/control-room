export type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONRecord
    | JSONValue[];

export type JSONRecord = { [key: string]: JSONValue; };

export type ObjectData = JSONRecord;

export type PopoverState = {
    world: import("three").Vector3;
    data: ObjectData;
};

export type PopoverPosition = {
    left: number;
    top: number;
};

export type BoundsBox = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
};

export type CameraState = {
    position: [number, number, number];
    target: [number, number, number];
};

export type ThreeModelViewProps = {
    /** URL to a GLB/GLTF model file */
    url: string;
    /** Data rows to match against scene objects by layout_name */
    data?: JSONRecord[];
    /** Key in data rows to use for coloring meshes (defaults to "color") */
    colorKey?: string;
    /** Render function for the popover content shown when clicking a 3D object.
     *  The package handles positioning — just return the content to display. */
    renderPopover?: (data: ObjectData) => React.ReactNode;
    /** Programmatically show popover at the object with this layout_name */
    activeResourceId?: string | null;
    /** Initial camera position and orbit target. If not set, auto-fits to scene. */
    initialCamera?: CameraState;
    /** Called when the user saves camera position (LMB+RMB) */
    onSaveCamera?: (state: CameraState) => void;
    /** Called when user clicks a matched object, or null when clicking empty space */
    onObjectClick?: (data: ObjectData | null) => void;
    /** Ref callback to get a function that dismisses the popover */
    popoverRef?: React.MutableRefObject<(() => void) | null>;
    /** Render a persistent label above each matched object. Return null to skip. */
    renderLabel?: (data: ObjectData) => React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;
