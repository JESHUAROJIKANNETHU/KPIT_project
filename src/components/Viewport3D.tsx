// ============================================================
// 3D Engineering Viewport – Vehicle Digital Twin
// React Three Fiber + Drei
// ============================================================

import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Environment, ContactShadows, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useWorkstationStore, CameraPreset, RenderMode, AnalysisOverlay } from '../store/workstationStore';
import { AssemblyNode, flattenAssembly } from '../data/vehicleAssembly';

// ── Camera Controller with Real Fit, Reset & Presets ──
function CameraController() {
  const controlsRef = useRef<any>(null);
  const { camera, scene } = useThree();
  const cameraPreset = useWorkstationStore(s => s.cameraPreset);
  const viewMode = useWorkstationStore(s => s.viewMode);
  const fitCameraTrigger = useWorkstationStore(s => s.fitCameraTrigger);
  const resetCameraTrigger = useWorkstationStore(s => s.resetCameraTrigger);

  // Camera presets
  useEffect(() => {
    if (!cameraPreset || !controlsRef.current) return;
    const dist = 6.0;
    const presets: Record<CameraPreset, [number, number, number]> = {
      isometric: [dist * 0.75, dist * 0.55, dist * 0.75],
      front: [0, 0.45, dist],
      rear: [0, 0.45, -dist],
      left: [-dist, 0.45, 0],
      right: [dist, 0.45, 0],
      top: [0, dist * 1.2, 0.001],
      bottom: [0, -dist * 1.2, 0.001],
    };
    const pos = presets[cameraPreset];
    if (pos) {
      camera.position.set(...pos);
      controlsRef.current.target.set(0, 0.4, 0);
      controlsRef.current.update();
    }
  }, [cameraPreset, camera]);

  // Fit camera to full vehicle model
  useEffect(() => {
    if (fitCameraTrigger === 0 || !controlsRef.current) return;
    // Calculate bounding box of all meshes in scene
    const box = new THREE.Box3();
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.visible) {
        box.expandByObject(obj);
      }
    });

    if (!box.isEmpty()) {
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = maxDim * 1.6;

      const dir = camera.position.clone().sub(controlsRef.current.target).normalize();
      camera.position.copy(center).add(dir.multiplyScalar(dist));
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  }, [fitCameraTrigger, camera, scene]);

  // Reset camera to default isometric view
  useEffect(() => {
    if (resetCameraTrigger === 0 || !controlsRef.current) return;
    camera.position.set(4.5, 3.5, 4.5);
    controlsRef.current.target.set(0, 0.4, 0);
    controlsRef.current.update();
  }, [resetCameraTrigger, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 0.4, 0]}
      minDistance={1.2}
      maxDistance={25}
      enableDamping
      dampingFactor={0.07}
      rotateSpeed={0.65}
      panSpeed={0.65}
      zoomSpeed={0.8}
    />
  );
}

