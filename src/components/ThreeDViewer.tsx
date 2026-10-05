// ============================================================
// ThreeDViewer – Reusable Interactive 3D Mechanical Object Viewer
// Built with Three.js, React Three Fiber, and Drei
// ============================================================

import React, { useRef, useMemo, useEffect, useState, Suspense, useCallback } from 'react';
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Environment,
  ContactShadows,
  useGLTF,
  Html,
} from '@react-three/drei';
import * as THREE from 'three';

// ── Types & Interfaces ──
export type MechanicalObjectType =
  | 'full-car'
  | 'engine'
  | 'transmission'
  | 'battery-accelerator'
  | 'radiator'
  | 'brakes'
  | 'suspension';

export interface ThreeDViewerProps {
  /** Optional URL to a .glb or .gltf 3D model */
  modelUrl?: string;
  /** Currently selected mechanical object to display */
  selectedObjectType?: MechanicalObjectType;
  /** Callback when user changes the mechanical object selection */
  onObjectTypeChange?: (type: MechanicalObjectType) => void;
  /** Show the top mechanical object selector bar */
  showSelector?: boolean;
  /** Show the floating Reset View button */
  showResetButton?: boolean;
  /** Enable auto-rotation of the 3D model */
  autoRotate?: boolean;
  /** Background color of the 3D canvas */
  backgroundColor?: string;
  /** CSS class name for container */
  className?: string;
  /** Custom inline style */
  style?: React.CSSProperties;
  /** Explode amount for assembly (0 to 1) */
  explodeAmount?: number;
  /** Wireframe / Solid / XRay render mode */
  renderMode?: 'solid' | 'wireframe' | 'xray';
  /** Thermal / Stress / Efficiency analysis overlay color scheme */
  analysisOverlay?: 'none' | 'thermal' | 'stress' | 'efficiency';
  /** Show ground grid */
  showGrid?: boolean;
  /** Show coordinate axes */
  showAxes?: boolean;
  /** Perspective vs Orthographic view mode */
  viewMode?: 'perspective' | 'orthographic';
  /** External reset camera trigger counter */
  resetTrigger?: number;
  /** External fit camera trigger counter */
  fitTrigger?: number;
  /** Currently selected entity ID */
  selectedEntityId?: string | null;
  /** Callback when an entity is clicked/selected */
  onSelectEntity?: (id: string | null) => void;
  /** Children elements to overlay on top of 3D Canvas */
  children?: React.ReactNode;
}

// ── Procedural Coil Spring Helper for Suspension ──
function createCoilSpringGeometry(
  radius = 0.09,
  height = 0.35,
  turns = 6,
  tubeRadius = 0.012
): THREE.BufferGeometry {
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

// ── Camera Controller Component ──
interface CameraControllerProps {
  controlsRef: React.RefObject<any>;
  resetTrigger?: number;
  fitTrigger?: number;
  autoRotate?: boolean;
  viewMode?: 'perspective' | 'orthographic';
}

function CameraController({
  controlsRef,
  resetTrigger,
  fitTrigger,
  autoRotate = false,
}: CameraControllerProps) {
  const { camera, scene } = useThree();

  // Reset Camera View to default isometric position
  const handleReset = useCallback(() => {
    if (!controlsRef.current) return;
    camera.position.set(4.5, 3.5, 4.5);
    controlsRef.current.target.set(0, 0.4, 0);
    controlsRef.current.update();
  }, [camera, controlsRef]);

  // Fit Camera to model bounding box
  const handleFit = useCallback(() => {
    if (!controlsRef.current) return;
    const box = new THREE.Box3();
    scene.traverse(obj => {
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
  }, [camera, scene, controlsRef]);

  useEffect(() => {
    if (resetTrigger && resetTrigger > 0) {
      handleReset();
    }
  }, [resetTrigger, handleReset]);

  useEffect(() => {
    if (fitTrigger && fitTrigger > 0) {
      handleFit();
    }
  }, [fitTrigger, handleFit]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 0.4, 0]}
      minDistance={0.5}
      maxDistance={35}
      enableDamping
      dampingFactor={0.07}
      rotateSpeed={0.7}
      panSpeed={0.7}
      zoomSpeed={0.85}
      autoRotate={autoRotate}
      autoRotateSpeed={1.2}
    />
  );
}

// ── GLTF Model Loader with Fallback ──
function GLTFModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={[1, 1, 1]} position={[0, 0, 0]} />;
}

