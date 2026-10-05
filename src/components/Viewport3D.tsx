// ============================================================
// 3D Engineering Viewport – Vehicle Digital Twin
// React Three Fiber + Drei with Procedural Component Detailing
// ============================================================

import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Environment, ContactShadows, Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useWorkstationStore, CameraPreset, RenderMode, AnalysisOverlay } from '../store/workstationStore';
import { AssemblyNode, flattenAssembly } from '../data/vehicleAssembly';
import ThreeDViewer, { MechanicalObjectType } from './ThreeDViewer';

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

  // Fit camera to full vehicle model or visible components
  useEffect(() => {
    if (fitCameraTrigger === 0 || !controlsRef.current) return;
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
      const maxDim = Math.max(size.x, size.y, size.z, 1.2);
      const dist = maxDim * 1.6;

      const dir = camera.position.clone().sub(controlsRef.current.target).normalize();
      if (dir.lengthSq() < 0.001) dir.set(0.7, 0.5, 0.7).normalize();
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
      minDistance={0.5}
      maxDistance={30}
      enableDamping
      dampingFactor={0.07}
      rotateSpeed={0.65}
      panSpeed={0.65}
      zoomSpeed={0.8}
    />
  );
}

// ── Helical Coil Spring Generator for Suspension ──
function createCoilSpringGeometry(radius = 0.09, height = 0.35, turns = 6, tubeRadius = 0.012): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const samples = 120;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const angle = t * turns * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    const y = (t - 0.5) * height;
    points.push(new THREE.Vector3(x, y, z));
  }
  const path = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(path, 80, tubeRadius, 10, false);
}

// ── Geometry Generator for Main Component Shells ──
function createComponentGeometry(node: AssemblyNode): THREE.BufferGeometry {
  const id = node.id;

  // Wheels: Tyre + Rim combination
  if (id.startsWith('wheel-')) {
    return new THREE.CylinderGeometry(0.33, 0.33, 0.23, 32);
  }

  // Engine Block
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

  // Exhaust manifold
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

  // Transmission / Gearbox casing
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

  // Front suspension wishbones / crossmember
  if (id === 'suspension-front') {
    return new THREE.BoxGeometry(1.55, 0.14, 0.32);
  }

  // Rear suspension beam & arms
  if (id === 'suspension-rear') {
    return new THREE.BoxGeometry(1.55, 0.14, 0.32);
  }

  // Brakes: Ventilated Rotor Disc
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

  // Battery Pack
  if (id === 'electrical-battery') {
    return new THREE.BoxGeometry(0.38, 0.22, 0.26);
  }

  // Alternator
  if (id === 'electrical-alternator') {
    return new THREE.CylinderGeometry(0.09, 0.09, 0.16, 24);
  }

  // ECU / Power Electronics
  if (id === 'electrical-ecu') {
    return new THREE.BoxGeometry(0.22, 0.05, 0.14);
  }

  // Fallback parametric box
  return new THREE.BoxGeometry(0.35, 0.35, 0.35);
}