// ── Geometry Generator for Detailed Vehicle Assembly ──
function createComponentGeometry(node: AssemblyNode): THREE.BufferGeometry {
  const id = node.id;

  // Wheels: Tyre + Rim combination
  if (id.startsWith('wheel-')) {
    return new THREE.CylinderGeometry(0.33, 0.33, 0.23, 32);
  }

  // Engine Block: Subdivided box with cylinder indentations
  if (id === 'engine-block') {
    return new THREE.BoxGeometry(0.48, 0.38, 0.42);
  }

  // Cylinder Head
  if (id === 'engine-cylinderhead') {
    return new THREE.BoxGeometry(0.46, 0.14, 0.4);
  }

  // Intake manifold
  if (id === 'engine-intake') {
    return new THREE.BoxGeometry(0.28, 0.18, 0.24);
  }

  // Exhaust manifold & pipe
  if (id === 'engine-exhaust') {
    return new THREE.CylinderGeometry(0.045, 0.06, 0.95, 16);
  }

  // Radiator core
  if (id === 'cooling-radiator') {
    return new THREE.BoxGeometry(0.66, 0.44, 0.045);
  }

  // Radiator fan
  if (id === 'cooling-fan') {
    return new THREE.CylinderGeometry(0.21, 0.21, 0.04, 24);
  }

  // Water pump
  if (id === 'cooling-pump') {
    return new THREE.CylinderGeometry(0.065, 0.065, 0.12, 16);
  }

  // Transmission casing
  if (id === 'transmission') {
    return new THREE.BoxGeometry(0.42, 0.32, 0.54);
  }

  // Body shell exterior
  if (id === 'body-exterior') {
    return new THREE.BoxGeometry(1.78, 0.68, 4.1);
  }

  // Interior cabin structure
  if (id === 'body-interior') {
    return new THREE.BoxGeometry(1.48, 0.52, 2.5);
  }

  // Chassis structural rails
  if (id === 'body-chassis') {
    return new THREE.BoxGeometry(1.72, 0.1, 4.15);
  }

  // Front suspension crossmember & wishbones
  if (id === 'suspension-front') {
    return new THREE.BoxGeometry(1.55, 0.14, 0.32);
  }

  // Rear suspension beam & arms
  if (id === 'suspension-rear') {
    return new THREE.BoxGeometry(1.55, 0.14, 0.32);
  }

  // Brakes: Ventilated Rotor
  if (id === 'braking-disc') {
    return new THREE.CylinderGeometry(0.145, 0.145, 0.026, 24);
  }

  // Brake Caliper
  if (id === 'braking-caliper') {
    return new THREE.BoxGeometry(0.09, 0.11, 0.07);
  }

  // ABS hydraulic module
  if (id === 'braking-abs') {
    return new THREE.BoxGeometry(0.14, 0.1, 0.12);
  }

  // High Voltage Battery Pack
  if (id === 'electrical-battery') {
    return new THREE.BoxGeometry(1.2, 0.18, 1.8);
  }

  // ECU / Power Electronics
  if (id === 'electrical-ecu') {
    return new THREE.BoxGeometry(0.22, 0.05, 0.14);
  }

  // Fallback parametric box
  return new THREE.BoxGeometry(0.35, 0.35, 0.35);
}