// ── Engine GLB Model: Auto-Centers, Normalizes Scale, Studio Lighting Compatible ──
function EngineGLBModel({
  isWireframe,
  isXray,
  analysisOverlay,
  onSelectEntity,
}: {
  isWireframe: boolean;
  isXray: boolean;
  analysisOverlay: string;
  onSelectEntity?: (id: string | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/models/engine.glb');

  // Store original material colors once so overlays can be cleanly reverted
  const originalColors = useRef<Map<string, { color: THREE.Color; emissive: THREE.Color; emissiveIntensity: number }>>(new Map());

  // Clone scene once – auto-center and normalize to ~2.2 world units
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);

    // Snapshot original material colors before any mutations
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.uuid) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat, i) => {
        const m = mat as THREE.MeshStandardMaterial;
        const key = `${mesh.uuid}-${i}`;
        if (!originalColors.current.has(key)) {
          originalColors.current.set(key, {
            color: m.color.clone(),
            emissive: (m.emissive ?? new THREE.Color(0, 0, 0)).clone(),
            emissiveIntensity: m.emissiveIntensity ?? 0,
          });
        }
      });
    });

    // Auto-center and normalize scale
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 2.2 / maxDim : 1;
    cloned.scale.setScalar(scale);

    // Re-center after scaling
    const box2 = new THREE.Box3().setFromObject(cloned);
    const center2 = new THREE.Vector3();
    box2.getCenter(center2);
    cloned.position.sub(center2);
    // Sit on the ground plane with a small clearance
    cloned.position.y += (box2.max.y - box2.min.y) * 0.5 * scale * 0.05;

    // Enable shadows on all meshes
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return cloned;
  }, [scene]);

  // Reactively apply render-mode and analysis overlay to all meshes
  useEffect(() => {
    let matIndex = 0;
    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat, i) => {
        const m = mat as THREE.MeshStandardMaterial;
        const key = `${mesh.uuid}-${i}`;
        const orig = originalColors.current.get(key);

        // Reset to original first
        if (orig && analysisOverlay === 'none') {
          m.color.copy(orig.color);
          m.emissive?.copy(orig.emissive);
          m.emissiveIntensity = orig.emissiveIntensity;
        }

        m.wireframe = isWireframe;
        m.transparent = isXray;
        m.opacity = isXray ? 0.36 : 1;

        if (analysisOverlay === 'thermal') {
          m.color.set('#e74c3c');
          m.emissive?.set('#7b0000');
          m.emissiveIntensity = 0.35;
        } else if (analysisOverlay === 'stress') {
          m.color.set('#f39c12');
          m.emissive?.set('#5a3000');
          m.emissiveIntensity = 0.25;
        } else if (analysisOverlay === 'efficiency') {
          m.color.set('#2ecc71');
          m.emissive?.set('#0a4a24');
          m.emissiveIntensity = 0.18;
        }
        m.needsUpdate = true;
        matIndex++;
      });
    });
  }, [clonedScene, isWireframe, isXray, analysisOverlay]);

  return (
    <group
      ref={groupRef}
      position={[0, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onSelectEntity?.('engine-block'); }}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

// Preload engine.glb immediately when this module loads for faster first display
useGLTF.preload('/models/engine.glb');

// ── Detailed Realistic Engine Assembly Model (Matching Reference Image) ──
function DetailedEngineModel({
  expOffset,
  isWireframe,
  isXray,
  getMaterialColor,
  onSelectEntity,
}: {
  expOffset: number;
  isWireframe: boolean;
  isXray: boolean;
  getMaterialColor: (color: string, isHot?: boolean, stress?: number) => string;
  onSelectEntity?: (id: string | null) => void;
}) {
  return (
    <group position={[0, 0.2, 0]}>
      {/* ── 1. LOWER ENGINE BLOCK & OIL SUMP BASE (Metallic Cast Aluminum) ── */}
      <group position={[0, -0.3, 0]}>
        {/* Main Oil Pan Base */}
        <mesh onClick={(e) => { e.stopPropagation(); onSelectEntity?.('engine-block'); }}>
          <boxGeometry args={[0.58, 0.24, 0.52]} />
          <meshStandardMaterial
            color={getMaterialColor('#95a5a6', false, 0.5)}
            metalness={0.8}
            roughness={0.35}
            wireframe={isWireframe}
            transparent={isXray}
            opacity={isXray ? 0.35 : 1}
          />
        </mesh>
        {/* Sump Flange Mounting Ribs */}
        {[-0.26, 0, 0.26].map((x, i) => (
          <mesh key={`sump-rib-${i}`} position={[x, -0.1, 0.27]}>
            <boxGeometry args={[0.04, 0.16, 0.04]} />
            <meshStandardMaterial color="#7f8c8d" metalness={0.85} roughness={0.3} />
          </mesh>
        ))}
        {/* Lower Mounting Feet Extensions */}
        <mesh position={[-0.28, -0.14, -0.1]}>
          <cylinderGeometry args={[0.04, 0.04, 0.08, 16]} />
          <meshStandardMaterial color="#bdc3c7" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0.28, -0.14, -0.1]}>
          <cylinderGeometry args={[0.04, 0.04, 0.08, 16]} />
          <meshStandardMaterial color="#bdc3c7" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* ── 2. MID ENGINE CYLINDER BLOCK ── */}
      <mesh
        position={[0, 0 + expOffset * 0.4, 0]}
        onClick={(e) => { e.stopPropagation(); onSelectEntity?.('engine-block'); }}
      >
        <boxGeometry args={[0.54, 0.36, 0.48]} />
        <meshStandardMaterial
          color={getMaterialColor('#7f8c8d', true, 0.7)}
          metalness={0.82}
          roughness={0.3}
          wireframe={isWireframe}
        />
      </mesh>

      {/* ── 3. CYLINDER HEAD & CAMSHAFT COVER ── */}
      <mesh position={[0, 0.24 + expOffset * 0.7, 0]}>
        <boxGeometry args={[0.52, 0.14, 0.46]} />
        <meshStandardMaterial
          color={getMaterialColor('#bdc3c7', false, 0.3)}
          metalness={0.88}
          roughness={0.2}
          wireframe={isWireframe}
        />
      </mesh>

      {/* ── 4. TOP BLACK AIR INTAKE BOX / COVER (Ribbed Matte Plastic) ── */}
      <group position={[0, 0.42 + expOffset * 1.0, 0]}>
        {/* Main Cover Box */}
        <mesh>
          <boxGeometry args={[0.56, 0.18, 0.48]} />
          <meshStandardMaterial color="#1f2421" roughness={0.7} metalness={0.2} />
        </mesh>
        {/* Top Surface Ribs Pattern */}
        {[-0.18, -0.06, 0.06, 0.18].map((z, i) => (
          <mesh key={`top-rib-${i}`} position={[0, 0.095, z]}>
            <boxGeometry args={[0.52, 0.015, 0.03]} />
            <meshStandardMaterial color="#111618" roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* ── 5. CURVED BLACK INTAKE AIR DUCT PIPE (Left Side Pipe) ── */}
      <group position={[-0.32 - expOffset * 0.5, 0.2, 0.1]}>
        {/* Upper Pipe Bend */}
        <mesh position={[0, 0.22, -0.05]} rotation={[0, 0, Math.PI / 8]}>
          <cylinderGeometry args={[0.055, 0.055, 0.28, 20]} />
          <meshStandardMaterial color="#191919" roughness={0.75} />
        </mesh>
        {/* Vertical Down Pipe */}
        <mesh position={[-0.05, -0.1, -0.05]}>
          <cylinderGeometry args={[0.05, 0.05, 0.48, 20]} />
          <meshStandardMaterial color="#191919" roughness={0.75} />
        </mesh>
        {/* Hose Clamps */}
        <mesh position={[-0.05, 0.05, -0.05]}>
          <cylinderGeometry args={[0.056, 0.056, 0.02, 20]} />
          <meshStandardMaterial color="#bdc3c7" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      {/* ── 6. FUEL RAIL & RED INJECTOR CAPS (Top Front) ── */}
      <group position={[0, 0.28 + expOffset * 0.7, 0.24]}>
        {/* Metal Fuel Rail Pipe */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.015, 0.015, 0.44, 16]} />
          <meshStandardMaterial color="#bdc3c7" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* 4 Red Injector Caps */}
        {[-0.18, -0.06, 0.06, 0.18].map((x, i) => (
          <mesh key={`red-cap-${i}`} position={[x, 0.03, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.035, 16]} />
            <meshStandardMaterial color="#e74c3c" metalness={0.5} roughness={0.3} emissive="#900c3f" emissiveIntensity={0.2} />
          </mesh>
        ))}
      </group>

      {/* ── 7. FRONT PULLEY & BELT SYSTEM (Matching Reference Image) ── */}
      <group position={[0, -0.05, 0.26]}>
        {/* 7A. Main Crankshaft Grooved Pulley (Lower Center) */}
        <group position={[0, -0.12, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.06, 32]} />
            <meshStandardMaterial color="#2c3e50" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Outer Grooved Rim */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.01]}>
            <cylinderGeometry args={[0.125, 0.125, 0.04, 32]} />
            <meshStandardMaterial color="#1a252f" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Inner Spoke Detail */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.032]}>
            <cylinderGeometry args={[0.07, 0.07, 0.01, 16]} />
            <meshStandardMaterial color="#bdc3c7" metalness={0.95} roughness={0.1} />
          </mesh>
          {/* Spindle Shaft */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]}>
            <cylinderGeometry args={[0.022, 0.022, 0.04, 16]} />
            <meshStandardMaterial color="#ecf0f1" metalness={0.95} roughness={0.05} />
          </mesh>
        </group>

        {/* 7B. Alternator Pulley (Middle Right) */}
        <group position={[0.22, 0.08, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.05, 32]} />
            <meshStandardMaterial color="#2c3e50" metalness={0.85} roughness={0.25} />
          </mesh>
          {/* Toothed / Grooved Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.025]}>
            <cylinderGeometry args={[0.075, 0.075, 0.012, 24]} />
            <meshStandardMaterial color="#d5dbdb" metalness={0.9} roughness={0.15} />
          </mesh>
          {/* Center Nut */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.04]}>
            <cylinderGeometry args={[0.02, 0.02, 0.03, 16]} />
            <meshStandardMaterial color="#ecf0f1" metalness={0.95} roughness={0.1} />
          </mesh>
        </group>

        {/* 7C. Water Pump / Tensioner Pulley (Lower Right) */}
        <group position={[0.15, -0.18, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.045, 24]} />
            <meshStandardMaterial color="#1a252f" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.025]}>
            <cylinderGeometry args={[0.018, 0.018, 0.02, 12]} />
            <meshStandardMaterial color="#bdc3c7" metalness={0.9} />
          </mesh>
        </group>

        {/* 7D. Left Auxiliary Pulley (Middle Left) */}
        <group position={[-0.18, 0.02, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.05, 24]} />
            <meshStandardMaterial color="#34495e" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Spoke Slots */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.026]}>
            <cylinderGeometry args={[0.05, 0.05, 0.01, 12]} />
            <meshStandardMaterial color="#bdc3c7" metalness={0.95} roughness={0.1} />
          </mesh>
        </group>

        {/* 7E. Upper Timing Sprocket & Gold Nut (Upper Center) */}
        <group position={[0.02, 0.22 + expOffset * 0.4, 0]}>
          {/* Toothed Gear */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.095, 0.095, 0.035, 36]} />
            <meshStandardMaterial color="#2c3e50" metalness={0.85} roughness={0.3} />
          </mesh>
          {/* Center Golden Yellow Nut (Matches reference image gold hub) */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
            <cylinderGeometry args={[0.038, 0.038, 0.025, 6]} />
            <meshStandardMaterial color="#f39c12" metalness={0.9} roughness={0.15} />
          </mesh>
        </group>

        {/* 7F. Top Right Fan Rotor Shroud Assembly (Top Right Shroud from Reference Image) */}
        <group position={[0.24, 0.26 + expOffset * 0.5, 0]}>
          {/* Outer Black Shroud Cylinder */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.065, 32]} />
            <meshStandardMaterial color="#1c2833" roughness={0.65} />
          </mesh>
          {/* Internal Rotor Hub */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.015]}>
            <cylinderGeometry args={[0.05, 0.05, 0.04, 16]} />
            <meshStandardMaterial color="#d5dbdb" metalness={0.9} roughness={0.15} />
          </mesh>
          {/* Central Bolt Fastener */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.04]}>
            <cylinderGeometry args={[0.018, 0.018, 0.02, 12]} />
            <meshStandardMaterial color="#ecf0f1" metalness={0.95} />
          </mesh>
        </group>

        {/* 7G. Serpentine Belt Loops (Black Textured Belt wrapping around pulleys) */}
        <mesh position={[0.11, -0.02, 0.01]} rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.26, 0.018, 0.038]} />
          <meshStandardMaterial color="#111115" roughness={0.85} />
        </mesh>
        <mesh position={[0.18, -0.05, 0.01]} rotation={[0, 0, Math.PI / 3]}>
          <boxGeometry args={[0.24, 0.018, 0.038]} />
          <meshStandardMaterial color="#111115" roughness={0.85} />
        </mesh>
        <mesh position={[-0.09, -0.05, 0.01]} rotation={[0, 0, Math.PI / 5]}>
          <boxGeometry args={[0.22, 0.018, 0.038]} />
          <meshStandardMaterial color="#111115" roughness={0.85} />
        </mesh>
      </group>

      {/* ── 8. EXHAUST MANIFOLD HEADERS (Back Side) ── */}
      <group position={[0, 0.05, -0.25]}>
        {[-0.18, -0.06, 0.06, 0.18].map((x, i) => (
          <mesh key={`ex-header-${i}`} position={[x, -0.05, 0]} rotation={[Math.PI / 4, 0, 0]}>
            <cylinderGeometry args={[0.032, 0.038, 0.28, 16]} />
            <meshStandardMaterial color="#d35400" metalness={0.85} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* ── 9. ALTERNATOR COPPER CORE HOUSING (Side Right) ── */}
      <group position={[0.26, 0, -0.05]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.095, 0.095, 0.16, 20]} />
          <meshStandardMaterial color="#2c3e50" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Internal Copper Winding Core */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.078, 0.078, 0.12, 16]} />
          <meshStandardMaterial color="#e67e22" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