// ── Detailed Procedural Component Mesh Decorator ──
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

  // Base Geometry
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

  // Rotation for specific parts (wheels, discs, fans, coils)
  const rotation = useMemo((): [number, number, number] => {
    if (node.id.startsWith('wheel-') || node.id.startsWith('braking-disc')) {
      const isLeft = node.id.includes('-fl') || node.id.includes('-rl');
      return [0, 0, isLeft ? Math.PI / 2 : -Math.PI / 2];
    }
    if (node.id === 'cooling-fan') {
      return [Math.PI / 2, 0, 0];
    }
    if (node.id === 'electrical-alternator') {
      return [0, 0, Math.PI / 2];
    }
    return [0, 0, 0];
  }, [node.id]);

  // Pointer interaction
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (activeTool === 'measure') {
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

  // Semi-transparency for body shell in solid render mode
  const isBodyShell = node.id === 'body-exterior';
  const effectiveOpacity = renderMode === 'xray'
    ? (isSelected ? 0.6 : 0.22)
    : isBodyShell
    ? 0.38
    : 1.0;

  const isTransparent = renderMode === 'xray' || isBodyShell;

  return (
    <group position={[finalPos.x, finalPos.y, finalPos.z]} rotation={rotation}>
      {/* Primary Component Mesh */}
      <mesh
        ref={meshRef}
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
            roughness={isSelected ? 0.25 : 0.42}
            metalness={isSelected ? 0.75 : 0.45}
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

      {/* ── Sub-component Procedural Details ── */}
      {renderMode !== 'wireframe' && (
        <>
          {/* BATTERY DETAILS (Terminals + Filler Caps) */}
          {node.id === 'electrical-battery' && (
            <group>
              {/* Positive Terminal (Red) */}
              <mesh position={[0.12, 0.13, 0.08]}>
                <cylinderGeometry args={[0.02, 0.022, 0.05, 16]} />
                <meshStandardMaterial color="#e74c3c" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* Negative Terminal (Blue/Black) */}
              <mesh position={[-0.12, 0.13, 0.08]}>
                <cylinderGeometry args={[0.02, 0.022, 0.05, 16]} />
                <meshStandardMaterial color="#2980b9" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* Top Cell Caps Strip */}
              <mesh position={[0, 0.115, -0.04]}>
                <boxGeometry args={[0.3, 0.015, 0.08]} />
                <meshStandardMaterial color="#111115" metalness={0.2} roughness={0.6} />
              </mesh>
            </group>
          )}

          {/* ALTERNATOR DETAILS (Pulley + Stator Fins + Copper Winding Core) */}
          {node.id === 'electrical-alternator' && (
            <group>
              {/* Front Belt Drive Pulley Wheel */}
              <mesh position={[0, 0.09, 0]}>
                <cylinderGeometry args={[0.055, 0.055, 0.025, 24]} />
                <meshStandardMaterial color="#2c3e50" metalness={0.9} roughness={0.2} />
              </mesh>
              {/* Copper Winding Core Inside Vents */}
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.075, 0.075, 0.1, 16]} />
                <meshStandardMaterial color="#d35400" metalness={0.85} roughness={0.25} />
              </mesh>
            </group>
          )}

          {/* RADIATOR DETAILS (Fine Grill Texture Core + Hose Ports) */}
          {node.id === 'cooling-radiator' && (
            <group>
              {/* Radiator Cap (Shiny Metallic Silver) */}
              <mesh position={[0.28, 0.23, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.02, 16]} />
                <meshStandardMaterial color="#bdc3c7" metalness={0.95} roughness={0.1} />
              </mesh>
              {/* Upper & Lower Coolant Hoses */}
              <mesh position={[-0.26, 0.18, 0.04]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.022, 0.022, 0.1, 16]} />
                <meshStandardMaterial color="#111115" roughness={0.8} />
              </mesh>
            </group>
          )}

          {/* RADIATOR FAN DETAILS (6 Blade Rotor) */}
          {node.id === 'cooling-fan' && (
            <group>
              {/* Center Electric Motor Hub */}
              <mesh position={[0, 0.025, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 0.03, 16]} />
                <meshStandardMaterial color="#1a252f" metalness={0.8} />
              </mesh>
            </group>
          )}

          {/* ENGINE BLOCK DETAILS (Crank Pulley + Oil Pan) */}
          {node.id === 'engine-block' && (
            <group>
              {/* Front Harmonic Balancer Crank Pulley */}
              <mesh position={[0, -0.05, 0.23]}>
                <cylinderGeometry args={[0.09, 0.09, 0.04, 24]} />
                <meshStandardMaterial color="#34495e" metalness={0.85} roughness={0.3} />
              </mesh>
              {/* Oil Sump Pan */}
              <mesh position={[0, -0.22, 0]}>
                <boxGeometry args={[0.44, 0.08, 0.38]} />
                <meshStandardMaterial color="#1c2833" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          )}

          {/* TRANSMISSION DETAILS (Bell Housing + Output Shaft Flanges) */}
          {node.id === 'transmission' && (
            <group>
              {/* Front Engine Bell Housing Adapter */}
              <mesh position={[0, 0, 0.24]}>
                <cylinderGeometry args={[0.22, 0.18, 0.1, 24]} />
                <meshStandardMaterial color="#7f8c8d" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* Left Output Driveshaft Stub */}
              <mesh position={[-0.23, -0.05, -0.05]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.04, 0.04, 0.08, 16]} />
                <meshStandardMaterial color="#2c3e50" metalness={0.9} />
              </mesh>
              {/* Right Output Driveshaft Stub */}
              <mesh position={[0.23, -0.05, -0.05]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.04, 0.04, 0.08, 16]} />
                <meshStandardMaterial color="#2c3e50" metalness={0.9} />
              </mesh>
            </group>
          )}

          {/* SUSPENSION DETAILS (Real 3D Coil Springs) */}
          {node.id === 'suspension-front' && (
            <group>
              {/* Left MacPherson Coil Spring */}
              <mesh position={[-0.65, 0.12, 0]} geometry={createCoilSpringGeometry(0.085, 0.28, 6, 0.012)}>
                <meshStandardMaterial color="#e74c3c" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Right MacPherson Coil Spring */}
              <mesh position={[0.65, 0.12, 0]} geometry={createCoilSpringGeometry(0.085, 0.28, 6, 0.012)}>
                <meshStandardMaterial color="#e74c3c" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Left Shock Damper Rod */}
              <mesh position={[-0.65, 0.12, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.32, 16]} />
                <meshStandardMaterial color="#ecf0f1" metalness={0.95} roughness={0.1} />
              </mesh>
              {/* Right Shock Damper Rod */}
              <mesh position={[0.65, 0.12, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.32, 16]} />
                <meshStandardMaterial color="#ecf0f1" metalness={0.95} roughness={0.1} />
              </mesh>
            </group>
          )}

          {/* REAR SUSPENSION COIL SPRINGS */}
          {node.id === 'suspension-rear' && (
            <group>
              <mesh position={[-0.65, 0.1, 0]} geometry={createCoilSpringGeometry(0.08, 0.25, 5, 0.011)}>
                <meshStandardMaterial color="#27ae60" metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh position={[0.65, 0.1, 0]} geometry={createCoilSpringGeometry(0.08, 0.25, 5, 0.011)}>
                <meshStandardMaterial color="#27ae60" metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
          )}

          {/* BRAKE CALIPER & ROTOR DETAILS */}
          {node.id === 'braking-disc' && (
            <group>
              {/* Center Wheel Mounting Hat */}
              <mesh position={[0, 0.018, 0]}>
                <cylinderGeometry args={[0.075, 0.075, 0.015, 24]} />
                <meshStandardMaterial color="#34495e" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          )}
        </>
      )}
    </group>
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
  const triggerFitCamera = useWorkstationStore(s => s.triggerFitCamera);
  const triggerResetCamera = useWorkstationStore(s => s.triggerResetCamera);
  const resetCameraTrigger = useWorkstationStore(s => s.resetCameraTrigger);
  const fitCameraTrigger = useWorkstationStore(s => s.fitCameraTrigger);
  const measureData = useWorkstationStore(s => s.measureData);
  const measurePoints = useWorkstationStore(s => s.measurePoints);
  const clearMeasurement = useWorkstationStore(s => s.clearMeasurement);
  const setActiveTool = useWorkstationStore(s => s.setActiveTool);
  const isolateNode = useWorkstationStore(s => s.isolateNode);
  const showAllNodes = useWorkstationStore(s => s.showAllNodes);
  const toggleNodeVisibility = useWorkstationStore(s => s.toggleNodeVisibility);
  const explodeAmount = useWorkstationStore(s => s.explodeAmount);
  const setExplodeAmount = useWorkstationStore(s => s.setExplodeAmount);
  const selectNode = useWorkstationStore(s => s.selectNode);
  const analysisOverlay = useWorkstationStore(s => s.analysisOverlay);
  const showGrid = useWorkstationStore(s => s.showGrid);
  const showAxes = useWorkstationStore(s => s.showAxes);

  const [activeObjectType, setActiveObjectType] = useState<MechanicalObjectType>('full-car');

  const flatNodes = useMemo(() => flattenAssembly(assembly), [assembly]);
  const selectedNode = useMemo(
    () => flatNodes.find(n => n.id === selectedNodeId) || null,
    [flatNodes, selectedNodeId]
  );

  const handleObjectTypeChange = useCallback((type: MechanicalObjectType) => {
    setActiveObjectType(type);
    if (type === 'full-car') {
      showAllNodes();
      setExplodeAmount(0);
      setCameraPreset('isometric');
      setTimeout(() => triggerFitCamera(), 50);
    } else if (type === 'engine') {
      isolateNode('engine');
      setCameraPreset('front');
      setTimeout(() => triggerFitCamera(), 50);
    } else if (type === 'transmission') {
      isolateNode('transmission');
      setCameraPreset('isometric');
      setTimeout(() => triggerFitCamera(), 50);
    } else if (type === 'battery-accelerator') {
      isolateNode('electrical');
      setCameraPreset('top');
      setTimeout(() => triggerFitCamera(), 50);
    } else if (type === 'radiator') {
      isolateNode('engine-cooling');
      setCameraPreset('front');
      setTimeout(() => triggerFitCamera(), 50);
    } else if (type === 'brakes') {
      isolateNode('braking');
      setCameraPreset('left');
      setTimeout(() => triggerFitCamera(), 50);
    } else if (type === 'suspension') {
      isolateNode('suspension');
      setCameraPreset('isometric');
      setTimeout(() => triggerFitCamera(), 50);
    }
  }, [isolateNode, showAllNodes, setExplodeAmount, setCameraPreset, triggerFitCamera]);

  return (
    <div className="viewport-container" onContextMenu={e => e.preventDefault()}>
      <ThreeDViewer
        selectedObjectType={activeObjectType}
        onObjectTypeChange={handleObjectTypeChange}
        showSelector={true}
        showResetButton={true}
        backgroundColor="#18181c"
        explodeAmount={explodeAmount}
        renderMode={renderMode}
        analysisOverlay={analysisOverlay}
        showGrid={showGrid}
        showAxes={showAxes}
        viewMode={viewMode}
        resetTrigger={resetCameraTrigger}
        fitTrigger={fitCameraTrigger}
        selectedEntityId={selectedNodeId}
        onSelectEntity={(id) => selectNode(id)}
      >
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
              onClick={() => {
                setCameraPreset('isometric');
                triggerResetCamera();
              }}
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
              top: 50,
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
      </ThreeDViewer>
    </div>
  );
}
