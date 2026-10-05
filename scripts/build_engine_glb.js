// ============================================================
// Engine 3D Model GLB / GLTF Generator Script
// Builds a 360-degree detailed mechanical engine 3D model
// matching the user's reference image and exports GLB & GLTF.
// ============================================================

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

// Polyfill FileReader for Node.js GLTFExporter
global.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buf => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buf => {
      const base64 = Buffer.from(buf).toString('base64');
      this.result = `data:application/octet-stream;base64,${base64}`;
      if (this.onloadend) this.onloadend();
    });
  }
};

function createEngineScene() {
  const root = new THREE.Group();
  root.name = 'Detailed_3D_Engine_Model';

  // ── Materials ──
  const matAluminum = new THREE.MeshStandardMaterial({ color: 0x95a5a6, metalness: 0.85, roughness: 0.3 });
  const matSilverMetal = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.9, roughness: 0.2 });
  const matDarkSteel = new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.8, roughness: 0.35 });
  const matBlackPlastic = new THREE.MeshStandardMaterial({ color: 0x1f2421, metalness: 0.2, roughness: 0.7 });
  const matRubberPipe = new THREE.MeshStandardMaterial({ color: 0x191919, metalness: 0.1, roughness: 0.8 });
  const matRedInjector = new THREE.MeshStandardMaterial({ color: 0xe74c3c, metalness: 0.5, roughness: 0.3, emissive: 0x900c3f, emissiveIntensity: 0.2 });
  const matGoldNut = new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.9, roughness: 0.15 });
  const matCopper = new THREE.MeshStandardMaterial({ color: 0xe67e22, metalness: 0.9, roughness: 0.25 });
  const matExhaust = new THREE.MeshStandardMaterial({ color: 0xd35400, metalness: 0.85, roughness: 0.3 });
  const matBelt = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.85 });

  // ── 1. LOWER OIL PAN & SUMP BASE ──
  const sumpGroup = new THREE.Group();
  sumpGroup.position.set(0, -0.3, 0);

  const sumpMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.24, 0.52), matAluminum);
  sumpMesh.name = 'Oil_Pan_Sump_Base';
  sumpGroup.add(sumpMesh);

  // Sump Mounting Ribs
  [-0.26, 0, 0.26].forEach((x, i) => {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), matDarkSteel);
    rib.position.set(x, -0.1, 0.27);
    sumpGroup.add(rib);
  });

  // Lower Mounting Feet
  const foot1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 16), matSilverMetal);
  foot1.position.set(-0.28, -0.14, -0.1);
  sumpGroup.add(foot1);

  const foot2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 16), matSilverMetal);
  foot2.position.set(0.28, -0.14, -0.1);
  sumpGroup.add(foot2);

  root.add(sumpGroup);

  // ── 2. MID CYLINDER BLOCK ──
  const blockMesh = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.36, 0.48), matDarkSteel);
  blockMesh.name = 'Cylinder_Block';
  blockMesh.position.set(0, 0, 0);
  root.add(blockMesh);

  // ── 3. CYLINDER HEAD ──
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.46), matSilverMetal);
  headMesh.name = 'Cylinder_Head_Cover';
  headMesh.position.set(0, 0.24, 0);
  root.add(headMesh);

  // ── 4. TOP BLACK AIR INTAKE BOX / COVER (Ribbed) ──
  const intakeGroup = new THREE.Group();
  intakeGroup.position.set(0, 0.42, 0);

  const intakeBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.48), matBlackPlastic);
  intakeBox.name = 'Air_Intake_Box';
  intakeGroup.add(intakeBox);

  // Ribs on top surface
  [-0.18, -0.06, 0.06, 0.18].forEach((z, i) => {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.015, 0.03), matBelt);
    rib.position.set(0, 0.095, z);
    intakeGroup.add(rib);
  });
  root.add(intakeGroup);

  // ── 5. CURVED BLACK INTAKE AIR DUCT PIPE (Left Side Pipe) ──
  const pipeGroup = new THREE.Group();
  pipeGroup.position.set(-0.32, 0.2, 0.1);

  const pipeUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 20), matRubberPipe);
  pipeUpper.rotation.z = Math.PI / 8;
  pipeUpper.position.set(0, 0.22, -0.05);
  pipeGroup.add(pipeUpper);

  const pipeLower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.48, 20), matRubberPipe);
  pipeLower.position.set(-0.05, -0.1, -0.05);
  pipeGroup.add(pipeLower);

  const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.02, 20), matSilverMetal);
  clamp.position.set(-0.05, 0.05, -0.05);
  pipeGroup.add(clamp);

  root.add(pipeGroup);

  // ── 6. FUEL RAIL & RED INJECTOR CAPS ──
  const fuelGroup = new THREE.Group();
  fuelGroup.position.set(0, 0.28, 0.24);

  const fuelRail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.44, 16), matSilverMetal);
  fuelRail.rotation.z = Math.PI / 2;
  fuelGroup.add(fuelRail);

  [-0.18, -0.06, 0.06, 0.18].forEach((x, i) => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.035, 16), matRedInjector);
    cap.position.set(x, 0.03, 0);
    fuelGroup.add(cap);
  });
  root.add(fuelGroup);

  // ── 7. FRONT PULLEY & BELT SYSTEM (Matching Reference Image) ──
  const pulleyGroup = new THREE.Group();
  pulleyGroup.position.set(0, -0.05, 0.26);

  // 7A. Main Crankshaft Grooved Pulley (Lower Center)
  const crankGroup = new THREE.Group();
  crankGroup.position.set(0, -0.12, 0);

  const crank1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 32), matDarkSteel);
  crank1.rotation.x = Math.PI / 2;
  crankGroup.add(crank1);

  const crankRim = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.04, 32), matBlackPlastic);
  crankRim.rotation.x = Math.PI / 2;
  crankRim.position.z = 0.01;
  crankGroup.add(crankRim);

  const crankSpoke = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 16), matSilverMetal);
  crankSpoke.rotation.x = Math.PI / 2;
  crankSpoke.position.z = 0.032;
  crankGroup.add(crankSpoke);

  const crankShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 16), matSilverMetal);
  crankShaft.rotation.x = Math.PI / 2;
  crankShaft.position.z = 0.05;
  crankGroup.add(crankShaft);

  pulleyGroup.add(crankGroup);

  // 7B. Alternator Pulley (Middle Right)
  const altPulleyGroup = new THREE.Group();
  altPulleyGroup.position.set(0.22, 0.08, 0);

  const altP1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 32), matDarkSteel);
  altP1.rotation.x = Math.PI / 2;
  altPulleyGroup.add(altP1);

  const altRing = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 24), matSilverMetal);
  altRing.rotation.x = Math.PI / 2;
  altRing.position.z = 0.025;
  altPulleyGroup.add(altRing);

  const altNut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 16), matSilverMetal);
  altNut.rotation.x = Math.PI / 2;
  altNut.position.z = 0.04;
  altPulleyGroup.add(altNut);

  pulleyGroup.add(altPulleyGroup);

  // 7C. Water Pump / Tensioner Pulley (Lower Right)
  const wpGroup = new THREE.Group();
  wpGroup.position.set(0.15, -0.18, 0);
  const wp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.045, 24), matBlackPlastic);
  wp1.rotation.x = Math.PI / 2;
  wpGroup.add(wp1);
  const wpNut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), matSilverMetal);
  wpNut.rotation.x = Math.PI / 2;
  wpNut.position.z = 0.025;
  wpGroup.add(wpNut);
  pulleyGroup.add(wpGroup);

  // 7D. Left Auxiliary Pulley (Middle Left)
  const auxGroup = new THREE.Group();
  auxGroup.position.set(-0.18, 0.02, 0);
  const aux1 = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 24), matDarkSteel);
  aux1.rotation.x = Math.PI / 2;
  auxGroup.add(aux1);
  const auxInner = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 12), matSilverMetal);
  auxInner.rotation.x = Math.PI / 2;
  auxInner.position.z = 0.026;
  auxGroup.add(auxInner);
  pulleyGroup.add(auxGroup);

  // 7E. Upper Timing Sprocket & Golden Yellow Nut (Upper Center)
  const timingGroup = new THREE.Group();
  timingGroup.position.set(0.02, 0.22, 0);
  const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.035, 36), matDarkSteel);
  gear.rotation.x = Math.PI / 2;
  timingGroup.add(gear);

  // Center Golden Yellow Nut (Matching reference image)
  const goldNut = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.025, 6), matGoldNut);
  goldNut.rotation.x = Math.PI / 2;
  goldNut.position.z = 0.02;
  timingGroup.add(goldNut);
  pulleyGroup.add(timingGroup);

  // 7F. Top Right Fan Rotor Shroud Assembly (Matching reference image shroud)
  const fanGroup = new THREE.Group();
  fanGroup.position.set(0.24, 0.26, 0);
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.065, 32), matBlackPlastic);
  shroud.rotation.x = Math.PI / 2;
  fanGroup.add(shroud);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), matSilverMetal);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.015;
  fanGroup.add(hub);

  const fanNut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), matSilverMetal);
  fanNut.rotation.x = Math.PI / 2;
  fanNut.position.z = 0.04;
  fanGroup.add(fanNut);
  pulleyGroup.add(fanGroup);

  // 7G. Serpentine Belt Loops
  const belt1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.018, 0.038), matBelt);
  belt1.position.set(0.11, -0.02, 0.01);
  belt1.rotation.z = -Math.PI / 4;
  pulleyGroup.add(belt1);

  const belt2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.038), matBelt);
  belt2.position.set(0.18, -0.05, 0.01);
  belt2.rotation.z = Math.PI / 3;
  pulleyGroup.add(belt2);

  const belt3 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.038), matBelt);
  belt3.position.set(-0.09, -0.05, 0.01);
  belt3.rotation.z = Math.PI / 5;
  pulleyGroup.add(belt3);

  root.add(pulleyGroup);

  // ── 8. EXHAUST MANIFOLD HEADERS (Back Side) ──
  const exhaustGroup = new THREE.Group();
  exhaustGroup.position.set(0, 0.05, -0.25);
  [-0.18, -0.06, 0.06, 0.18].forEach((x, i) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.28, 16), matExhaust);
    pipe.position.set(x, -0.05, 0);
    pipe.rotation.x = Math.PI / 4;
    exhaustGroup.add(pipe);
  });
  root.add(exhaustGroup);

  // ── 9. ALTERNATOR COPPER CORE HOUSING (Right Side) ──
  const altHousing = new THREE.Group();
  altHousing.position.set(0.26, 0, -0.05);
  const altBody = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.16, 20), matDarkSteel);
  altBody.rotation.z = Math.PI / 2;
  altHousing.add(altBody);

  const altCopper = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.12, 16), matCopper);
  altCopper.rotation.z = Math.PI / 2;
  altHousing.add(altCopper);
  root.add(altHousing);

  return root;
}

async function exportGLB() {
  const scene = new THREE.Scene();
  const engineModel = createEngineScene();
  scene.add(engineModel);

  const exporter = new GLTFExporter();
  const outputDir = path.resolve(process.cwd(), 'public/models');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Export GLB Binary
  try {
    const glbBuffer = await exporter.parseAsync(scene, { binary: true });
    const glbPath = path.join(outputDir, 'engine.glb');
    fs.writeFileSync(glbPath, Buffer.from(glbBuffer));
    console.log(`Successfully generated GLB model: ${glbPath} (${fs.statSync(glbPath).size} bytes)`);
  } catch (err) {
    console.error('Error generating GLB model:', err);
  }

  // Export GLTF JSON
  try {
    const gltfJson = await exporter.parseAsync(scene, { binary: false });
    const gltfPath = path.join(outputDir, 'engine.gltf');
    fs.writeFileSync(gltfPath, JSON.stringify(gltfJson, null, 2));
    console.log(`Successfully generated GLTF JSON model: ${gltfPath} (${fs.statSync(gltfPath).size} bytes)`);
  } catch (err) {
    console.error('Error generating GLTF model:', err);
  }
}

exportGLB();
