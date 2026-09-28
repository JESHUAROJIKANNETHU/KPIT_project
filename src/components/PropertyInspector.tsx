// ============================================================
// Property Inspector – Engineering Parameter Panel
// CAD / CAE Component Attribute & Spec Editor
// ============================================================

import React, { useMemo, useCallback, useState } from 'react';
import { useWorkstationStore } from '../store/workstationStore';
import { AssemblyNode, flattenAssembly, getAssemblyPath } from '../data/vehicleAssembly';
import type { ComponentParameter } from '../data/vehicleAssembly';

const CATEGORY_ORDER = ['general', 'geometry', 'performance', 'thermal', 'cost', 'durability'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  general: 'Identity & General',
  geometry: 'Geometry & Dimensions',
  performance: 'Performance & Dynamics',
  thermal: 'Thermal & CAE State',
  cost: 'Cost & Manufacturing',
  durability: 'Durability & Stress',
};

function ParameterRow({ param, nodeId }: { param: ComponentParameter; nodeId: string }) {
  const updateParameter = useWorkstationStore(s => s.updateParameter);
  const [localValue, setLocalValue] = useState<string | null>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    if (localValue !== null) {
      const numVal = parseFloat(localValue);
      if (!isNaN(numVal)) {
        // Enforce min/max if present
        let val = numVal;
        if (param.min !== undefined) val = Math.max(param.min, val);
        if (param.max !== undefined) val = Math.min(param.max, val);
        updateParameter(nodeId, param.name, val);
      }
      setLocalValue(null);
    }
  }, [localValue, nodeId, param.name, param.min, param.max, updateParameter]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  }, []);

  const badgeClass =
    param.dataType === 'SIMULATION'
      ? 'param-row__badge--sim'
      : param.dataType === 'ML_PREDICTION'
      ? 'param-row__badge--ml'
      : '';

  return (
    <div className="param-row">
      <span className="param-row__label" title={param.name}>
        {param.name}
      </span>

      {param.editable && typeof param.value === 'number' ? (
        <input
          className="param-row__input"
          type="number"
          value={localValue !== null ? localValue : param.value}
          min={param.min}
          max={param.max}
          step={param.step || 1}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          title={`Editable parameter (Min: ${param.min ?? '—'}, Max: ${param.max ?? '—'}, Step: ${param.step ?? 1})`}
        />
      ) : (
        <span className="param-row__value">
          {typeof param.value === 'number' ? param.value.toLocaleString() : param.value}
        </span>
      )}

      {param.unit && <span className="param-row__unit">{param.unit}</span>}

      {(param.dataType === 'SIMULATION' || param.dataType === 'ML_PREDICTION') && (
        <span className={`param-row__badge ${badgeClass}`}>
          {param.dataType === 'SIMULATION' ? 'SIM' : 'ML'}
        </span>
      )}
    </div>
  );
}

