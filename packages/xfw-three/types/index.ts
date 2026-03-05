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

export type ThreeModelViewProps = {
    /** URL to a GLB/GLTF model file */
    url: string;
    /** Data rows to match against scene objects by resourceId */
    data?: JSONRecord[];
    /** Key in data rows to use for coloring meshes (defaults to "color") */
    colorKey?: string;
    /** Render function for the popover shown when clicking a 3D object */
    renderPopover?: (data: ObjectData, position: PopoverPosition) => React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;