// ── Individual CAD Component Mesh ──
function ComponentMesh({
  node,
  explodeAmount,
  sectionEnabled,
  sectionAxis,
  sectionPosition,
  analysisOverlay,
  renderMode,
}: {
  node: AssemblyNode;
  explodeAmount: number;
  sectionEnabled: boolean;
  sectionAxis: 'x' | 'y' | 'z';
  sectionPosition: number;
  analysisOverlay: AnalysisOverlay;
  renderMode: RenderMode;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const selectNode = useWorkstationStore(s => s.selectNode);
  const hoverNode = useWorkstationStore(s => s.hoverNode);
  const selectedNodeId = useWorkstationStore(s => s.selectedNodeId);
  const hoveredNodeId = useWorkstationStore(s => s.hoveredNodeId);
  const activeTool = useWorkstationStore(s => s.activeTool);
  const addMeasurePoint = useWorkstationStore(s => s.addMeasurePoint);
  const openContextMenu = useWorkstationStore(s => s.openContextMenu);

  const isSelected = selectedNodeId === node.id;
  const isHovered = hoveredNodeId === node.id;

  // Real Exploded View Translation Vector
  const finalPos = useMemo(() => {
    const base = new THREE.Vector3(...node.position);
    if (explodeAmount > 0.001) {
      const vec = node.explosionVector
        ? new THREE.Vector3(...node.explosionVector)
        : base.clone().normalize();
      base.add(vec.multiplyScalar(explodeAmount * 2.2));
    }
    return base;
  }, [node.position, node.explosionVector, explodeAmount]);

  // Real Section Clipping Plane
  const clippingPlane = useMemo(() => {
    if (!sectionEnabled) return null;
    const normals: Record<string, THREE.Vector3> = {
      x: new THREE.Vector3(1, 0, 0),
      y: new THREE.Vector3(0, 1, 0),
      z: new THREE.Vector3(0, 0, 1),
    };
    return new THREE.Plane(normals[sectionAxis], -sectionPosition * 2.5);
  }, [sectionEnabled, sectionAxis, sectionPosition]);

  // Geometry
  const geometry = useMemo(() => createComponentGeometry(node), [node]);

  // Material Color Calculation
  const color = useMemo(() => {
    if (isSelected) return '#ffffff';
    if (isHovered) {
      return new THREE.Color(node.color).lerp(new THREE.Color('#ffffff'), 0.28).getHexString();
    }
    if (analysisOverlay === 'thermal') {
      const p = node.parameters.find(x => x.name.toLowerCase().includes('temp'));
      if (p) {
        const val = Number(p.value);
        if (val > 400) return '#e74c3c';
        if (val > 150) return '#e67e22';
        if (val > 80) return '#f1c40f';
        return '#3498db';
      }
      return '#2980b9';
    }
    if (analysisOverlay === 'stress') {
      if (node.id.includes('chassis') || node.id.includes('suspension')) return '#e74c3c';
      if (node.id.includes('block') || node.id.includes('brake')) return '#e67e22';
      return '#27ae60';
    }
    if (analysisOverlay === 'efficiency') {
      const p = node.parameters.find(x => x.name.toLowerCase().includes('efficiency'));
      if (p) {
        const eff = Number(p.value);
        if (eff > 90) return '#2ecc71';
        if (eff > 70) return '#f39c12';
        return '#e74c3c';
      }
      return '#34495e';
    }
    return node.color;
  }, [node.color, isSelected, isHovered, analysisOverlay, node.parameters, node.id]);

  // Rotation for specific parts (wheels, discs, fans)
  const rotation = useMemo((): [number, number, number] => {
    if (node.id.startsWith('wheel-') || node.id.startsWith('braking-disc')) {
      const isLeft = node.id.includes('-fl') || node.id.includes('-rl');
      return [0, 0, isLeft ? Math.PI / 2 : -Math.PI / 2];
    }
    if (node.id === 'cooling-fan') {
      return [Math.PI / 2, 0, 0];
    }
    return [0, 0, 0];
  }, [node.id]);

  // Handle pointer interactions (select, measure, context menu)
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (activeTool === 'measure') {
      // Raycast point in world space
      addMeasurePoint([e.point.x, e.point.y, e.point.z]);
    } else {
      selectNode(node.id);
    }
  }, [activeTool, addMeasurePoint, selectNode, node.id]);

  const handleContextMenu = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectNode(node.id);
    openContextMenu(e.clientX, e.clientY, node.id);
  }, [selectNode, openContextMenu, node.id]);

  if (!node.visible) return null;

  // Exterior body shell semi-transparency in Solid mode to allow visibility of internal mechanics
  const isBodyShell = node.id === 'body-exterior';
  const effectiveOpacity = renderMode === 'xray'
    ? (isSelected ? 0.6 : 0.22)
    : isBodyShell
    ? 0.42
    : 1.0;

  const isTransparent = renderMode === 'xray' || isBodyShell;

  return (
    <mesh
      ref={meshRef}
      position={[finalPos.x, finalPos.y, finalPos.z]}
      rotation={rotation}
      geometry={geometry}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerOver={(e) => {
        e.stopPropagation();
        hoverNode(node.id);
        document.body.style.cursor = activeTool === 'measure' ? 'crosshair' : 'pointer';
      }}
      onPointerOut={() => {
        hoverNode(null);
        document.body.style.cursor = 'default';
      }}
    >
      {renderMode === 'wireframe' ? (
        <meshBasicMaterial
          color={color}
          wireframe
          clippingPlanes={clippingPlane ? [clippingPlane] : []}
          clipShadows
        />
      ) : (
        <meshStandardMaterial
          color={color}
          roughness={isSelected ? 0.25 : 0.45}
          metalness={isSelected ? 0.7 : 0.4}
          emissive={isSelected ? '#1e5a9c' : isHovered ? '#0e3056' : '#000000'}
          emissiveIntensity={isSelected ? 0.65 : isHovered ? 0.35 : 0}
          transparent={isTransparent}
          opacity={effectiveOpacity}
          clippingPlanes={clippingPlane ? [clippingPlane] : []}
          clipShadows
          side={isTransparent ? THREE.DoubleSide : THREE.FrontSide}
        />
      )}
    </mesh>
  );
}

