import { Html, useGLTF } from '@react-three/drei';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Box3, MOUSE, PerspectiveCamera, Vector3 } from 'three';
import type { Color, Material, Mesh } from 'three';
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ConstrainedOrbitControls } from './constrained-orbit-controls';
import type { BoundsBox, CameraState, JSONRecord, ObjectData, PopoverPosition, PopoverState, ThreeModelViewProps } from '../types';

const INK_COLORS: Record<string, string> = {
    cyan: '#00bcd4',
    magenta: '#e91e63',
    yellow: '#ffc107',
    black: '#000000',
};

function InkPopup({ inks, onClose }: { inks: Record<string, { amount: number; expires: string }>; onClose: () => void }) {
    const today = new Date();
    return (
        <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', left: 24, top: -10, width: 200,
            background: 'var(--bg-card, #1e2433)', border: '1px solid var(--border, #4a4f5a)',
            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', padding: '8px 10px',
            zIndex: 30, fontSize: 10,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary, #f5f5f6)', fontSize: 11 }}>Ink Levels</span>
                <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--text-muted, #85888e)', fontSize: 14, lineHeight: 1 }}>&times;</span>
            </div>
            {Object.entries(inks).map(([name, ink]) => {
                const expDate = new Date(ink.expires);
                const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
                const expiring = daysLeft <= 2;
                return (
                    <div key={name} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontWeight: 600, color: INK_COLORS[name] || '#888', textTransform: 'capitalize' }}>{name}</span>
                            <span style={{ color: expiring ? '#d92d20' : 'var(--text-muted, #85888e)', fontWeight: expiring ? 700 : 400 }}>
                                {ink.expires}{expiring ? ' ⚠' : ''}
                            </span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bar-bg, #4a5060)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', width: `${ink.amount}%`, borderRadius: 3,
                                background: INK_COLORS[name] || '#888',
                            }} />
                        </div>
                        <div style={{ textAlign: 'right', color: 'var(--text-muted, #85888e)', fontSize: 9, marginTop: 1 }}>{ink.amount}%</div>
                    </div>
                );
            })}
        </div>
    );
}

/** Extract the layout key from a node name: everything after the first underscore */
function layoutKey(nodeName: string): string {
    const parts = nodeName.split('_');
    return parts.length > 1 ? parts.slice(1).join('_') : nodeName;
}

