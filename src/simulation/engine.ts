// ============================================================
// Parametric Engineering Simulation Engine
// Deterministic calculation model with dependency propagation
// DATA TYPE: Prototype / Simulation
// ============================================================

import { AssemblyNode, flattenAssembly } from '../data/vehicleAssembly';

export interface SimulationConfig {
  // Engine
  displacement: number;       // cc
  compressionRatio: number;   // :1
  maxRPM: number;             // rpm
  airFlowRate: number;        // g/s
  exhaustBackPressure: number;// kPa
  // Transmission
  transmissionEfficiency: number; // %
  finalDriveRatio: number;
  // Cooling
  radiatorCapacity: number;   // kW
  coolantFlowRate: number;    // L/min
  fanSpeed: number;           // rpm
  // Wheels / Tyres
  tyreWidth: number;          // mm
  tyreAspectRatio: number;    // %
  rimDiameter: number;        // inches
  rollingResistance: number;  // Crr
  gripCoefficient: number;    // μ
  // Body
  dragCoefficient: number;    // Cd
  frontalArea: number;        // m²
  // Suspension
  frontSpringRate: number;    // N/mm
  rearSpringRate: number;     // N/mm
  frontDampingRate: number;   // Ns/m
  rearDampingRate: number;    // Ns/m
}

export interface SimulationResults {
  // Mass
  totalMass: number;            // kg
  curbWeight: number;           // kg (with driver)
  
  // Power
  enginePeakPower: number;      // kW
  enginePeakTorque: number;     // Nm
  wheelPower: number;           // kW
  transmissionLoss: number;     // kW
  drivetrainLoss: number;       // kW
  
  // Efficiency
  thermalEfficiency: number;    // %
  overallEfficiency: number;    // %
  fuelConsumption: number;      // L/100km
  specificFuelConsumption: number; // g/kWh
  
  // Performance
  powerToWeight: number;        // kW/tonne
  topSpeed: number;             // km/h (estimated)
  acceleration0to100: number;   // seconds (estimated)
  
  // Thermal
  engineOperatingTemp: number;  // °C
  exhaustTemp: number;          // °C
  transmissionTemp: number;     // °C
  coolingMargin: number;        // %
  radiatorOutletTemp: number;   // °C
  
  // Durability
  engineDurability: number;     // % (composite score)
  transmissionDurability: number; // %
  suspensionDurability: number;   // %
  overallDurability: number;      // %
  
  // Cost
  totalManufacturingCost: number; // ₹
  
  // Energy Flow
  engineOutput: number;
  transmissionOutput: number;
  drivetrainOutput: number;
  wheelOutput: number;
  totalLoss: number;
  
  // Aerodynamic
  dragForce100kmh: number;      // N
  rollingResistanceForce: number; // N
  
  // Ride
  frontNaturalFreq: number;     // Hz
  rearNaturalFreq: number;      // Hz
  rideQuality: number;          // % (composite)
  
  dataType: 'SIMULATION';
  timestamp: string;
}

// Extract config from current assembly tree state
export const extractConfig = (root: AssemblyNode): SimulationConfig => {
  const nodes = flattenAssembly(root);
  const findParam = (nodeId: string, paramName: string): number => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return 0;
    const param = node.parameters.find(p => p.name === paramName);
    return param ? Number(param.value) : 0;
  };

  return {
    displacement: findParam('engine-block', 'Displacement'),
    compressionRatio: findParam('engine-block', 'Compression Ratio'),
    maxRPM: findParam('engine-block', 'Max RPM'),
    airFlowRate: findParam('engine-intake', 'Air Flow Rate'),
    exhaustBackPressure: findParam('engine-exhaust', 'Back Pressure'),
    transmissionEfficiency: findParam('transmission', 'Efficiency'),
    finalDriveRatio: findParam('transmission', 'Final Drive'),
    radiatorCapacity: findParam('cooling-radiator', 'Cooling Capacity'),
    coolantFlowRate: findParam('cooling-radiator', 'Coolant Flow Rate'),
    fanSpeed: findParam('cooling-fan', 'Fan Speed'),
    tyreWidth: findParam('wheel-fl', 'Tyre Width'),
    tyreAspectRatio: findParam('wheel-fl', 'Aspect Ratio') || 60,
    rimDiameter: findParam('wheel-fl', 'Rim Diameter') || 16,
    rollingResistance: findParam('wheel-fl', 'Rolling Resistance'),
    gripCoefficient: findParam('wheel-fl', 'Grip Coefficient'),
    dragCoefficient: findParam('body-exterior', 'Drag Coefficient'),
    frontalArea: findParam('body-exterior', 'Frontal Area'),
    frontSpringRate: findParam('suspension-front', 'Spring Rate'),
    rearSpringRate: findParam('suspension-rear', 'Spring Rate'),
    frontDampingRate: findParam('suspension-front', 'Damping Rate'),
    rearDampingRate: findParam('suspension-rear', 'Damping Rate'),
  };
};