// ── 3D Measurement Visualizer ──
function MeasurementVisualizer() {
  const points = useWorkstationStore(s => s.measurePoints);
  const data = useWorkstationStore(s => s.measureData);

  if (points.length === 0) return null;

  return (
    <group>
      {/* Point A Marker */}
      <mesh position={points[0]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color="#00ffcc" />
      </mesh>

      {/* Point B Marker */}
      {points[1] && (
        <mesh position={points[1]}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color="#ffcc00" />
        </mesh>
      )}

      {/* Dimension Line */}
      {points.length === 2 && data && (
        <Line
          points={[points[0], points[1]]}
          color="#00ffcc"
          lineWidth={2.5}
          dashed={false}
        />
      )}
    </group>
  );
}

// ── Selection Bounding Box Indicator ──
function SelectionIndicatorMesh({ node }: { node: AssemblyNode | null }) {
  const explodeAmount = useWorkstationStore(s => s.explodeAmount);
  if (!node || node.type !== 'part') return null;

  const dims = node.dimensions || [350, 350, 350];
  const scale: [number, number, number] = [
    dims[0] / 1000 + 0.04,
    dims[1] / 1000 + 0.04,
    dims[2] / 1000 + 0.04,
  ];

  const pos = new THREE.Vector3(...node.position);
  if (explodeAmount > 0.001) {
    const vec = node.explosionVector
      ? new THREE.Vector3(...node.explosionVector)
      : pos.clone().normalize();
    pos.add(vec.multiplyScalar(explodeAmount * 2.2));
  }

  return (
    <mesh position={[pos.x, pos.y, pos.z]}>
      <boxGeometry args={scale} />
      <meshBasicMaterial color="#4a9edd" wireframe transparent opacity={0.65} />
    </mesh>
  );
}

// ── 3D Scene Assembly Root ──
function SceneContent() {
  const assembly = useWorkstationStore(s => s.assembly);
  const explodeAmount = useWorkstationStore(s => s.explodeAmount);
  const sectionEnabled = useWorkstationStore(s => s.sectionEnabled);
  const sectionAxis = useWorkstationStore(s => s.sectionAxis);
  const sectionPosition = useWorkstationStore(s => s.sectionPosition);
  const analysisOverlay = useWorkstationStore(s => s.analysisOverlay);
  const renderMode = useWorkstationStore(s => s.renderMode);
  const showGrid = useWorkstationStore(s => s.showGrid);
  const showAxes = useWorkstationStore(s => s.showAxes);
  const selectedNodeId = useWorkstationStore(s => s.selectedNodeId);
  const selectNode = useWorkstationStore(s => s.selectNode);
  const activeTool = useWorkstationStore(s => s.activeTool);
  const closeContextMenu = useWorkstationStore(s => s.closeContextMenu);

  const { gl } = useThree();

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  const flatNodes = useMemo(() => flattenAssembly(assembly), [assembly]);
  const parts = useMemo(() => flatNodes.filter(n => n.type === 'part'), [flatNodes]);
  const selectedNode = useMemo(() => flatNodes.find(n => n.id === selectedNodeId) || null, [flatNodes, selectedNodeId]);

  const handleBgClick = useCallback(() => {
    closeContextMenu();
    if (activeTool !== 'measure') {
      selectNode(null);
    }
  }, [closeContextMenu, activeTool, selectNode]);

  return (
    <>
      {/* Lighting Rig */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 9, 6]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 6, -5]} intensity={0.35} />
      <directionalLight position={[0, -4, 0]} intensity={0.15} />

      {/* Environment reflections */}
      <Environment preset="city" background={false} />

      {/* Camera Controls */}
      <CameraController />

      {/* Ground Reference Grid */}
      {showGrid && (
        <Grid
          args={[24, 24]}
          position={[0, -0.01, 0]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#26262c"
          sectionSize={2.0}
          sectionThickness={1.2}
          sectionColor="#363640"
          fadeDistance={18}
          fadeStrength={1}
          infiniteGrid
        />
      )}

      {/* Coordinate Axes Triad */}
      {showAxes && (
        <group position={[0, 0.01, 0]}>
          <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1.6, 0xee4444, 0.08, 0.05]} />
          <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.6, 0x44ee44, 0.08, 0.05]} />
          <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 1.6, 0x4488ee, 0.08, 0.05]} />
        </group>
      )}

      {/* Ground Contact Shadows */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={10}
        blur={2.4}
        far={3.5}
      />

      {/* Background Plane for Deselecting */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleBgClick} visible={false}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial />
      </mesh>

      {/* CAD Vehicle Assembly Components */}
      {parts.map(part => (
        <ComponentMesh
          key={part.id}
          node={part}
          explodeAmount={explodeAmount}
          sectionEnabled={sectionEnabled}
          sectionAxis={sectionAxis}
          sectionPosition={sectionPosition}
          analysisOverlay={analysisOverlay}
          renderMode={renderMode}
        />
      ))}

      {/* Selected Entity Bounding Wireframe */}
      {selectedNode && <SelectionIndicatorMesh node={selectedNode} />}

      {/* 3D Measurement Visualizer */}
      <MeasurementVisualizer />

      {/* Section Plane Visual Helper */}
      {sectionEnabled && (
        <mesh
          position={
            sectionAxis === 'x' ? [sectionPosition * 2.5, 0.5, 0] :
            sectionAxis === 'y' ? [0, sectionPosition * 2.5, 0] :
            [0, 0.5, sectionPosition * 2.5]
          }
          rotation={
            sectionAxis === 'x' ? [0, Math.PI / 2, 0] :
            sectionAxis === 'y' ? [Math.PI / 2, 0, 0] :
            [0, 0, 0]
          }
        >
          <planeGeometry args={[5.5, 5.5]} />
          <meshBasicMaterial color="#3498db" transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Viewport Corner Orientation Gizmo */}
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport
          axisColors={['#e74c3c', '#2ecc71', '#3498db']}
          labelColor="#ffffff"
        />
      </GizmoHelper>
    </>
  );
}

