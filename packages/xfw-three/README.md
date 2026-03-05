# xfw-three

3D model viewer components for React applications. Renders GLB/GLTF models with interactive features like object clicking, color mapping, and constrained camera controls.

## Philosophy

**3D should be as easy as an image.** Drop in a `ThreeModelView` component with a URL and optional data, and get an interactive 3D viewer with auto-camera fitting, orbit controls, and click-to-inspect.

## Dependencies

- `react` (>=18)
- `three` (>=0.150)
- `@react-three/fiber` (>=9) -- React renderer for Three.js
- `@react-three/drei` (>=10) -- Three.js helpers (OrbitControls, useGLTF)
- `three-stdlib` -- TypeScript types for OrbitControls

## Installation

Copy the `xfw-three` directory into your project (e.g. `src/packages/xfw-three` or `src/lib/xfw-three`).

All imports are relative -- no path aliases needed.

## Usage

### Basic Model Viewer

```tsx
import { ThreeModelView } from "./packages/xfw-three";

function MyScene() {
    return (
        <ThreeModelView
            url="/models/building.glb"
            className="w-full h-[600px]"
        />
    );
}
```

### With Data-Driven Coloring

Color meshes in the 3D scene based on data rows. Each data row's `resourceId` is matched against the `userData.resourceId` on scene objects:

```tsx
import { ThreeModelView } from "./packages/xfw-three";

const machines = [
    { resourceId: "machine-1", color: "#ff0000", name: "Printer A" },
    { resourceId: "machine-2", color: "#00ff00", name: "Printer B" },
];

function FloorPlan() {
    return (
        <ThreeModelView
            url="/models/factory.glb"
            data={machines}
            colorKey="color"
            className="w-full h-[80vh]"
        />
    );
}
```

### With Click Popover

Render a custom popover when the user clicks a 3D object:

```tsx
import { ThreeModelView } from "./packages/xfw-three";

function InteractiveScene() {
    return (
        <ThreeModelView
            url="/models/office.glb"
            data={rooms}
            colorKey="statusColor"
            renderPopover={(data, position) => (
                <div
                    style={{
                        position: 'absolute',
                        left: position.left,
                        top: position.top,
                        background: 'white',
                        padding: '8px',
                        borderRadius: '4px',
                    }}
                >
                    <p>{data.name as string}</p>
                    <p>{data.status as string}</p>
                </div>
            )}
        />
    );
}
```

### Constrained Orbit Controls (standalone)

Use the orbit controls independently in your own R3F canvas:

```tsx
import { Canvas } from "@react-three/fiber";
import { ConstrainedOrbitControls } from "./packages/xfw-three";

function CustomScene() {
    const bounds = { minX: -10, maxX: 10, minY: 0, maxY: 5, minZ: -10, maxZ: 10 };

    return (
        <Canvas>
            <mesh>
                <boxGeometry />
                <meshStandardMaterial />
            </mesh>
            <ConstrainedOrbitControls bounds={bounds} />
        </Canvas>
    );
}
```

## Features

- **Auto camera fitting** -- Camera automatically positions to frame the model with a 35-degree downward angle
- **Color mapping** -- Apply colors to meshes by matching `resourceId` in data rows to scene `userData`
- **Material cloning** -- Shared materials are cloned per-mesh to avoid color bleeding
- **Original color blending** -- Colors are lerped 50% between original and target for a natural look
- **Click detection** -- Distinguishes clicks from drags using distance + time thresholds
- **Screen-space popover** -- 3D world position is projected to 2D screen coordinates
- **Constrained orbit** -- Camera pan/zoom is clamped to the model's bounding box
- **On-demand rendering** -- Uses `frameloop='demand'` for performance

## Type Reference

```tsx
type ThreeModelViewProps = {
    url: string;                    // Path to GLB/GLTF file
    data?: JSONRecord[];            // Data rows with resourceId to match
    colorKey?: string;              // Data field for colors (default: "color")
    renderPopover?: (               // Custom popover renderer
        data: ObjectData,
        position: PopoverPosition
    ) => React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

type BoundsBox = {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
};
```

## File Structure

```
xfw-three/
├── index.ts                              # Barrel export
├── types/
│   └── index.ts                          # Type definitions
└── components/
    ├── three-model-view.tsx              # Main GLB/GLTF viewer component
    └── constrained-orbit-controls.tsx    # Bounded orbit camera controls
```
