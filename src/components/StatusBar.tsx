// ============================================================
// Status Bar – Workstation Bottom Telemetry
// ============================================================

import React, { useMemo } from 'react';
import { useWorkstationStore } from '../store/workstationStore';
import { flattenAssembly } from '../data/vehicleAssembly';

export default function StatusBar() {
  const assembly = useWorkstationStore(s => s.assembly);
  const selectedNodeId = useWorkstationStore(s => s.selectedNodeId);
  const activeTool = useWorkstationStore(s => s.activeTool);
  const renderMode = useWorkstationStore(s => s.renderMode);
  const simulationStatus = useWorkstationStore(s => s.simulationStatus);
  const simulationProgress = useWorkstationStore(s => s.simulationProgress);
  const currentResults = useWorkstationStore(s => s.currentResults);

  const flatNodes = useMemo(() => flattenAssembly(assembly), [assembly]);
  const selectedNode = useMemo(
    () => flatNodes.find(n => n.id === selectedNodeId),
    [flatNodes, selectedNodeId]
  );

  const totalMass = currentResults?.totalMass ?? 1750;
  const partCount = flatNodes.length;

  return (
    <div className="status-bar">
      {/* Solver / Engine Status */}
      <div className="status-bar__item">
        <span
          className={`status-bar__dot ${
            simulationStatus === 'running'
              ? 'status-bar__dot--yellow'
              : simulationStatus === 'complete'
              ? 'status-bar__dot--green'
              : simulationStatus === 'error'
              ? 'status-bar__dot--red'
              : 'status-bar__dot--blue'
          }`}
        />
        <span>
          {simulationStatus === 'running'
            ? `SOLVER: CALCULATING (${simulationProgress}%)`
            : simulationStatus === 'complete'
            ? 'SOLVER: CONVERGED'
            : 'SOLVER: READY'}
        </span>
      </div>

      {/* Active CAD Tool */}
      <div className="status-bar__item">
        <span style={{ color: 'var(--text-secondary)' }}>TOOL:</span>
        <span style={{ color: 'var(--text-heading)' }}>{activeTool.toUpperCase()}</span>
      </div>

      {/* Selected Entity */}
      <div className="status-bar__item">
        <span style={{ color: 'var(--text-secondary)' }}>ENTITY:</span>
        <span style={{ color: selectedNode ? 'var(--text-accent)' : 'var(--text-muted)' }}>
          {selectedNode ? `${selectedNode.name} (${selectedNode.id})` : 'ROOT ASSEMBLY'}
        </span>
      </div>

      {/* Mass & Assembly Telemetry */}
      <div className="status-bar__item">
        <span style={{ color: 'var(--text-secondary)' }}>TOTAL MASS:</span>
        <span style={{ color: 'var(--text-value)' }}>{totalMass.toFixed(0)} kg</span>
      </div>

      <div className="status-bar__item">
        <span style={{ color: 'var(--text-secondary)' }}>PARTS:</span>
        <span style={{ color: 'var(--text-value)' }}>{partCount}</span>
      </div>

      <div className="status-bar__spacer" />

      {/* Shading */}
      <div className="status-bar__item">
        <span style={{ color: 'var(--text-secondary)' }}>SHADING:</span>
        <span>{renderMode.toUpperCase()}</span>
      </div>

      {/* Engineering Units */}
      <div className="status-bar__item">
        <span>UNITS: SI [mm, kg, s, N]</span>
      </div>

      {/* System Triad */}
      <div className="status-bar__item">
        <span>WCS: 0, 0, 0</span>
      </div>

      {/* Brand ID */}
      <div className="status-bar__item" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
        <span>KPIT TWIN v2.4</span>
      </div>
    </div>
  );
}