// Calculate total vehicle mass from assembly
export const calculateTotalMass = (root: AssemblyNode): number => {
  const nodes = flattenAssembly(root);
  let mass = 0;
  for (const node of nodes) {
    if (node.type === 'part' && node.mass) {
      mass += node.mass;
    }
  }
  return mass;
};

// Calculate total manufacturing cost
export const calculateTotalCost = (root: AssemblyNode): number => {
  const nodes = flattenAssembly(root);
  let cost = 0;
  for (const node of nodes) {
    const costParam = node.parameters.find(p => p.name === 'Manufacturing Cost');
    if (costParam) {
      cost += Number(costParam.value);
    }
  }
  return cost;
};

// Main simulation function
export const runSimulation = (root: AssemblyNode): SimulationResults => {
  const config = extractConfig(root);
  const totalMass = calculateTotalMass(root);
  const curbWeight = totalMass + 75; // driver
  const totalCost = calculateTotalCost(root);

  // ── Engine Power Calculation ──
  // Simplified brake mean effective pressure model
  const bmep = (config.compressionRatio - 1) * 1.15; // bar (simplified)
  const enginePeakPower = (bmep * config.displacement * config.maxRPM) / (120000 * 10); // kW
  const enginePeakTorque = (enginePeakPower * 9549) / config.maxRPM; // Nm

  // Air flow factor
  const airFlowFactor = Math.min(config.airFlowRate / 180, 1.3);
  const adjustedPower = enginePeakPower * airFlowFactor;

  // Exhaust back pressure penalty
  const exhaustPenalty = 1 - (config.exhaustBackPressure - 10) * 0.008;
  const netEnginePower = adjustedPower * Math.max(exhaustPenalty, 0.85);
  const netEngineTorque = (netEnginePower * 9549) / config.maxRPM;

  // ── Transmission / Drivetrain ──
  const transEff = config.transmissionEfficiency / 100;
  const drivetrainEff = 0.96; // axle/diff losses
  const transmissionOutput = netEnginePower * transEff;
  const transmissionLoss = netEnginePower * (1 - transEff);
  const drivetrainOutput = transmissionOutput * drivetrainEff;
  const drivetrainLoss = transmissionOutput * (1 - drivetrainEff);
  const wheelPower = drivetrainOutput;
  const totalLoss = netEnginePower - wheelPower;

  // ── Thermal Efficiency ──
  const baseThermalEff = 25 + (config.compressionRatio - 8) * 2.5;
  const thermalEfficiency = Math.min(Math.max(baseThermalEff, 22), 42);

  // ── Overall Efficiency ──
  const overallEfficiency = thermalEfficiency * transEff * drivetrainEff;

  // ── Fuel consumption ──
  const specificFuelConsumption = 360 - (thermalEfficiency - 25) * 8; // g/kWh
  const fuelConsumption = (specificFuelConsumption * netEnginePower * 0.35) / (0.745 * 100); // L/100km approx

  // ── Aerodynamic ──
  const rho = 1.225; // air density
  const v100 = 100 / 3.6; // m/s
  const dragForce = 0.5 * rho * config.dragCoefficient * config.frontalArea * v100 * v100;
  const rollingResistanceForce = config.rollingResistance * curbWeight * 9.81;

  // ── Performance ──
  const powerToWeight = (netEnginePower / curbWeight) * 1000;
  // Simplified top speed (drag = power at speed)
  const topSpeed = Math.pow((2 * wheelPower * 1000) / (rho * config.dragCoefficient * config.frontalArea), 1/3) * 3.6;
  // Simplified 0-100
  const avgAccelPower = wheelPower * 0.65; // average across gears
  const acceleration0to100 = (0.5 * curbWeight * v100 * v100) / (avgAccelPower * 1000);

  // ── Thermal ──
  const heatRejection = netEnginePower * ((100 - thermalEfficiency) / 100) * 0.6; // kW to coolant
  const coolingMargin = ((config.radiatorCapacity - heatRejection) / config.radiatorCapacity) * 100;
  const engineOperatingTemp = 90 + (heatRejection / config.radiatorCapacity) * 15;
  const radiatorOutletTemp = engineOperatingTemp - (config.coolantFlowRate / 120) * 17;
  const exhaustTemp = 450 + netEnginePower * 2.5;
  const transmissionTemp = 70 + (transmissionLoss / transEff) * 2;

  // ── Durability ──
  const tempFactor = Math.max(0, 100 - (engineOperatingTemp - 95) * 3);
  const rpmFactor = Math.max(0, 100 - (config.maxRPM - 6000) * 0.015);
  const engineDurability = (tempFactor * 0.5 + rpmFactor * 0.5);
  const transmissionDurability = Math.max(50, 95 - (netEngineTorque / 250) * 10);
  const suspFactor = (config.frontDampingRate + config.rearDampingRate) / 6000;
  const suspensionDurability = Math.min(95, 70 + suspFactor * 25);
  const overallDurability = engineDurability * 0.4 + transmissionDurability * 0.3 + suspensionDurability * 0.3;

  // ── Ride Quality ──
  const frontMassPerWheel = curbWeight * 0.55 / 2;
  const rearMassPerWheel = curbWeight * 0.45 / 2;
  const frontNaturalFreq = (1 / (2 * Math.PI)) * Math.sqrt((config.frontSpringRate * 1000) / frontMassPerWheel);
  const rearNaturalFreq = (1 / (2 * Math.PI)) * Math.sqrt((config.rearSpringRate * 1000) / rearMassPerWheel);
  // Ideal natural freq is 1.0-1.5 Hz for comfort
  const freqScore = (n: number) => Math.max(0, 100 - Math.abs(n - 1.2) * 80);
  const rideQuality = (freqScore(frontNaturalFreq) + freqScore(rearNaturalFreq)) / 2;

  return {
    totalMass,
    curbWeight,
    enginePeakPower: Math.round(netEnginePower * 10) / 10,
    enginePeakTorque: Math.round(netEngineTorque * 10) / 10,
    wheelPower: Math.round(wheelPower * 10) / 10,
    transmissionLoss: Math.round(transmissionLoss * 10) / 10,
    drivetrainLoss: Math.round(drivetrainLoss * 10) / 10,
    thermalEfficiency: Math.round(thermalEfficiency * 10) / 10,
    overallEfficiency: Math.round(overallEfficiency * 10) / 10,
    fuelConsumption: Math.round(fuelConsumption * 10) / 10,
    specificFuelConsumption: Math.round(specificFuelConsumption),
    powerToWeight: Math.round(powerToWeight * 10) / 10,
    topSpeed: Math.round(topSpeed),
    acceleration0to100: Math.round(acceleration0to100 * 10) / 10,
    engineOperatingTemp: Math.round(engineOperatingTemp * 10) / 10,
    exhaustTemp: Math.round(exhaustTemp),
    transmissionTemp: Math.round(transmissionTemp * 10) / 10,
    coolingMargin: Math.round(coolingMargin * 10) / 10,
    radiatorOutletTemp: Math.round(radiatorOutletTemp * 10) / 10,
    engineDurability: Math.round(engineDurability * 10) / 10,
    transmissionDurability: Math.round(transmissionDurability * 10) / 10,
    suspensionDurability: Math.round(suspensionDurability * 10) / 10,
    overallDurability: Math.round(overallDurability * 10) / 10,
    totalManufacturingCost: totalCost,
    engineOutput: Math.round(netEnginePower * 10) / 10,
    transmissionOutput: Math.round(transmissionOutput * 10) / 10,
    drivetrainOutput: Math.round(drivetrainOutput * 10) / 10,
    wheelOutput: Math.round(wheelPower * 10) / 10,
    totalLoss: Math.round(totalLoss * 10) / 10,
    dragForce100kmh: Math.round(dragForce),
    rollingResistanceForce: Math.round(rollingResistanceForce),
    frontNaturalFreq: Math.round(frontNaturalFreq * 100) / 100,
    rearNaturalFreq: Math.round(rearNaturalFreq * 100) / 100,
    rideQuality: Math.round(rideQuality * 10) / 10,
    dataType: 'SIMULATION',
    timestamp: new Date().toISOString(),
  };
};

// ── ML Model Interface ──
// Currently wired to deterministic simulation
// Replace predict() implementation with trained ML model later
export interface MLModelInterface {
  predict(config: SimulationConfig): Promise<Partial<SimulationResults>>;
}

export class PrototypeMLModel implements MLModelInterface {
  async predict(config: SimulationConfig): Promise<Partial<SimulationResults>> {
    // Stub: uses deterministic model for now
    // Create a minimal assembly to extract results
    // In production, this would call a trained model
    void config;
    return {};
  }
}