export default function PropertyInspector() {
  const assembly = useWorkstationStore(s => s.assembly);
  const selectedNodeId = useWorkstationStore(s => s.selectedNodeId);
  const isolateNode = useWorkstationStore(s => s.isolateNode);
  const toggleNodeVisibility = useWorkstationStore(s => s.toggleNodeVisibility);
  const currentResults = useWorkstationStore(s => s.currentResults);

  const flatNodes = useMemo(() => flattenAssembly(assembly), [assembly]);
  const selectedNode: AssemblyNode | null = useMemo(() => {
    if (!selectedNodeId) return null;
    return flatNodes.find(n => n.id === selectedNodeId) || null;
  }, [flatNodes, selectedNodeId]);

  const path = useMemo(() => {
    if (!selectedNodeId) return [];
    return getAssemblyPath(assembly, selectedNodeId);
  }, [assembly, selectedNodeId]);

  // Group parameters by category
  const grouped = useMemo(() => {
    if (!selectedNode) return {};
    const groups: Record<string, ComponentParameter[]> = {};
    for (const param of selectedNode.parameters) {
      if (!groups[param.category]) groups[param.category] = [];
      groups[param.category].push(param);
    }
    return groups;
  }, [selectedNode]);

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((cat: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // When no node is selected, show top-level Digital Twin vehicle specifications
  if (!selectedNode) {
    return (
      <div style={{ padding: '8px 12px' }}>
        <div className="panel-props__title">KPIT DIGITAL TWIN</div>
        <div className="panel-props__path">VEHICLE ASSEMBLY ROOT</div>

        <div style={{ marginTop: 10 }}>
          <div className="panel-props__section-header" style={{ padding: '4px 0' }}>
            ASSEMBLY SPECIFICATIONS
          </div>
          <div className="param-row" style={{ padding: '2px 0' }}>
            <span className="param-row__label">Vehicle Model</span>
            <span className="param-row__value">KPIT SUV-EV Twin</span>
          </div>
          <div className="param-row" style={{ padding: '2px 0' }}>
            <span className="param-row__label">Total Vehicle Mass</span>
            <span className="param-row__value" style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>
              {(currentResults?.totalMass ?? 1745).toFixed(0)}
            </span>
            <span className="param-row__unit">kg</span>
          </div>
          <div className="param-row" style={{ padding: '2px 0' }}>
            <span className="param-row__label">Net System Power</span>
            <span className="param-row__value">
              {(currentResults?.enginePeakPower ?? 85.0).toFixed(1)}
            </span>
            <span className="param-row__unit">kW</span>
          </div>
          <div className="param-row" style={{ padding: '2px 0' }}>
            <span className="param-row__label">Peak Wheel Torque</span>
            <span className="param-row__value">
              {(currentResults?.enginePeakTorque ?? 144.0).toFixed(0)}
            </span>
            <span className="param-row__unit">Nm</span>
          </div>
          <div className="param-row" style={{ padding: '2px 0' }}>
            <span className="param-row__label">Overall Efficiency</span>
            <span className="param-row__value" style={{ color: 'var(--accent-green)' }}>
              {(currentResults?.overallEfficiency ?? 34.2).toFixed(1)}
            </span>
            <span className="param-row__unit">%</span>
          </div>
          <div className="param-row" style={{ padding: '2px 0' }}>
            <span className="param-row__label">0–100 km/h Accel</span>
            <span className="param-row__value">
              {(currentResults?.acceleration0to100 ?? 10.2).toFixed(2)}
            </span>
            <span className="param-row__unit">s</span>
          </div>
          <div className="param-row" style={{ padding: '2px 0' }}>
            <span className="param-row__label">Estimated Top Speed</span>
            <span className="param-row__value">
              {(currentResults?.topSpeed ?? 178.5).toFixed(0)}
            </span>
            <span className="param-row__unit">km/h</span>
          </div>
          <div className="param-row" style={{ padding: '2px 0' }}>
            <span className="param-row__label">Total Parts Count</span>
            <span className="param-row__value">{flatNodes.length}</span>
          </div>
        </div>

        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          💡 Click any component in the 3D model or assembly tree to inspect and edit its engineering parameters.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel-props__title">{selectedNode.name}</div>
      <div className="panel-props__path">{path.join(' / ')}</div>

      {/* Quick engineering actions for selected component */}
      <div style={{ padding: '4px 12px 8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button
          className="toolbar__view-btn"
          onClick={() => isolateNode(selectedNode.id)}
          title="Isolate this component in 3D viewport"
          style={{ fontSize: '10px' }}
        >
          Isolate
        </button>
        <button
          className="toolbar__view-btn"
          onClick={() => toggleNodeVisibility(selectedNode.id)}
          title="Toggle component visibility"
          style={{ fontSize: '10px' }}
        >
          {selectedNode.visible ? 'Hide' : 'Show'}
        </button>
        {selectedNode.type === 'part' && selectedNode.partId && (
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-blue)',
              marginLeft: 'auto',
              background: 'var(--bg-input)',
              padding: '2px 6px',
              borderRadius: 2,
            }}
          >
            {selectedNode.partId}
          </span>
        )}
      </div>

      {/* Grouped parameter categories */}
      {CATEGORY_ORDER.map(cat => {
        const params = grouped[cat];
        if (!params || params.length === 0) return null;
        const collapsed = collapsedSections.has(cat);
        return (
          <div key={cat} className="panel-props__section">
            <div
              className="panel-props__section-header"
              onClick={() => toggleSection(cat)}
            >
              <span
                style={{
                  marginRight: 6,
                  fontSize: 8,
                  display: 'inline-block',
                  transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                  transition: 'transform 0.15s',
                }}
              >
                ▶
              </span>
              {CATEGORY_LABELS[cat]}
            </div>
            {!collapsed &&
              params.map(param => (
                <ParameterRow key={param.name} param={param} nodeId={selectedNode.id} />
              ))}
          </div>
        );
      })}
    </>
  );
}