function GLBModelScene({ url, setPopover, containerRef, popover, setPopoverPos, data, colorKey, onMiss, justSetPopoverRef, lastClickedDataRef, activeResourceId, initialCamera, onSaveCamera, getCameraStateRef, renderLabel }: {
    url: string;
    setPopover: React.Dispatch<React.SetStateAction<PopoverState | null>>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    popover: PopoverState | null;
    setPopoverPos: React.Dispatch<React.SetStateAction<PopoverPosition | null>>;
    data?: JSONRecord[];
    colorKey?: string;
    onMiss: () => void;
    justSetPopoverRef: React.MutableRefObject<boolean>;
    lastClickedDataRef: React.MutableRefObject<ObjectData | null>;
    activeResourceId?: number | string | null;
    initialCamera?: CameraState;
    onSaveCamera?: (state: CameraState) => void;
    getCameraStateRef: React.MutableRefObject<(() => CameraState | null) | null>;
    renderLabel?: (data: ObjectData) => React.ReactNode;
}) {
    const { scene } = useGLTF(url, true);
    const { camera, size, invalidate } = useThree();
    const controlsRef = useRef<OrbitControlsImpl>(null);
    const [bounds, setBounds] = useState<BoundsBox | null>(null);
    const hasFitCamera = useRef(false);

    // Fit camera to scene bounding box after initial render
    // Uses requestAnimationFrame to ensure the scene is fully in the R3F graph
    useEffect(() => {
        if (!scene || !camera || hasFitCamera.current) return;
        let cancelled = false;
        let retries = 0;
        const MAX_RETRIES = 60;

        const fitCamera = () => {
            if (cancelled) return;
            const box = new Box3().setFromObject(scene);
            const sizeVec = new Vector3();
            box.getSize(sizeVec);

            // If bounding box is empty, scene geometry isn't ready yet — retry
            if (sizeVec.x === 0 && sizeVec.y === 0 && sizeVec.z === 0) {
                if (++retries < MAX_RETRIES) {
                    requestAnimationFrame(fitCamera);
                }
                return;
            }

            setBounds({
                minX: box.min.x, maxX: box.max.x,
                minY: box.min.y, maxY: box.max.y,
                minZ: box.min.z, maxZ: box.max.z,
            });

            if ('fov' in camera) {
                if (initialCamera) {
                    camera.position.set(...initialCamera.position);
                    camera.updateProjectionMatrix();
                    if (controlsRef.current) {
                        controlsRef.current.target.set(...initialCamera.target);
                        controlsRef.current.update();
                    }
                } else {
                    const center = new Vector3();
                    box.getCenter(center);
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
                }
                hasFitCamera.current = true;
            }
        };

        requestAnimationFrame(fitCamera);
        return () => { cancelled = true; };
    }, [scene, camera, initialCamera]);

    // Expose camera state getter to parent
    getCameraStateRef.current = () => {
        const p = camera.position;
        const t = controlsRef.current?.target;
        if (!t) return null;
        return {
            position: [p.x, p.y, p.z],
            target: [t.x, t.y, t.z],
        };
    };

    // Apply colors and selection highlight to meshes with matching layout_name (node name)
    useEffect(() => {
        if (!scene || !data || !colorKey) return;

        scene.traverse(obj => {
            if (!obj.name) return;
            const key = layoutKey(obj.name);
            const match = data.find(item => item.layout_name === key);
            if (!match || !match[colorKey]) return;

            const isSelected = !!match.selected;

            obj.traverse(child => {
                const mesh = child as Mesh;
                if (!mesh.isMesh || !mesh.material) return;

                type FlaggedMaterial = typeof mesh.material & { _isClonedForColoring?: boolean; };
                type ColorMat = Material & { color?: Color; emissive?: Color; needsUpdate: boolean; _originalColorHex?: number; };

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

                    // Selection highlight: subtle emissive glow
                    if (mat.emissive && typeof mat.emissive.set === 'function') {
                        if (isSelected) {
                            mat.emissive.set(0x18304d);
                        } else {
                            mat.emissive.set(0x000000);
                        }
                    }

                    mat.needsUpdate = true;
                });
            });
        });
        invalidate();
    }, [scene, data, colorKey, invalidate]);

    // Programmatic popover: show popover at the object matching activeResourceId
    // activeResourceId can be a number (matches userData.resourceId) or string (matches node name)
    useEffect(() => {
        if (activeResourceId == null || !scene) {
            return;
        }

        let found: import('three').Object3D | null = null;
        scene.traverse(obj => {
            if (found) return;
            if (obj.name && layoutKey(obj.name) === activeResourceId) {
                found = obj;
            }
        });

        if (!found) return;
        const foundObj = found as import('three').Object3D;

        // Get the center of the object's bounding box in world space
        const box = new Box3().setFromObject(foundObj);
        const center = new Vector3();
        box.getCenter(center);

        setPopover({
            world: center,
            data: { ...foundObj.userData, name: foundObj.name } as ObjectData,
        });

        invalidate();
    }, [activeResourceId, scene, setPopover, invalidate]);

    // Click handler for the whole scene
    const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
        if (!e.intersections || e.intersections.length === 0) {
            onMiss();
            return;
        }

        const knownKeys = new Set(
            (data || []).filter(d => d.layout_name).map(d => d.layout_name as string)
        );

        let found = null;
        let foundPoint = null;
        for (const inter of e.intersections) {
            let obj = inter.object;
            while (obj && obj.parent) {
                if (obj.name && knownKeys.has(layoutKey(obj.name))) break;
                obj = obj.parent;
            }
            if (obj && obj.name && knownKeys.has(layoutKey(obj.name))) {
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

        const clickedData = { ...found.userData, name: found.name };
        lastClickedDataRef.current = clickedData;
        setPopover({
            world: foundPoint
                ? foundPoint.clone ? foundPoint.clone() : new Vector3(...foundPoint)
                : new Vector3(),
            data: clickedData
        });
    }, [justSetPopoverRef, setPopover, onMiss, data]);

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

    // Find objects with markers (e.g. ink_expiration)
    const markers = useMemo(() => {
        if (!scene || !data) return [];
        const result: { position: [number, number, number]; key: string; inks: Record<string, { amount: number; expires: string }> }[] = [];
        scene.traverse(obj => {
            if (!obj.name) return;
            const key = layoutKey(obj.name);
            const item = data.find(d => d.layout_name === key && d.ink_expiration);
            if (!item) return;
            const box = new Box3().setFromObject(obj);
            const center = new Vector3();
            box.getCenter(center);
            const top = box.max.y;
            result.push({ position: [center.x, top + 0.5, center.z], key, inks: (item.inks ?? {}) as Record<string, { amount: number; expires: string }> });
        });
        return result;
    }, [scene, data]);

    // Compute positions for persistent labels
    const labelItems = useMemo(() => {
        if (!scene || !data || !renderLabel) return [];
        const result: { position: [number, number, number]; key: string; data: ObjectData }[] = [];
        scene.traverse(obj => {
            if (!obj.name) return;
            const key = layoutKey(obj.name);
            const item = data.find(d => d.layout_name === key);
            if (!item) return;
            const box = new Box3().setFromObject(obj);
            const sizeVec = new Vector3();
            box.getSize(sizeVec);
            if (sizeVec.x === 0 && sizeVec.y === 0 && sizeVec.z === 0) return;
            const center = new Vector3();
            box.getCenter(center);
            result.push({ position: [center.x, box.max.y + 1.0, box.max.z], key, data: item });
        });
        return result;
    }, [scene, data, renderLabel]);

    return (
        <group onPointerDown={handlePointerDown}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 5, 5]} intensity={0.7} />
            <primitive object={scene} />
            {renderLabel && labelItems.map(l => {
                const content = renderLabel(l.data);
                if (!content) return null;
                return (
                    <Html key={`label-${l.key}`} position={l.position} center zIndexRange={[10, 10]}>
                        <div style={{ pointerEvents: 'none' }}>{content}</div>
                    </Html>
                );
            })}
            {markers.map(m => (
                <Html key={m.key} position={m.position} center zIndexRange={[1, 1]}>
                    <div style={{ cursor: 'pointer', pointerEvents: 'none' }}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#d92d20" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                    </div>
                </Html>
            ))}
            <ConstrainedOrbitControls
                ref={controlsRef}
                bounds={bounds}
                enableZoom={true}
                mouseButtons={{
                    LEFT: MOUSE.ROTATE,
                    MIDDLE: MOUSE.PAN,
                    RIGHT: MOUSE.DOLLY,
                }}
            />
        </group>
    );
}