// ── Viewport Context Menu ──
function ViewportContextMenu() {
  const contextMenu = useWorkstationStore(s => s.contextMenu);
  const closeContextMenu = useWorkstationStore(s => s.closeContextMenu);
  const hideSelected = useWorkstationStore(s => s.hideSelected);
  const isolateSelected = useWorkstationStore(s => s.isolateSelected);
  const restoreAll = useWorkstationStore(s => s.restoreAll);
  const setActiveTool = useWorkstationStore(s => s.setActiveTool);
  const resetToBaseline = useWorkstationStore(s => s.resetToBaseline);
  const togglePropertyInspector = useWorkstationStore(s => s.togglePropertyInspector);

  if (!contextMenu.visible) return null;

  return (
    <div
      className="context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={e => e.stopPropagation()}
    >
      <div
        className="context-menu__item"
        onClick={() => {
          togglePropertyInspector();
          closeContextMenu();
        }}
      >
        <span>Inspect Properties</span>
        <span className="context-menu__item-shortcut">Ctrl+I</span>
      </div>
      <div
        className="context-menu__item"
        onClick={() => {
          hideSelected();
          closeContextMenu();
        }}
      >
        <span>Hide Component</span>
        <span className="context-menu__item-shortcut">H</span>
      </div>
      <div
        className="context-menu__item"
        onClick={() => {
          isolateSelected();
          closeContextMenu();
        }}
      >
        <span>Isolate Component</span>
        <span className="context-menu__item-shortcut">I</span>
      </div>
      <div
        className="context-menu__item"
        onClick={() => {
          restoreAll();
          closeContextMenu();
        }}
      >
        <span>Show All Components</span>
      </div>
      <div className="context-menu__sep" />
      <div
        className="context-menu__item"
        onClick={() => {
          setActiveTool('measure');
          closeContextMenu();
        }}
      >
        <span>Measure From Here</span>
        <span className="context-menu__item-shortcut">M</span>
      </div>
      <div
        className="context-menu__item"
        onClick={() => {
          resetToBaseline();
          closeContextMenu();
        }}
      >
        <span>Reset Component to Default</span>
      </div>
    </div>
  );
}

