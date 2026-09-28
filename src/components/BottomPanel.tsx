// ============================================================
// Bottom Panel – Engineering Docked Workspace
// Simulation, Power Flow, Comparison, History, Optimization, Console
// ============================================================

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useWorkstationStore, BottomPanelTab } from '../store/workstationStore';
import { SimulationResults } from '../simulation/engine';

// ── Simulation Tab ──
function SimulationTab() {
  const status = useWorkstationStore(s => s.simulationStatus);
  const progress = useWorkstationStore(s => s.simulationProgress);
  const results = useWorkstationStore(s => s.currentResults);
  const baseline = useWorkstationStore(s => s.baselineResults);
  const runSim = useWorkstationStore(s => s.runSimulationAction);
  const activeRevisionId = useWorkstationStore(s => s.activeRevisionId);

  const statusLabel =
    status === 'idle'
      ? 'Ready / Unsolved'
      : status === 'preparing'
      ? 'Preparing Model Tree...'
      : status === 'running'
      ? 'Calculating Dynamics & Losses...'
      : status === 'complete'
      ? 'Converged (SI Units)'
      : 'Solver Error';

  const statusColor =
    status === 'complete'
      ? 'var(--accent-green)'
      : status === 'error'
      ? 'var(--accent-red)'
      : status === 'idle'
      ? 'var(--accent-yellow)'
      : 'var(--accent-blue)';

  const delta = (current: number | undefined, base: number | undefined, invert?: boolean) => {
    if (current === undefined || base === undefined || base === 0) return null;
    const diff = current - base;
    if (Math.abs(diff) < 0.01) return null;
    const pct = ((diff / base) * 100).toFixed(1);
    const isPositive = invert ? diff < 0 : diff > 0;
    return (
      <span
        className={`sim-result-card__delta ${
          isPositive ? 'sim-result-card__delta--positive' : 'sim-result-card__delta--negative'
        }`}
      >
        {diff > 0 ? '+' : ''}
        {pct}%
      </span>
    );
  };

  const resultCards = useMemo(() => {
    if (!results) return [];
    return [
      { label: 'Net Peak Power', value: results.enginePeakPower, unit: 'kW', baseval: baseline?.enginePeakPower },
      { label: 'Net Peak Torque', value: results.enginePeakTorque, unit: 'Nm', baseval: baseline?.enginePeakTorque },
      { label: 'Wheel Traction Power', value: results.wheelPower, unit: 'kW', baseval: baseline?.wheelPower },
      { label: 'Overall Efficiency', value: results.overallEfficiency, unit: '%', baseval: baseline?.overallEfficiency },
      { label: 'Fuel Consumption', value: results.fuelConsumption, unit: 'L/100km', baseval: baseline?.fuelConsumption, invert: true },
      { label: 'Top Speed (est.)', value: results.topSpeed, unit: 'km/h', baseval: baseline?.topSpeed },
      { label: '0–100 km/h Accel', value: results.acceleration0to100, unit: 's', baseval: baseline?.acceleration0to100, invert: true },
      { label: 'Operating Temp', value: results.engineOperatingTemp, unit: '°C', baseval: baseline?.engineOperatingTemp, invert: true },
      { label: 'Cooling Margin', value: results.coolingMargin, unit: '%', baseval: baseline?.coolingMargin },
      { label: 'Overall Durability', value: results.overallDurability, unit: '%', baseval: baseline?.overallDurability },
      { label: 'Total Curb Weight', value: results.curbWeight, unit: 'kg', baseval: baseline?.curbWeight, invert: true },
      { label: 'Manufacturing Cost', value: results.totalManufacturingCost, unit: '₹', baseval: baseline?.totalManufacturingCost, invert: true },
    ];
  }, [results, baseline]);

  return (
    <div className="sim-panel">
      <div className="sim-panel__control">
        <div className="sim-panel__field">
          <span className="sim-panel__field-label">Active Scenario</span>
          <span className="sim-panel__field-value">REV-{String(activeRevisionId).padStart(2, '0')}</span>
        </div>
        <div className="sim-panel__field">
          <span className="sim-panel__field-label">Model Geometry</span>
          <span className="sim-panel__field-value">Parametric 3D Assembly</span>
        </div>
        <div className="sim-panel__field">
          <span className="sim-panel__field-label">Solver Engine</span>
          <span className="sim-panel__field-value">KPIT Multi-Physics v2.4</span>
        </div>
        <div className="sim-panel__field">
          <span className="sim-panel__field-label">Convergence</span>
          <span className="sim-panel__field-value" style={{ color: statusColor }}>
            {statusLabel}
          </span>
        </div>

        <div className="sim-panel__progress" style={{ height: 5 }}>
          <div className="sim-panel__progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <button
          className="sim-panel__run-btn"
          onClick={runSim}
          disabled={status === 'running' || status === 'preparing'}
          title="Run full multi-physics simulation solver (F5)"
        >
          {status === 'running' || status === 'preparing' ? '⏳ Calculating...' : '▶ Run Solver (F5)'}
        </button>
      </div>

      <div className="sim-panel__results">
        {resultCards.map(card => (
          <div key={card.label} className="sim-result-card">
            <div className="sim-result-card__label">{card.label}</div>
            <div>
              <span className="sim-result-card__value">
                {typeof card.value === 'number' ? card.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : card.value}
              </span>
              <span className="sim-result-card__unit">{card.unit}</span>
              {delta(card.value, card.baseval, card.invert)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Power Flow Tab ──
function PowerFlowTab() {
  const results = useWorkstationStore(s => s.currentResults);

  if (!results) {
    return <div style={{ color: 'var(--text-muted)', padding: 16 }}>Run simulation to view power flow</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: 11, color: 'var(--text-label)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Drivetrain Sankey Power Flow & Transmission Losses
      </div>
      <div className="power-flow">
        <div className="power-flow__stage">
          <span className="power-flow__stage-label">Engine Output</span>
          <span className="power-flow__stage-value">{results.engineOutput.toFixed(1)}</span>
          <span className="power-flow__stage-unit">kW</span>
        </div>

        <div className="power-flow__arrow">➔</div>

        <div className="power-flow__loss">
          <span className="power-flow__loss-label">Trans. Loss</span>
          <span className="power-flow__loss-value">−{results.transmissionLoss.toFixed(1)} kW</span>
        </div>

        <div className="power-flow__arrow">➔</div>

        <div className="power-flow__stage">
          <span className="power-flow__stage-label">Transmission Out</span>
          <span className="power-flow__stage-value">{results.transmissionOutput.toFixed(1)}</span>
          <span className="power-flow__stage-unit">kW</span>
        </div>

        <div className="power-flow__arrow">➔</div>

        <div className="power-flow__loss">
          <span className="power-flow__loss-label">Drivetrain Loss</span>
          <span className="power-flow__loss-value">−{results.drivetrainLoss.toFixed(1)} kW</span>
        </div>

        <div className="power-flow__arrow">➔</div>

        <div className="power-flow__stage" style={{ borderColor: 'var(--accent-green)', borderWidth: 1.5 }}>
          <span className="power-flow__stage-label">Wheel Output</span>
          <span className="power-flow__stage-value" style={{ color: 'var(--accent-green)' }}>
            {results.wheelOutput.toFixed(1)}
          </span>
          <span className="power-flow__stage-unit">kW</span>
        </div>

        <div style={{ marginLeft: 20 }}>
          <div className="power-flow__loss" style={{ borderColor: 'rgba(231,76,60,0.5)', background: 'rgba(231,76,60,0.1)' }}>
            <span className="power-flow__loss-label">Total Heat Dissipation</span>
            <span className="power-flow__loss-value" style={{ color: '#e74c3c' }}>
              −{results.totalLoss.toFixed(1)} kW
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Comparison Tab ──
function ComparisonTab() {
  const results = useWorkstationStore(s => s.currentResults);
  const baseline = useWorkstationStore(s => s.baselineResults);
  const revisions = useWorkstationStore(s => s.revisions);
  const [selectedRevId, setSelectedRevId] = useState<number>(1);

  const compareBase = useMemo(() => {
    const rev = revisions.find(r => r.id === selectedRevId);
    return rev?.results || baseline;
  }, [revisions, selectedRevId, baseline]);

  if (!results || !compareBase) {
    return <div style={{ color: 'var(--text-muted)', padding: 16 }}>Run simulation to compare configurations</div>;
  }

  const rows: Array<{ name: string; current: number; base: number; unit: string; invert?: boolean }> = [
    { name: 'Peak Engine Power', current: results.enginePeakPower, base: compareBase.enginePeakPower, unit: 'kW' },
    { name: 'Peak Engine Torque', current: results.enginePeakTorque, base: compareBase.enginePeakTorque, unit: 'Nm' },
    { name: 'Wheel Traction Power', current: results.wheelPower, base: compareBase.wheelPower, unit: 'kW' },
    { name: 'Overall Powertrain Efficiency', current: results.overallEfficiency, base: compareBase.overallEfficiency, unit: '%' },
    { name: 'Fuel Consumption', current: results.fuelConsumption, base: compareBase.fuelConsumption, unit: 'L/100km', invert: true },
    { name: 'Top Speed (estimated)', current: results.topSpeed, base: compareBase.topSpeed, unit: 'km/h' },
    { name: '0–100 km/h Acceleration', current: results.acceleration0to100, base: compareBase.acceleration0to100, unit: 's', invert: true },
    { name: 'Engine Operating Temperature', current: results.engineOperatingTemp, base: compareBase.engineOperatingTemp, unit: '°C', invert: true },
    { name: 'Cooling Margin', current: results.coolingMargin, base: compareBase.coolingMargin, unit: '%' },
    { name: 'Overall Component Durability', current: results.overallDurability, base: compareBase.overallDurability, unit: '%' },
    { name: 'Total Curb Weight', current: results.curbWeight, base: compareBase.curbWeight, unit: 'kg', invert: true },
    { name: 'Total Manufacturing Cost', current: results.totalManufacturingCost, base: compareBase.totalManufacturingCost, unit: '₹', invert: true },
    { name: 'Aerodynamic Drag Force @100km/h', current: results.dragForce100kmh, base: compareBase.dragForce100kmh, unit: 'N', invert: true },
    { name: 'Rolling Resistance Force', current: results.rollingResistanceForce, base: compareBase.rollingResistanceForce, unit: 'N', invert: true },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Parameter Comparison: Current Active vs. Reference Baseline
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Compare Against:</span>
          <select
            value={selectedRevId}
            onChange={e => setSelectedRevId(Number(e.target.value))}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: 11,
              borderRadius: 2,
              padding: '2px 6px',
            }}
          >
            {revisions.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <table className="comparison-table">
        <thead>
          <tr>
            <th>Engineering Metric</th>
            <th>Baseline</th>
            <th>Current Active</th>
            <th>Calculated Delta</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const diff = row.current - row.base;
            const pct = row.base !== 0 ? ((diff / row.base) * 100).toFixed(1) : '0.0';
            const isPositive = row.invert ? diff < 0 : diff > 0;
            const color =
              Math.abs(diff) < 0.05
                ? 'var(--text-muted)'
                : isPositive
                ? 'var(--accent-green)'
                : 'var(--accent-red)';
            return (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.base.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                <td>{row.current.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                <td style={{ color, fontWeight: Math.abs(diff) > 0.05 ? 600 : 'normal' }}>
                  {diff > 0 ? '+' : ''}
                  {diff.toFixed(1)} ({diff > 0 ? '+' : ''}
                  {pct}%)
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 10 }}>{row.unit}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── History Tab ──
function HistoryTab() {
  const revisions = useWorkstationStore(s => s.revisions);
  const activeRevisionId = useWorkstationStore(s => s.activeRevisionId);
  const loadRevision = useWorkstationStore(s => s.loadRevision);
  const setSaveModalOpen = useWorkstationStore(s => s.setSaveModalOpen);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Stored Configuration Revisions ({revisions.length})
        </span>
        <button
          className="toolbar__view-btn"
          onClick={() => setSaveModalOpen(true)}
          style={{ fontSize: 11, padding: '2px 8px' }}
        >
          + Save Current Revision
        </button>
      </div>

      <div className="revision-list" style={{ flex: 1, overflowY: 'auto' }}>
        {revisions.map(rev => (
          <div
            key={rev.id}
            className={`revision-item${rev.id === activeRevisionId ? ' revision-item--active' : ''}`}
            onClick={() => loadRevision(rev.id)}
            title="Click to restore this configuration into the 3D model and solver"
          >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="revision-item__name">{rev.name}</span>
                {rev.id === activeRevisionId && (
                  <span
                    style={{
                      fontSize: 9,
                      background: 'var(--accent-blue)',
                      color: '#fff',
                      padding: '1px 5px',
                      borderRadius: 2,
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {rev.description}
              </span>
            </div>

            {rev.results && (
              <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-value)' }}>{rev.results.totalMass.toFixed(0)} kg</span>
                <span style={{ color: 'var(--accent-blue)' }}>{rev.results.enginePeakPower.toFixed(1)} kW</span>
                <span style={{ color: 'var(--accent-green)' }}>{rev.results.overallEfficiency.toFixed(1)}%</span>
              </div>
            )}

            <span className="revision-item__time">
              {new Date(rev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>

            <button
              className="toolbar__view-btn"
              onClick={(e) => {
                e.stopPropagation();
                loadRevision(rev.id);
              }}
              style={{ fontSize: 10, padding: '2px 8px' }}
            >
              Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Optimization Tab ──
function OptimizationTab() {
  const [objective, setObjective] = useState<string>('balanced');
  const results = useWorkstationStore(s => s.currentResults);
  const updateParameter = useWorkstationStore(s => s.updateParameter);

  const objectives = ['efficiency', 'performance', 'cost', 'durability', 'balanced'];

  const suggestions = useMemo(() => {
    if (!results) return [];
    const sugs: Array<{ nodeId: string; param: string; targetValue: number; label: string; suggestion: string; impact: string }> = [];

    if (objective === 'efficiency' || objective === 'balanced') {
      sugs.push({
        nodeId: 'body-exterior',
        param: 'Drag Coefficient',
        targetValue: 0.30,
        label: 'Aero Optimization',
        suggestion: 'Reduce Cd from 0.35 to 0.30 via underbody panelling',
        impact: '~5.2% fuel & energy reduction',
      });
      sugs.push({
        nodeId: 'wheel-fl',
        param: 'Rolling Resistance',
        targetValue: 0.008,
        label: 'Tyre Crr',
        suggestion: 'Switch to Low Rolling Resistance silica tyres (0.008 Crr)',
        impact: '~3.4% highway efficiency gain',
      });
      sugs.push({
        nodeId: 'transmission',
        param: 'Efficiency',
        targetValue: 97.5,
        label: 'Gearbox Low-friction',
        suggestion: 'Synthetic fluid & polished gear finish (97.5% eff)',
        impact: '+2.4 kW delivered to wheels',
      });
    }

    if (objective === 'performance' || objective === 'balanced') {
      sugs.push({
        nodeId: 'engine-block',
        param: 'Displacement',
        targetValue: 1800,
        label: 'Displacement',
        suggestion: 'Increase displacement to 1800 cc',
        impact: '+18.5 kW peak power increase',
      });
      sugs.push({
        nodeId: 'engine-block',
        param: 'Compression Ratio',
        targetValue: 11.5,
        label: 'Compression',
        suggestion: 'Increase compression ratio to 11.5:1',
        impact: '+4.2% thermal efficiency',
      });
    }

    if (objective === 'durability' || objective === 'balanced') {
      sugs.push({
        nodeId: 'cooling-radiator',
        param: 'Cooling Capacity',
        targetValue: 45,
        label: 'Cooling Margin',
        suggestion: 'Enlarge aluminium radiator core to 45 kW',
        impact: '+28% thermal headroom',
      });
    }

    return sugs;
  }, [objective, results]);

  const handleApplySuggestion = (sug: { nodeId: string; param: string; targetValue: number }) => {
    updateParameter(sug.nodeId, sug.param, sug.targetValue);
  };

  return (
    <div className="opt-panel">
      <div className="opt-panel__objectives">
        <div style={{ fontSize: 10, color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: 4 }}>
          Target Objective
        </div>
        {objectives.map(obj => (
          <button
            key={obj}
            className={`opt-panel__obj-btn${obj === objective ? ' opt-panel__obj-btn--active' : ''}`}
            onClick={() => setObjective(obj)}
          >
            {obj.charAt(0).toUpperCase() + obj.slice(1)}
          </button>
        ))}
      </div>

      <div className="opt-panel__results">
        <div style={{ fontSize: 10, color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: 8 }}>
          Candidate Parametric Design Recommendations
        </div>

        <table className="comparison-table">
          <thead>
            <tr>
              <th>Subsystem</th>
              <th>Recommendation</th>
              <th>Expected Impact</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s, i) => (
              <tr key={i}>
                <td>{s.label}</td>
                <td>{s.suggestion}</td>
                <td style={{ color: 'var(--accent-green)' }}>{s.impact}</td>
                <td>
                  <button
                    className="toolbar__view-btn"
                    onClick={() => handleApplySuggestion(s)}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    title={`Apply ${s.param} = ${s.targetValue}`}
                  >
                    Apply
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Console Tab ──
function ConsoleTab() {
  const messages = useWorkstationStore(s => s.consoleMessages);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="console-output" ref={scrollRef} style={{ height: '100%', overflowY: 'auto' }}>
      {messages.map((msg, i) => (
        <div key={i} className="console-output__line">
          <span className="console-output__time">[{msg.time}]</span>
          <span
            className={`console-output__msg${
              msg.level === 'warn'
                ? ' console-output__msg--warn'
                : msg.level === 'error'
                ? ' console-output__msg--error'
                : ''
            }`}
          >
            {msg.message}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Save Revision Modal ──
export function SaveRevisionDialog() {
  const saveModalOpen = useWorkstationStore(s => s.saveModalOpen);
  const setSaveModalOpen = useWorkstationStore(s => s.setSaveModalOpen);
  const saveRevision = useWorkstationStore(s => s.saveRevision);
  const revisions = useWorkstationStore(s => s.revisions);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    if (saveModalOpen) {
      setName(`Configuration Variation ${revisions.length + 1}`);
      setDesc('Modified powertrain and geometry parameters');
    }
  }, [saveModalOpen, revisions.length]);

  if (!saveModalOpen) return null;

  const handleSave = () => {
    if (name.trim()) {
      saveRevision(name.trim(), desc.trim());
    }
  };

  return (
    <div className="save-dialog-overlay" onClick={() => setSaveModalOpen(false)}>
      <div className="save-dialog" onClick={e => e.stopPropagation()}>
        <div className="save-dialog__title">Save Engineering Revision</div>
        <div className="save-dialog__field">
          <div className="save-dialog__label">Revision Title</div>
          <input
            className="save-dialog__input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Aero & Power Package"
            autoFocus
          />
        </div>
        <div className="save-dialog__field">
          <div className="save-dialog__label">Engineering Description</div>
          <input
            className="save-dialog__input"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Detail parameters changed and design rationale"
          />
        </div>
        <div className="save-dialog__actions">
          <button className="save-dialog__btn" onClick={() => setSaveModalOpen(false)}>
            Cancel
          </button>
          <button className="save-dialog__btn save-dialog__btn--primary" onClick={handleSave}>
            Save Revision
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Bottom Panel Component ──
export default function BottomPanel() {
  const showBottomPanel = useWorkstationStore(s => s.showBottomPanel);
  const bottomPanelTab = useWorkstationStore(s => s.bottomPanelTab);
  const bottomPanelHeight = useWorkstationStore(s => s.bottomPanelHeight);
  const setBottomPanelTab = useWorkstationStore(s => s.setBottomPanelTab);
  const setBottomPanelHeight = useWorkstationStore(s => s.setBottomPanelHeight);
  const toggleBottomPanel = useWorkstationStore(s => s.toggleBottomPanel);

  const isResizing = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startY.current = e.clientY;
    startH.current = bottomPanelHeight;
    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startY.current - ev.clientY;
      setBottomPanelHeight(startH.current + delta);
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [bottomPanelHeight, setBottomPanelHeight]);

  if (!showBottomPanel) return null;

  const tabs: Array<{ id: BottomPanelTab; label: string }> = [
    { id: 'simulation', label: 'Simulation' },
    { id: 'powerflow', label: 'Power Flow' },
    { id: 'comparison', label: 'Comparison' },
    { id: 'history', label: 'History' },
    { id: 'optimization', label: 'Optimization' },
    { id: 'console', label: 'Console' },
  ];

  return (
    <div className="panel-bottom" style={{ height: bottomPanelHeight }}>
      <div className="panel-bottom__resize" onMouseDown={handleMouseDown} title="Drag to resize panel" />
      <div className="panel-bottom__tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`panel-bottom__tab${bottomPanelTab === tab.id ? ' panel-bottom__tab--active' : ''}`}
            onClick={() => setBottomPanelTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <div className="panel-bottom__spacer" />
        <button
          className="panel-tree__header-btn"
          onClick={toggleBottomPanel}
          title="Minimize Analysis Panel (Ctrl+J)"
        >
          ✕
        </button>
      </div>

      <div className="panel-bottom__body">
        {bottomPanelTab === 'simulation' && <SimulationTab />}
        {bottomPanelTab === 'powerflow' && <PowerFlowTab />}
        {bottomPanelTab === 'comparison' && <ComparisonTab />}
        {bottomPanelTab === 'history' && <HistoryTab />}
        {bottomPanelTab === 'optimization' && <OptimizationTab />}
        {bottomPanelTab === 'console' && <ConsoleTab />}
      </div>
    </div>
  );
}
