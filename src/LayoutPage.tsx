import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import type { Resource } from './viewer/types';
import './app.css';

type LineConfig = {
  id: string;
  name: string;
  glb: string;
  camera?: { position: [number, number, number]; target: [number, number, number] };
};

function layoutKey(nodeName: string): string {
  const parts = nodeName.split('_');
  return parts.length > 1 ? parts.slice(1).join('_') : nodeName;
}

function LabelledScene({ url, resources }: { url: string; resources: Resource[] }) {
  const { scene } = useGLTF(url, true);
  const [labels, setLabels] = useState<{ position: [number, number, number]; name: string; layoutName: string; type: string }[]>([]);

  useEffect(() => {
    if (!scene) return;
    const layoutNames = new Set(resources.map(r => r.layout_name));
    const result: typeof labels = [];

    const tryBuild = () => {
      scene.traverse(obj => {
        if (!obj.name) return;
        const key = layoutKey(obj.name);
        if (!layoutNames.has(key)) return;
        const res = resources.find(r => r.layout_name === key);
        if (!res) return;
        const box = new Box3().setFromObject(obj);
        const size = new Vector3();
        box.getSize(size);
        if (size.x === 0 && size.y === 0 && size.z === 0) return;
        const center = new Vector3();
        box.getCenter(center);
        result.push({
          position: [center.x, box.max.y + 0.3, center.z],
          name: res.name,
          layoutName: res.layout_name,
          type: res.type,
        });
      });

      if (result.length > 0) {
        setLabels(result);
      } else {
        requestAnimationFrame(tryBuild);
      }
    };
    requestAnimationFrame(tryBuild);
  }, [scene, resources]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={0.7} />
      <primitive object={scene} />
      {labels.map(l => (
        <Html key={l.layoutName} position={l.position} center style={{ pointerEvents: 'none' }}>
          <div className="layout-label">
            <div className="layout-label-key">{l.layoutName}</div>
            <div className="layout-label-name">{l.name}</div>
          </div>
        </Html>
      ))}
      <OrbitControls />
    </>
  );
}

export function LayoutPage() {
  const [lines, setLines] = useState<LineConfig[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/data/models.json').then(r => r.json()),
      fetch('/data/resource.json').then(r => r.json()),
    ]).then(([modelsData, resData]) => {
      setLines(modelsData.lines);
      setResources(resData.resources);
      setActiveLineId(modelsData.lines[0]?.id ?? null);
    });
  }, []);

  const activeLine = lines.find(l => l.id === activeLineId);
  const lineResources = resources.filter(r =>
    r.line === activeLineId && r.type !== 'stock' && r.type !== 'queue'
  );

  if (!activeLine) {
    return <div className="layout-page"><div className="loading-text">Loading...</div></div>;
  }

  return (
    <div className="layout-page">
      <div className="layout-header">
        <h1 className="layout-title">Layout Overview</h1>
        <div className="layout-tabs">
          {lines.map(line => (
            <button
              key={line.id}
              className={`layout-tab${line.id === activeLineId ? ' active' : ''}`}
              onClick={() => setActiveLineId(line.id)}
            >
              {line.name}
            </button>
          ))}
        </div>
      </div>
      <div className="layout-canvas">
        <Canvas
          key={activeLine.id}
          camera={{ position: activeLine.camera?.position ?? [0, 20, 30], fov: 50 }}
          gl={{ alpha: true }}
        >
          <LabelledScene url={activeLine.glb} resources={lineResources} />
        </Canvas>
      </div>
    </div>
  );
}