export default function ThreeModelView({ url, data, colorKey, renderPopover, activeResourceId, initialCamera, onSaveCamera, onObjectClick, popoverRef: externalPopoverRef, renderLabel, ...props }: ThreeModelViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [popover, setPopover] = useState<PopoverState | null>(null);

    // Expose a dismiss function via the external ref
    if (externalPopoverRef) {
        externalPopoverRef.current = () => setPopover(null);
    }
    const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);
    const [clampedPos, setClampedPos] = useState<PopoverPosition | null>(null);
    const getCameraStateRef = useRef<(() => CameraState | null) | null>(null);

    // Clamp popover position to stay within container bounds
    useEffect(() => {
        if (!popoverPos || !popoverRef.current || !containerRef.current) {
            setClampedPos(popoverPos);
            return;
        }
        const container = containerRef.current;
        const el = popoverRef.current;
        const cW = container.clientWidth;
        const cH = container.clientHeight;
        const elW = el.offsetWidth;
        const elH = el.offsetHeight;
        const pad = 8;

        // Default anchor: centered horizontally, above the point
        let left = popoverPos.left - elW / 2;
        let top = popoverPos.top - elH - 12;

        // Clamp horizontal
        if (left < pad) left = pad;
        if (left + elW > cW - pad) left = cW - pad - elW;

        // If above overflows top, place below the point
        if (top < pad) top = popoverPos.top + 12;

        // Clamp vertical
        if (top + elH > cH - pad) top = cH - pad - elH;
        if (top < pad) top = pad;

        setClampedPos({ left, top });
    }, [popoverPos]);

    const pointerDownRef = useRef<{ x: number; y: number; time: number; } | null>(null);
    const justSetPopoverRef = useRef(false);
    const lastClickedDataRef = useRef<ObjectData | null>(null);
    const DRAG_THRESHOLD = 5;
    const CLICK_TIME = 300;

    // Save camera on spacebar
    useEffect(() => {
        if (!onSaveCamera) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code !== 'Space') return;
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;
            e.preventDefault();
            const state = getCameraStateRef.current?.();
            if (state) onSaveCamera(state);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onSaveCamera]);

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
            if (justSetPopoverRef.current) {
                onObjectClick?.(lastClickedDataRef.current);
                // Dispatch custom event for popover menu communication
                if (lastClickedDataRef.current) {
                    document.dispatchEvent(new CustomEvent('threeview-object-click', {
                        detail: { data: lastClickedDataRef.current, x: e.clientX, y: e.clientY }
                    }));
                }
            } else {
                setPopover(null);
                onObjectClick?.(null);
                document.dispatchEvent(new CustomEvent('threeview-object-click', { detail: null }));
            }
        }
        pointerDownRef.current = null;
        justSetPopoverRef.current = false;
        lastClickedDataRef.current = null;
    };

    const handleMiss = () => {
        setPopover(null);
    };

    return (
        <div ref={containerRef} {...props} style={{ ...props.style, position: 'relative' }}>
            <Canvas
                camera={{ position: [0, 5, 0], fov: 50 }}
                gl={{ alpha: true }}
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
                    lastClickedDataRef={lastClickedDataRef}
                    activeResourceId={activeResourceId}
                    initialCamera={initialCamera}
                    onSaveCamera={onSaveCamera}
                    getCameraStateRef={getCameraStateRef}
                    renderLabel={renderLabel}
                />
            </Canvas>
            {popover && popoverPos && Number.isFinite(popoverPos.left) && Number.isFinite(popoverPos.top) && renderPopover && (
                <div
                    ref={popoverRef}
                    onPointerDown={e => e.stopPropagation()}
                    onPointerUp={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        left: clampedPos?.left ?? popoverPos.left,
                        top: clampedPos?.top ?? popoverPos.top,
                        pointerEvents: 'auto',
                        zIndex: 20,
                    }}
                >
                    {renderPopover(popover.data)}
                </div>
            )}
        </div>
    );
}