// ── Procedural Mechanical Object Renderer ──
interface MechanicalObjectMeshProps {
  objectType: MechanicalObjectType;
  explodeAmount?: number;
  renderMode?: 'solid' | 'wireframe' | 'xray';
  analysisOverlay?: 'none' | 'thermal' | 'stress' | 'efficiency';
  selectedEntityId?: string | null;
  onSelectEntity?: (id: string | null) => void;
}

function MechanicalObjectMesh({
  objectType,
  explodeAmount = 0,
  renderMode = 'solid',
  analysisOverlay = 'none',
  selectedEntityId,
  onSelectEntity,
}: MechanicalObjectMeshProps) {
  const isWireframe = renderMode === 'wireframe';
  const isXray = renderMode === 'xray';

  const getMaterialColor = (baseColor: string, isHot = false, stressLevel = 0) => {
    if (analysisOverlay === 'thermal') {
      return isHot ? '#e74c3c' : '#3498db';
    }
    if (analysisOverlay === 'stress') {
      return stressLevel > 0.6 ? '#e74c3c' : stressLevel > 0.3 ? '#f39c12' : '#2ecc71';
    }
    if (analysisOverlay === 'efficiency') {
      return '#2ecc71';
    }
    return baseColor;
  };

  const expOffset = explodeAmount * 0.45;

  return (
    <group position={[0, 0, 0]}>
      {/* 1. FULL CAR OBJECT */}
      {objectType === 'full-car' && (
        <group>
          {/* Main Car Body Shell */}
          <mesh
            position={[0, 0.6 + expOffset * 0.8, 0]}
            onClick={(e) => { e.stopPropagation(); onSelectEntity?.('body-exterior'); }}
          >
            <boxGeometry args={[1.78, 0.68, 4.1]} />
            <meshStandardMaterial
              color={getMaterialColor(selectedEntityId === 'body-exterior' ? '#ffffff' : '#2c3e50')}
              metalness={0.8}
              roughness={0.25}
              wireframe={isWireframe}
              transparent={isXray}
              opacity={isXray ? 0.3 : 0.85}
            />
          </mesh>

          {/* Cabin Roof */}
          <mesh position={[0, 1.1 + expOffset * 1.2, -0.2]}>
            <boxGeometry args={[1.45, 0.45, 2.1]} />
            <meshStandardMaterial
              color={getMaterialColor('#1a252f')}
              metalness={0.9}
              roughness={0.15}
              wireframe={isWireframe}
              transparent={isXray}
              opacity={isXray ? 0.25 : 0.9}
            />
          </mesh>

          {/* Windshield */}
          <mesh position={[0, 0.95 + expOffset * 1.0, 0.9]} rotation={[Math.PI / 6, 0, 0]}>
            <planeGeometry args={[1.38, 0.65]} />
            <meshStandardMaterial color="#4a9edd" transparent opacity={0.5} roughness={0.05} />
          </mesh>

          {/* LED Front Headlights */}
          <mesh position={[-0.65, 0.55 + expOffset * 0.8, 2.06]}>
            <boxGeometry args={[0.3, 0.12, 0.05]} />
            <meshStandardMaterial color="#e0f7fa" emissive="#00e5ff" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0.65, 0.55 + expOffset * 0.8, 2.06]}>
            <boxGeometry args={[0.3, 0.12, 0.05]} />
            <meshStandardMaterial color="#e0f7fa" emissive="#00e5ff" emissiveIntensity={0.8} />
          </mesh>

          {/* LED Rear Taillights */}
          <mesh position={[0, 0.6 + expOffset * 0.8, -2.06]}>
            <boxGeometry args={[1.6, 0.1, 0.04]} />
            <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={0.9} />
          </mesh>

          {/* 4 Wheels */}
          {[
            { id: 'wheel-fl', pos: [-0.85 - expOffset, 0.33, 1.35] as [number, number, number] },
            { id: 'wheel-fr', pos: [0.85 + expOffset, 0.33, 1.35] as [number, number, number] },
            { id: 'wheel-rl', pos: [-0.85 - expOffset, 0.33, -1.35] as [number, number, number] },
            { id: 'wheel-rr', pos: [0.85 + expOffset, 0.33, -1.35] as [number, number, number] },
          ].map(wheel => (
            <group key={wheel.id} position={wheel.pos}>
              {/* Rubber Tire */}
              <mesh
                rotation={[0, 0, Math.PI / 2]}
                onClick={(e) => { e.stopPropagation(); onSelectEntity?.(wheel.id); }}
              >
                <cylinderGeometry args={[0.33, 0.33, 0.23, 32]} />
                <meshStandardMaterial color="#191919" roughness={0.85} wireframe={isWireframe} />
              </mesh>
              {/* Alloy Rim */}
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.22, 0.22, 0.24, 16]} />
                <meshStandardMaterial color="#d5dbdb" metalness={0.9} roughness={0.15} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {/* 2. ENGINE OBJECT – Use actual engine.glb model */}
      {objectType === 'engine' && (
        <Suspense fallback={
          <Html center>
            <div style={{
              color: '#e2e8f0',
              fontSize: 13,
              background: 'rgba(10,12,20,0.85)',
              padding: '8px 18px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>⚙️</span> Loading Engine Model...
            </div>
          </Html>
        }>
          <EngineGLBModel
            isWireframe={isWireframe}
            isXray={isXray}
            analysisOverlay={analysisOverlay}
            onSelectEntity={onSelectEntity}
          />
        </Suspense>
      )}

      {/* 3. TRANSMISSION OBJECT */}
      {objectType === 'transmission' && (
        <group position={[0, 0.5, 0]}>
          {/* Main Gearbox Casing */}
          <mesh onClick={(e) => { e.stopPropagation(); onSelectEntity?.('transmission'); }}>
            <boxGeometry args={[0.48, 0.38, 0.62]} />
            <meshStandardMaterial
              color={getMaterialColor('#7f8c8d', false, 0.5)}
              metalness={0.85}
              roughness={0.3}
              wireframe={isWireframe}
            />
          </mesh>

          {/* Front Bell Housing */}
          <mesh position={[0, 0, 0.36 + expOffset * 0.6]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.26, 0.22, 0.14, 24]} />
            <meshStandardMaterial color="#95a5a6" metalness={0.9} roughness={0.25} />
          </mesh>

          {/* Left Output Shaft Stub */}
          <mesh position={[-0.27 - expOffset * 0.5, -0.05, -0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.1, 16]} />
            <meshStandardMaterial color="#2c3e50" metalness={0.9} roughness={0.1} />
          </mesh>

          {/* Right Output Shaft Stub */}
          <mesh position={[0.27 + expOffset * 0.5, -0.05, -0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.1, 16]} />
            <meshStandardMaterial color="#2c3e50" metalness={0.9} roughness={0.1} />
          </mesh>

          {/* Rear Selector Mechanism Solenoid */}
          <mesh position={[0, 0.18 + expOffset * 0.8, -0.2]}>
            <boxGeometry args={[0.16, 0.12, 0.18]} />
            <meshStandardMaterial color="#2980b9" metalness={0.7} roughness={0.4} />
          </mesh>
        </group>
      )}

      {/* 4. BATTERY & ACCELERATOR OBJECT */}
      {objectType === 'battery-accelerator' && (
        <group position={[0, 0.4, 0]}>
          {/* High Voltage Battery Enclosure */}
          <mesh
            position={[-0.4 - expOffset * 0.5, 0.1, 0]}
            onClick={(e) => { e.stopPropagation(); onSelectEntity?.('electrical-battery'); }}
          >
            <boxGeometry args={[0.55, 0.32, 0.42]} />
            <meshStandardMaterial
              color={getMaterialColor('#2c3e50', true, 0.8)}
              metalness={0.75}
              roughness={0.3}
              wireframe={isWireframe}
            />
          </mesh>

          {/* Red (+) Positive Terminal Post */}
          <mesh position={[-0.25 - expOffset * 0.5, 0.28 + expOffset * 0.4, 0.1]}>
            <cylinderGeometry args={[0.025, 0.028, 0.07, 16]} />
            <meshStandardMaterial color="#e74c3c" metalness={0.8} roughness={0.2} />
          </mesh>

          {/* Blue (-) Negative Terminal Post */}
          <mesh position={[-0.55 - expOffset * 0.5, 0.28 + expOffset * 0.4, 0.1]}>
            <cylinderGeometry args={[0.025, 0.028, 0.07, 16]} />
            <meshStandardMaterial color="#2980b9" metalness={0.8} roughness={0.2} />
          </mesh>

          {/* High Voltage Orange Wiring Duct */}
          <mesh position={[-0.4 - expOffset * 0.5, 0.28 + expOffset * 0.4, -0.08]}>
            <boxGeometry args={[0.42, 0.025, 0.12]} />
            <meshStandardMaterial color="#d35400" metalness={0.4} roughness={0.5} />
          </mesh>

          {/* Electronic Accelerator Pedal Assembly */}
          <group position={[0.45 + expOffset * 0.5, 0, 0]}>
            {/* Pedal Base Plate */}
            <mesh position={[0, -0.1, 0]}>
              <boxGeometry args={[0.22, 0.04, 0.32]} />
              <meshStandardMaterial color="#1a252f" metalness={0.8} roughness={0.4} />
            </mesh>
            {/* Accelerator Pedal Arm */}
            <mesh position={[0, 0.12, -0.04]} rotation={[-Math.PI / 6, 0, 0]}>
              <boxGeometry args={[0.04, 0.32, 0.03]} />
              <meshStandardMaterial color="#7f8c8d" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Pedal Rubber Face Pad */}
            <mesh position={[0, 0.22, 0.03]} rotation={[-Math.PI / 6, 0, 0]}>
              <boxGeometry args={[0.11, 0.22, 0.025]} />
              <meshStandardMaterial color="#111115" roughness={0.9} />
            </mesh>
            {/* Position Sensor Module */}
            <mesh position={[0.08, -0.02, -0.06]}>
              <boxGeometry args={[0.09, 0.09, 0.09]} />
              <meshStandardMaterial color="#f39c12" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
        </group>
      )}

      {/* 5. RADIATOR OBJECT */}
      {objectType === 'radiator' && (
        <group position={[0, 0.5, 0]}>
          {/* Main Radiator Core Matrix */}
          <mesh onClick={(e) => { e.stopPropagation(); onSelectEntity?.('cooling-radiator'); }}>
            <boxGeometry args={[0.78, 0.52, 0.06]} />
            <meshStandardMaterial
              color={getMaterialColor('#7f8c8d', false, 0.2)}
              metalness={0.9}
              roughness={0.25}
              wireframe={isWireframe}
            />
          </mesh>

          {/* Top Brass Filler Cap */}
          <mesh position={[0.32, 0.28 + expOffset * 0.4, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.03, 16]} />
            <meshStandardMaterial color="#f1c40f" metalness={0.95} roughness={0.1} />
          </mesh>

          {/* Rubber Hoses */}
          <mesh position={[-0.32, 0.22, 0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.028, 0.028, 0.12, 16]} />
            <meshStandardMaterial color="#111115" roughness={0.8} />
          </mesh>

          {/* Cooling Fan Shroud */}
          <mesh position={[0, 0, -0.06 - expOffset * 0.6]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.04, 24]} />
            <meshStandardMaterial color="#1a252f" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* 6. BRAKES OBJECT */}
      {objectType === 'brakes' && (
        <group position={[0, 0.5, 0]}>
          {/* Ventilated Brake Disc Rotor */}
          <mesh
            rotation={[0, 0, Math.PI / 2]}
            onClick={(e) => { e.stopPropagation(); onSelectEntity?.('braking-disc'); }}
          >
            <cylinderGeometry args={[0.38, 0.38, 0.045, 32]} />
            <meshStandardMaterial
              color={getMaterialColor('#bdc3c7', true, 0.9)}
              metalness={0.92}
              roughness={0.15}
              wireframe={isWireframe}
            />
          </mesh>

          {/* Center Hub Hat */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0.03, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.03, 24]} />
            <meshStandardMaterial color="#34495e" metalness={0.85} roughness={0.3} />
          </mesh>

          {/* High-Performance Red Brake Caliper */}
          <mesh
            position={[0.02, 0.26 + expOffset * 0.5, 0.18]}
            onClick={(e) => { e.stopPropagation(); onSelectEntity?.('braking-caliper'); }}
          >
            <boxGeometry args={[0.12, 0.22, 0.16]} />
            <meshStandardMaterial color="#e74c3c" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* 7. SUSPENSION OBJECT */}
      {objectType === 'suspension' && (
        <group position={[0, 0.5, 0]}>
          {/* Left Strut Coil Spring */}
          <mesh
            position={[-0.4 - expOffset * 0.4, 0.1, 0]}
            geometry={createCoilSpringGeometry(0.12, 0.45, 7, 0.016)}
            onClick={(e) => { e.stopPropagation(); onSelectEntity?.('suspension-front'); }}
          >
            <meshStandardMaterial
              color={getMaterialColor('#e74c3c', false, 0.6)}
              metalness={0.7}
              roughness={0.3}
              wireframe={isWireframe}
            />
          </mesh>

          {/* Left Chrome Damper Piston Rod */}
          <mesh position={[-0.4 - expOffset * 0.4, 0.1, 0]}>
            <cylinderGeometry args={[0.032, 0.032, 0.5, 16]} />
            <meshStandardMaterial color="#ecf0f1" metalness={0.95} roughness={0.08} />
          </mesh>

          {/* Right Strut Coil Spring */}
          <mesh
            position={[0.4 + expOffset * 0.4, 0.1, 0]}
            geometry={createCoilSpringGeometry(0.12, 0.45, 7, 0.016)}
            onClick={(e) => { e.stopPropagation(); onSelectEntity?.('suspension-front'); }}
          >
            <meshStandardMaterial
              color={getMaterialColor('#e74c3c', false, 0.6)}
              metalness={0.7}
              roughness={0.3}
              wireframe={isWireframe}
            />
          </mesh>

          {/* Right Chrome Damper Piston Rod */}
          <mesh position={[0.4 + expOffset * 0.4, 0.1, 0]}>
            <cylinderGeometry args={[0.032, 0.032, 0.5, 16]} />
            <meshStandardMaterial color="#ecf0f1" metalness={0.95} roughness={0.08} />
          </mesh>

          {/* Lower Crossmember Wishbone Arm */}
          <mesh position={[0, -0.18 - expOffset * 0.3, 0]}>
            <boxGeometry args={[1.1, 0.08, 0.22]} />
            <meshStandardMaterial color="#34495e" metalness={0.8} roughness={0.4} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ── Main ThreeDViewer Component ──
export default function ThreeDViewer({
  modelUrl,
  selectedObjectType: initialObjectType = 'full-car',
  onObjectTypeChange,
  showSelector = true,
  showResetButton = true,
  autoRotate = false,
  backgroundColor = '#18181c',
  className = '',
  style = {},
  explodeAmount = 0,
  renderMode = 'solid',
  analysisOverlay = 'none',
  showGrid = true,
  showAxes = true,
  viewMode = 'perspective',
  resetTrigger = 0,
  fitTrigger = 0,
  selectedEntityId = null,
  onSelectEntity,
  children,
}: ThreeDViewerProps) {
  const [activeObject, setActiveObject] = useState<MechanicalObjectType>(initialObjectType);
  const [internalResetCount, setInternalResetCount] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const controlsRef = useRef<any>(null);

  // Sync internal activeObject when prop changes
  useEffect(() => {
    if (initialObjectType && initialObjectType !== activeObject) {
      setActiveObject(initialObjectType);
    }
  }, [initialObjectType]);

  const handleSelectObject = (type: MechanicalObjectType) => {
    setActiveObject(type);
    if (onObjectTypeChange) {
      onObjectTypeChange(type);
    }
    // Automatically trigger reset camera view on object switch
    setInternalResetCount(prev => prev + 1);
  };

  const handleResetView = () => {
    setInternalResetCount(prev => prev + 1);
  };

  const toggleFullScreen = () => {
    setIsFullScreen(prev => !prev);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  };

  const objectOptions: { id: MechanicalObjectType; label: string; icon: string; description: string }[] = [
    { id: 'full-car', label: 'Full Car', icon: '🚗', description: 'Complete Vehicle Body Shell & Chassis Assembly' },
    { id: 'engine', label: 'Engine', icon: '⚙️', description: 'Internal Combustion Engine & Cylinder Block' },
    { id: 'transmission', label: 'Transmission', icon: '🕹️', description: '6-Speed Dual-Clutch Gearbox & Shafts' },
    { id: 'battery-accelerator', label: 'Battery & Accelerator', icon: '⚡', description: 'EV High Voltage Battery Pack & Pedal Assembly' },
    { id: 'radiator', label: 'Radiator', icon: '❄️', description: 'Cooling Radiator Matrix, Hoses & Electric Fan' },
    { id: 'brakes', label: 'Brakes', icon: '🛑', description: 'Ventilated Rotor Disc & Multi-Piston Caliper' },
    { id: 'suspension', label: 'Suspension', icon: '🔩', description: 'MacPherson Helical Coil Strut & Damper Assembly' },
  ];

  const totalResetTriggers = resetTrigger + internalResetCount;

  return (
    <div
      className={`threed-viewer-container ${className} ${isFullScreen ? 'threed-viewer-fullscreen' : ''}`}
      style={{
        position: isFullScreen ? 'fixed' : 'relative',
        top: isFullScreen ? 0 : undefined,
        left: isFullScreen ? 0 : undefined,
        width: isFullScreen ? '100vw' : '100%',
        height: isFullScreen ? '100vh' : '100%',
        zIndex: isFullScreen ? 99999 : 'auto',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        background: backgroundColor,
        borderRadius: isFullScreen ? 0 : 'inherit',
        ...style,
      }}
    >
      {/* ── Mechanical Object Selection Header Toolbar ── */}
      {showSelector && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(20, 24, 32, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 8,
            padding: '4px 8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            maxWidth: '96%',
            overflowX: 'auto',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#8b9bb4',
              textTransform: 'uppercase',
              marginRight: 4,
              letterSpacing: '0.6px',
              whiteSpace: 'nowrap',
            }}
          >
            3D OBJECT:
          </span>
          {objectOptions.map(item => {
            const isActive = activeObject === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectObject(item.id)}
                title={item.description}
                style={{
                  background: isActive ? '#3b82f6' : 'rgba(255, 255, 255, 0.06)',
                  color: isActive ? '#ffffff' : '#c3d1e4',
                  border: isActive ? '1px solid #60a5fa' : '1px solid transparent',
                  borderRadius: 5,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 2px 10px rgba(59, 130, 246, 0.4)' : 'none',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Floating Control Buttons (Bottom Right: Reset View & Full Screen) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          onClick={toggleFullScreen}
          title={isFullScreen ? 'Exit Full Page View' : 'Full Page View Mode'}
          style={{
            background: isFullScreen ? '#3b82f6' : 'rgba(20, 24, 32, 0.92)',
            backdropFilter: 'blur(8px)',
            color: '#e2e8f0',
            border: isFullScreen ? '1px solid #60a5fa' : '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: 6,
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            transition: 'all 150ms ease',
          }}
        >
          <span>{isFullScreen ? '⤢' : '⛶'}</span>
          <span>{isFullScreen ? 'Exit Full View' : 'Full Page View'}</span>
        </button>

        {showResetButton && (
          <button
            onClick={handleResetView}
            title="Reset 3D View to Initial Camera Position"
            style={{
              background: 'rgba(20, 24, 32, 0.92)',
              backdropFilter: 'blur(8px)',
              color: '#e2e8f0',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: 6,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              transition: 'all 150ms ease',
            }}
          >
            <span>↺</span>
            <span>Reset View</span>
          </button>
        )}
      </div>

      {/* ── Main 3D Canvas ── */}
      <Canvas
        camera={{
          position: [4.5, 3.5, 4.5],
          fov: viewMode === 'perspective' ? 45 : 22,
          near: 0.1,
          far: 120,
        }}
        gl={{ antialias: true, alpha: false }}
        shadows
        dpr={[1, 2]}
        style={{ background: backgroundColor, width: '100%', height: '100%' }}
        orthographic={viewMode === 'orthographic'}
      >
        {/* Studio Lighting – optimised for metallic engine parts */}
        <ambientLight intensity={activeObject === 'engine' ? 0.35 : 0.5} />
        {/* Key light – upper front right */}
        <directionalLight
          position={[5, 8, 5]}
          intensity={activeObject === 'engine' ? 1.4 : 0.85}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5}
          shadow-camera-far={30}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        {/* Fill light – upper back left */}
        <directionalLight position={[-5, 6, -4]} intensity={activeObject === 'engine' ? 0.65 : 0.4} />
        {/* Rim light – back top for metallic edge highlights */}
        <directionalLight position={[0, 4, -6]} intensity={activeObject === 'engine' ? 0.55 : 0.2} />
        {/* Bounce light from below */}
        <directionalLight position={[0, -3, 0]} intensity={0.18} />
        {/* HDR Environment – warehouse gives sharp reflections on chrome/aluminum */}
        <Environment preset={activeObject === 'engine' ? 'warehouse' : 'city'} background={false} />

        {/* Camera Controls */}
        <CameraController
          controlsRef={controlsRef}
          resetTrigger={totalResetTriggers}
          fitTrigger={fitTrigger}
          autoRotate={autoRotate}
          viewMode={viewMode}
        />

        {/* Ground Grid */}
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

        {/* Coordinate Axes */}
        {showAxes && (
          <group position={[0, 0.01, 0]}>
            <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1.5, 0xee4444, 0.08, 0.05]} />
            <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.5, 0x44ee44, 0.08, 0.05]} />
            <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 1.5, 0x4488ee, 0.08, 0.05]} />
          </group>
        )}

        {/* Ground Contact Shadow */}
        <ContactShadows position={[0, -0.01, 0]} opacity={0.45} scale={10} blur={2.4} far={3.5} />

        {/* 3D Model Rendering (GLTF or Procedural Geometries) */}
        {modelUrl ? (
          <Suspense fallback={
            <Html center>
              <div style={{ color: '#fff', fontSize: 13, background: 'rgba(0,0,0,0.7)', padding: '6px 14px', borderRadius: 4 }}>
                Loading 3D Model...
              </div>
            </Html>
          }>
            <GLTFModel url={modelUrl} />
          </Suspense>
        ) : (
          <MechanicalObjectMesh
            objectType={activeObject}
            explodeAmount={explodeAmount}
            renderMode={renderMode}
            analysisOverlay={analysisOverlay}
            selectedEntityId={selectedEntityId}
            onSelectEntity={onSelectEntity}
          />
        )}

        {/* Viewport Corner Orientation Gizmo */}
        <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
          <GizmoViewport axisColors={['#e74c3c', '#2ecc71', '#3498db']} labelColor="#ffffff" />
        </GizmoHelper>
      </Canvas>

      {/* Children Overlays */}
      {children}
    </div>
  );
}
