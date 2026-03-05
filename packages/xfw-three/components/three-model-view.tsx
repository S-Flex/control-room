import { useGLTF } from '@react-three/drei';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import type { Color, Material, Mesh } from 'three';
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ConstrainedOrbitControls } from './constrained-orbit-controls';
import type { BoundsBox, JSONRecord, ObjectData, PopoverPosition, PopoverState, ThreeModelViewProps } from '../types';

function GLBModelScene({ url, setPopover, containerRef, popover, setPopoverPos, data, colorKey, onMiss, justSetPopoverRef }: {
    url: string;
    setPopover: React.Dispatch<React.SetStateAction<PopoverState | null>>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    popover: PopoverState | null;
    setPopoverPos: React.Dispatch<React.SetStateAction<PopoverPosition | null>>;
    data?: JSONRecord[];
    colorKey?: string;
    onMiss: () => void;
    justSetPopoverRef: React.MutableRefObject<boolean>;
}) {
    const { scene } = useGLTF(url, true);
    const { camera, size } = useThree();
    const controlsRef = useRef<OrbitControlsImpl>(null);
    const [bounds, setBounds] = useState<BoundsBox | null>(null);
    const hasFitCamera = useRef(false);

    // Fit camera to scene bounding box after initial render
    useEffect(() => {
        if (!scene || !camera || hasFitCamera.current) return;
        const box = new Box3().setFromObject(scene);
        const sizeVec = new Vector3();
        box.getSize(sizeVec);
        const center = new Vector3();
        box.getCenter(center);

        setBounds({
            minX: box.min.x, maxX: box.max.x,
            minY: box.min.y, maxY: box.max.y,
            minZ: box.min.z, maxZ: box.max.z,
        });

        if ('fov' in camera) {
            const fov = (camera as PerspectiveCamera).fov * (Math.PI / 180);
            const maxSize = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
            const cameraDistance = Math.abs(maxSize / (2 * Math.tan(fov / 2))) * 1.2;

            const angleRad = 35 * Math.PI / 180;
            const theta = -Math.PI / 4;
            const x = center.x + cameraDistance * Math.cos(angleRad) * Math.cos(theta);
            const y = center.y + cameraDistance * Math.sin(angleRad);
            const z = center.z + cameraDistance * Math.cos(angleRad) * Math.sin(theta);

            camera.position.set(x, y, z);
            camera.lookAt(center);
            camera.updateProjectionMatrix();
            if (controlsRef.current) {
                controlsRef.current.target.copy(center);
                controlsRef.current.update();
            }
            hasFitCamera.current = true;
        }
    }, [scene, camera]);

    // Apply colors to meshes with matching resourceId
    useEffect(() => {
        if (!scene || !data || !colorKey) return;

        scene.traverse(obj => {
            if (obj?.userData?.resourceId === undefined) return;

            const match = data.find(item => item.resourceId === obj.userData.resourceId);
            if (!match || !match[colorKey]) return;

            obj.traverse(child => {
                const mesh = child as Mesh;
                if (!mesh.isMesh || !mesh.material) return;

                type FlaggedMaterial = typeof mesh.material & { _isClonedForColoring?: boolean; };
                type ColorMat = Material & { color?: Color; needsUpdate: boolean; _originalColorHex?: number; };

                if (!(mesh.material as FlaggedMaterial)._isClonedForColoring) {
                    mesh.material = Array.isArray(mesh.material)
                        ? mesh.material.map(m => m.clone())
                        : mesh.material.clone();
                    (mesh.material as FlaggedMaterial)._isClonedForColoring = true;
                }

                const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as ColorMat[];

                materials.forEach(mat => {
                    if (!(mat.color && typeof mat.color.lerp === 'function')) return;

                    if (!mat._originalColorHex) {
                        mat._originalColorHex = mat.color.getHex();
                    }
                    const original = new (mat.color.constructor as new (hex: number) => Color)(mat._originalColorHex!);
                    const target = original.clone();
                    target.set(match[colorKey] as string);
                    mat.color.copy(original).lerp(target, 0.5);
                    mat.needsUpdate = true;
                });
            });
        });
    }, [scene, data, colorKey]);

    // Click handler for the whole scene
    const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
        if (!e.intersections || e.intersections.length === 0) {
            onMiss();
            return;
        }

        let found = null;
        let foundPoint = null;
        for (const inter of e.intersections) {
            let obj = inter.object;
            while (obj && !(obj.userData && obj.userData.resourceId !== undefined) && obj.parent) {
                obj = obj.parent;
            }
            if (obj && obj.userData && obj.userData.resourceId !== undefined) {
                found = obj;
                foundPoint = inter.point;
                break;
            }
        }

        if (!found) {
            onMiss();
            return;
        }

        if (justSetPopoverRef) {
            justSetPopoverRef.current = true;
        }

        setPopover({
            world: foundPoint
                ? foundPoint.clone ? foundPoint.clone() : new Vector3(...foundPoint)
                : new Vector3(),
            data: found.userData
        });
    }, [justSetPopoverRef, setPopover, onMiss]);

    // Helper to update popover position
    const updatePopoverPos = useCallback(() => {
        if (!popover || !containerRef.current) return;
        const vec = popover.world.clone();
        vec.project(camera);
        const x = (vec.x * 0.5 + 0.5) * size.width;
        const y = (-vec.y * 0.5 + 0.5) * size.height;
        setPopoverPos({ left: x, top: y });
    }, [popover, camera, size.width, size.height, containerRef, setPopoverPos]);

    useEffect(() => {
        updatePopoverPos();
    }, [popover, camera, size.width, size.height, updatePopoverPos]);

    useEffect(() => {
        if (!popover) return;
        const controls = controlsRef.current;
        if (!controls) return;
        controls.addEventListener('change', updatePopoverPos);
        return () => controls.removeEventListener('change', updatePopoverPos);
    }, [popover, updatePopoverPos]);

    return (
        <group onPointerDown={handlePointerDown}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 5, 5]} intensity={0.7} />
            <primitive object={scene} />
            <ConstrainedOrbitControls ref={controlsRef} bounds={bounds} />
        </group>
    );
}