// ── Main Viewport3D Component ──
export default function Viewport3D() {
  const selectedNodeId = useWorkstationStore(s => s.selectedNodeId);
  const selectedNodePath = useWorkstationStore(s => s.selectedNodePath);
  const assembly = useWorkstationStore(s => s.assembly);
  const viewMode = useWorkstationStore(s => s.viewMode);
  const renderMode = useWorkstationStore(s => s.renderMode);
  const activeTool = useWorkstationStore(s => s.activeTool);
  const setCameraPreset = useWorkstationStore(s => s.setCameraPreset);
  const measureData = useWorkstationStore(s => s.measureData);
  const measurePoints = useWorkstationStore(s => s.measurePoints);
  const clearMeasurement = useWorkstationStore(s => s.clearMeasurement);
  const setActiveTool = useWorkstationStore(s => s.setActiveTool);

  const flatNodes = useMemo(() => flattenAssembly(assembly), [assembly]);
  const selectedNode = useMemo(
    () => flatNodes.find(n => n.id === selectedNodeId) || null,
    [flatNodes, selectedNodeId]
  );

  return (
    <div className="viewport-container" onContextMenu={e => e.preventDefault()}>
      <Canvas
        camera={{
          position: [4.5, 3.5, 4.5],
          fov: viewMode === 'perspective' ? 45 : 22,
          near: 0.1,
          far: 120,
        }}
        gl={{ antialias: true, alpha: false, localClippingEnabled: true }}
        shadows
        dpr={[1, 2]}
        style={{ background: '#18181c' }}
        orthographic={viewMode === 'orthographic'}
      >
        <SceneContent />
      </Canvas>

      {/* Context Menu */}
      <ViewportContextMenu />

      {/* Top Left Viewport Telemetry */}
      <div className="viewport-overlay viewport-overlay--top-left">
        <div className="viewport-info">
          <div style={{ color: 'var(--text-accent)', fontWeight: 600 }}>
            {viewMode.toUpperCase()} · {renderMode.toUpperCase()}
          </div>
          <div>ACTIVE TOOL: {activeTool.toUpperCase()}</div>
        </div>
      </div>

      {/* Real CAD View Cube (Top Right) */}
      <div className="viewport-overlay viewport-overlay--top-right">
        <div className="viewport-cube" title="Standard Camera Viewpoints">
          <div />
          <button className="viewport-cube__btn" onClick={() => setCameraPreset('top')} title="Top View (Num 7)">TOP</button>
          <div />
          <button className="viewport-cube__btn" onClick={() => setCameraPreset('left')} title="Left View">L</button>
          <button className="viewport-cube__btn" onClick={() => setCameraPreset('front')} title="Front View (Num 1)">FRT</button>
          <button className="viewport-cube__btn" onClick={() => setCameraPreset('right')} title="Right View">R</button>
          <div />
          <button className="viewport-cube__btn" onClick={() => setCameraPreset('bottom')} title="Bottom View">BTM</button>
          <div />
        </div>
        <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center' }}>
          <button
            className="viewport-cube__btn"
            style={{ width: '100%', fontSize: 9 }}
            onClick={() => setCameraPreset('isometric')}
            title="Isometric View (Num 0)"
          >
            ISO
          </button>
        </div>
      </div>

      {/* Real Measurement HUD Readout */}
      {activeTool === 'measure' && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(20, 24, 32, 0.95)',
            border: '1px solid #00ffcc',
            borderRadius: 4,
            padding: '8px 16px',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: '#00ffcc', fontWeight: 600 }}>CAD MEASUREMENT TOOL</span>
            <button
              onClick={() => {
                clearMeasurement();
                setActiveTool('select');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              ✕ ESC
            </button>
          </div>
          {measurePoints.length === 0 && (
            <div style={{ color: '#aaa', fontSize: 11 }}>
              Click Point A on any component to begin measurement
            </div>
          )}
          {measurePoints.length === 1 && (
            <div style={{ color: '#ffcc00', fontSize: 11 }}>
              Point A set · Click Point B on destination component
            </div>
          )}
          {measureData && (
            <div style={{ marginTop: 2, display: 'flex', gap: 14, fontSize: 12 }}>
              <span style={{ color: '#00ffcc', fontWeight: 'bold' }}>
                DISTANCE: {measureData.distance.toFixed(2)} mm
              </span>
              <span style={{ color: '#ddd' }}>
                ΔX: {measureData.dx.toFixed(1)} mm
              </span>
              <span style={{ color: '#ddd' }}>
                ΔY: {measureData.dy.toFixed(1)} mm
              </span>
              <span style={{ color: '#ddd' }}>
                ΔZ: {measureData.dz.toFixed(1)} mm
              </span>
            </div>
          )}
        </div>
      )}

      {/* Selected Component Floating Breadcrumb Indicator */}
      {selectedNode && (
        <div className="selection-indicator">
          <span className="selection-indicator__path">{selectedNodePath.join(' / ')}</span>
          <span className="selection-indicator__name">
            {selectedNode.name} {selectedNode.partId ? `[${selectedNode.partId}]` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
