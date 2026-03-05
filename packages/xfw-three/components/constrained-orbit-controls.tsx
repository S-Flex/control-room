import { OrbitControls as OrbitControlsComponent } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, type ComponentProps } from "react";
import type { OrbitControls } from "three-stdlib";
import type { BoundsBox } from "../types";

export const ConstrainedOrbitControls = ({ bounds, ref: controlsRefProp, ...props }: {
    bounds?: BoundsBox | null,
} & ComponentProps<typeof OrbitControlsComponent>) => {
    const internalRef = useRef<OrbitControls>(null);
    const controlsRef = (controlsRefProp ?? internalRef) as React.RefObject<OrbitControls>;

    useFrame(() => {
        if (!bounds || !controlsRef?.current) return;
        const controls = controlsRef.current;
        const camera = controls.object;

        const oldTarget = controls.target.clone();
        const offset = camera.position.clone().sub(oldTarget);

        controls.target.x = Math.max(bounds.minX, Math.min(bounds.maxX, controls.target.x));
        controls.target.y = Math.max(bounds.minY, Math.min(bounds.maxY, controls.target.y));
        controls.target.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, controls.target.z));

        camera.position.copy(controls.target).add(offset);
        controls.update();
    });

    return <OrbitControlsComponent ref={controlsRef} {...props} />;
};