export default function ThreeModelView({ url, data, colorKey, renderPopover, ...props }: ThreeModelViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [popover, setPopover] = useState<PopoverState | null>(null);
    const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);

    const pointerDownRef = useRef<{ x: number; y: number; time: number; } | null>(null);
    const justSetPopoverRef = useRef(false);
    const DRAG_THRESHOLD = 5;
    const CLICK_TIME = 300;

    const handleCanvasPointerDown = (e: PointerEvent) => {
        if (e && e.clientX !== undefined && e.clientY !== undefined) {
            pointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
        }
    };

    const handleCanvasPointerUp = (e: PointerEvent) => {
        if (!pointerDownRef.current) return;
        const dx = e.clientX - pointerDownRef.current.x;
        const dy = e.clientY - pointerDownRef.current.y;
        const dt = Date.now() - pointerDownRef.current.time;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < DRAG_THRESHOLD && dt < CLICK_TIME) {
            if (!justSetPopoverRef.current) {
                setPopover(null);
            }
        }
        pointerDownRef.current = null;
        justSetPopoverRef.current = false;
    };

    const handleMiss = () => {
        setPopover(null);
    };

    return (
        <div ref={containerRef} {...props} style={{ ...props.style, position: 'relative' }}>
            <Canvas
                camera={{ position: [0, 5, 0], fov: 50 }}
                onPointerDown={handleCanvasPointerDown}
                onPointerUp={handleCanvasPointerUp}
                frameloop='demand'
            >
                <GLBModelScene
                    url={url}
                    setPopover={setPopover}
                    containerRef={containerRef}
                    popover={popover}
                    setPopoverPos={setPopoverPos}
                    data={data}
                    colorKey={colorKey}
                    onMiss={handleMiss}
                    justSetPopoverRef={justSetPopoverRef}
                />
            </Canvas>
            {popover && popoverPos && Number.isFinite(popoverPos.left) && Number.isFinite(popoverPos.top) && renderPopover && (
                renderPopover(popover.data, popoverPos)
            )}
        </div>
    );
}
