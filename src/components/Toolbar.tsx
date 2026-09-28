// ============================================================
// Engineering CAD Toolbar – Interactive Digital Twin Controls
// Every control is connected to real workstation state
// ============================================================

import React from 'react';
import {
  useWorkstationStore,
  ActiveTool,
  RenderMode,
  CameraPreset,
  AnalysisOverlay,
} from '../store/workstationStore';

export default function Toolbar() {
  const activeTool = useWorkstationStore(s => s.activeTool);
  const setActiveTool = useWorkstationStore(s => s.setActiveTool);

  const renderMode = useWorkstationStore(s => s.renderMode);
  const setRenderMode = useWorkstationStore(s => s.setRenderMode);

  const viewMode = useWorkstationStore(s => s.viewMode);
  const toggleViewMode = useWorkstationStore(s => s.toggleViewMode);

  const cameraPreset = useWorkstationStore(s => s.cameraPreset);
  const setCameraPreset = useWorkstationStore(s => s.setCameraPreset);
  const triggerFitCamera = useWorkstationStore(s => s.triggerFitCamera);
  const triggerResetCamera = useWorkstationStore(s => s.triggerResetCamera);

  const explodeAmount = useWorkstationStore(s => s.explodeAmount);
  const setExplodeAmount = useWorkstationStore(s => s.setExplodeAmount);
  const toggleExplode = useWorkstationStore(s => s.toggleExplode);

  const sectionEnabled = useWorkstationStore(s => s.sectionEnabled);
  const toggleSection = useWorkstationStore(s => s.toggleSection);
  const sectionAxis = useWorkstationStore(s => s.sectionAxis);
  const setSectionAxis = useWorkstationStore(s => s.setSectionAxis);
  const sectionPosition = useWorkstationStore(s => s.sectionPosition);
  const setSectionPosition = useWorkstationStore(s => s.setSectionPosition);

  const showGrid = useWorkstationStore(s => s.showGrid);
  const toggleGrid = useWorkstationStore(s => s.toggleGrid);
  const showAxes = useWorkstationStore(s => s.showAxes);
  const toggleAxes = useWorkstationStore(s => s.toggleAxes);

  const hideSelected = useWorkstationStore(s => s.hideSelected);
  const isolateSelected = useWorkstationStore(s => s.isolateSelected);
  const restoreAll = useWorkstationStore(s => s.restoreAll);
  const selectedNodeId = useWorkstationStore(s => s.selectedNodeId);

  const undo = useWorkstationStore(s => s.undo);
  const redo = useWorkstationStore(s => s.redo);
  const canUndo = useWorkstationStore(s => s.canUndo());
  const canRedo = useWorkstationStore(s => s.canRedo());

  const analysisOverlay = useWorkstationStore(s => s.analysisOverlay);
  const setAnalysisOverlay = useWorkstationStore(s => s.setAnalysisOverlay);

  const simulationStatus = useWorkstationStore(s => s.simulationStatus);
  const runSimulationAction = useWorkstationStore(s => s.runSimulationAction);
  const setSaveModalOpen = useWorkstationStore(s => s.setSaveModalOpen);

  const tools: { id: ActiveTool; label: string; icon: string; title: string }[] = [
    { id: 'select', label: 'Select', icon: '↖', title: 'Select Component (S)' },
    { id: 'orbit', label: 'Orbit', icon: '⟳', title: 'Orbit View (O)' },
    { id: 'pan', label: 'Pan', icon: '✥', title: 'Pan View (P)' },
    { id: 'zoom', label: 'Zoom', icon: '🔍', title: 'Zoom View (Z)' },
    { id: 'measure', label: 'Measure', icon: '📏', title: 'Measure Distance Between Points (M)' },
  ];

  const presets: { id: CameraPreset; label: string; title: string }[] = [
    { id: 'isometric', label: 'ISO', title: 'Isometric View (Num 0)' },
    { id: 'front', label: 'FRT', title: 'Front Orthogonal View (Num 1)' },
    { id: 'rear', label: 'RR', title: 'Rear Orthogonal View (Num 3)' },
    { id: 'left', label: 'LFT', title: 'Left Orthogonal View' },
    { id: 'right', label: 'RGT', title: 'Right Orthogonal View' },
    { id: 'top', label: 'TOP', title: 'Top Plan View (Num 7)' },
  ];

  return (
    <div className="toolbar" role="toolbar" aria-label="Engineering Workstation CAD Toolbar">
      {/* ── Undo / Redo ── */}
      <div className="toolbar__group">
        <button
          className="toolbar__btn"
          onClick={undo}
          disabled={!canUndo}
          style={{ opacity: canUndo ? 1 : 0.4 }}
          title={canUndo ? 'Undo parameter change (Ctrl+Z)' : 'Nothing to undo'}
        >
          ↶
        </button>
        <button
          className="toolbar__btn"
          onClick={redo}
          disabled={!canRedo}
          style={{ opacity: canRedo ? 1 : 0.4 }}
          title={canRedo ? 'Redo parameter change (Ctrl+Y)' : 'Nothing to redo'}
        >
          ↷
        </button>
      </div>

      <div className="toolbar__sep" />

      {/* ── Transformation & Selection Tools ── */}
      <div className="toolbar__group">
        {tools.map(t => (
          <button
            key={t.id}
            className={`toolbar__btn${activeTool === t.id ? ' toolbar__btn--active' : ''}`}
            onClick={() => setActiveTool(t.id)}
            title={t.title}
          >
            <span style={{ fontSize: 13, fontWeight: 'bold' }}>{t.icon}</span>
          </button>
        ))}
      </div>

      <div className="toolbar__sep" />

      {/* ── Camera Fit & Reset ── */}
      <div className="toolbar__group">
        <button
          className="toolbar__btn"
          onClick={triggerFitCamera}
          title="Fit Complete Vehicle Model to Viewport (F)"
          style={{ fontSize: 11, fontWeight: 'bold' }}
        >
          FIT
        </button>
        <button
          className="toolbar__btn"
          onClick={triggerResetCamera}
          title="Reset Camera to Default View (R)"
          style={{ fontSize: 11, fontWeight: 'bold' }}
        >
          RST
        </button>
        <button
          className={`toolbar__view-btn${viewMode === 'orthographic' ? ' toolbar__view-btn--active' : ''}`}
          onClick={toggleViewMode}
          title="Toggle Perspective / Orthographic Projection"
        >
          {viewMode === 'perspective' ? 'PERSP' : 'ORTHO'}
        </button>
      </div>

      <div className="toolbar__sep" />

      {/* ── Camera Viewpoints ── */}
      <div className="toolbar__group">
        {presets.map(p => (
          <button
            key={p.id}
            className={`toolbar__view-btn${cameraPreset === p.id ? ' toolbar__view-btn--active' : ''}`}
            onClick={() => setCameraPreset(p.id)}
            title={p.title}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="toolbar__sep" />

      {/* ── Component Visibility (Hide / Isolate / Show All) ── */}
      <div className="toolbar__group">
        <button
          className="toolbar__btn"
          onClick={hideSelected}
          disabled={!selectedNodeId}
          style={{ opacity: selectedNodeId ? 1 : 0.4, fontSize: 11 }}
          title={selectedNodeId ? 'Hide Selected Component (H)' : 'Select a component to hide'}
        >
          HIDE
        </button>
        <button
          className="toolbar__btn"
          onClick={isolateSelected}
          disabled={!selectedNodeId}
          style={{ opacity: selectedNodeId ? 1 : 0.4, fontSize: 11 }}
          title={selectedNodeId ? 'Isolate Selected Component (I)' : 'Select a component to isolate'}
        >
          ISO-P
        </button>
        <button
          className="toolbar__btn"
          onClick={restoreAll}
          title="Restore All Components to Visible"
          style={{ fontSize: 11 }}
        >
          ALL
        </button>
      </div>

      <div className="toolbar__sep" />

      {/* ── Shading Modes ── */}
      <div className="toolbar__group">
        {(['solid', 'wireframe', 'xray'] as RenderMode[]).map(m => (
          <button
            key={m}
            className={`toolbar__view-btn${renderMode === m ? ' toolbar__view-btn--active' : ''}`}
            onClick={() => setRenderMode(m)}
            title={`Switch to ${m.toUpperCase()} rendering mode`}
          >
            {m === 'solid' ? 'Solid' : m === 'wireframe' ? 'Wire' : 'X-Ray'}
          </button>
        ))}
      </div>

      <div className="toolbar__sep" />

      {/* ── Exploded Assembly View ── */}
      <div className="toolbar__slider-group">
        <button
          className={`toolbar__view-btn${explodeAmount > 0.05 ? ' toolbar__view-btn--active' : ''}`}
          onClick={toggleExplode}
          title="Toggle Exploded Assembly View (E)"
        >
          Explode
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          className="toolbar__slider"
          value={explodeAmount}
          onChange={e => setExplodeAmount(parseFloat(e.target.value))}
          title="Adjust component explosion separation (0% - 100%)"
        />
        <span className="toolbar__slider-val">{Math.round(explodeAmount * 100)}%</span>
      </div>

      <div className="toolbar__sep" />

      {/* ── Real Section Plane View ── */}
      <div className="toolbar__group">
        <button
          className={`toolbar__view-btn${sectionEnabled ? ' toolbar__view-btn--active' : ''}`}
          onClick={toggleSection}
          title="Toggle Cutting Cross-Section Plane"
        >
          Section {sectionEnabled ? 'ON' : 'OFF'}
        </button>
        {sectionEnabled && (
          <div className="section-controls" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {(['x', 'y', 'z'] as const).map(axis => (
              <button
                key={axis}
                className={`section-axis-btn${sectionAxis === axis ? ' section-axis-btn--active' : ''}`}
                onClick={() => setSectionAxis(axis)}
                title={`Slice along ${axis.toUpperCase()} axis`}
              >
                {axis.toUpperCase()}
              </button>
            ))}
            <input
              type="range"
              min="-1"
              max="1"
              step="0.02"
              className="toolbar__slider"
              style={{ width: 55 }}
              value={sectionPosition}
              onChange={e => setSectionPosition(parseFloat(e.target.value))}
              title="Adjust cross-section plane position"
            />
          </div>
        )}
      </div>

      <div className="toolbar__sep" />

      {/* ── CAE Analysis Overlays ── */}
      <div className="toolbar__group">
        <span className="toolbar__label">CAE</span>
        {(['none', 'thermal', 'stress', 'efficiency'] as AnalysisOverlay[]).map(mode => (
          <button
            key={mode}
            className={`toolbar__view-btn${analysisOverlay === mode ? ' toolbar__view-btn--active' : ''}`}
            onClick={() => setAnalysisOverlay(mode)}
            title={`Enable ${mode} finite element / physics overlay`}
          >
            {mode === 'none' ? 'Off' : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      <div className="toolbar__sep" />

      {/* ── Grid & Axes Toggles ── */}
      <div className="toolbar__group">
        <button
          className={`toolbar__btn${showGrid ? ' toolbar__btn--active' : ''}`}
          onClick={toggleGrid}
          title="Toggle Datum Ground Grid (G)"
        >
          #
        </button>
        <button
          className={`toolbar__btn${showAxes ? ' toolbar__btn--active' : ''}`}
          onClick={toggleAxes}
          title="Toggle Coordinate Triad Axes (XYZ)"
        >
          XYZ
        </button>
      </div>

      <div className="toolbar__spacer" />

      {/* ── Save Revision & Quick Solver Trigger ── */}
      <div className="toolbar__group" style={{ gap: 6 }}>
        <button
          className="toolbar__view-btn"
          style={{ height: 26, fontSize: 11, padding: '0 8px' }}
          onClick={() => setSaveModalOpen(true)}
          title="Save Current Vehicle Configuration Revision"
        >
          💾 SAVE REV
        </button>

        <button
          className="sim-panel__run-btn"
          style={{
            height: 26,
            padding: '0 12px',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          onClick={runSimulationAction}
          disabled={simulationStatus === 'running' || simulationStatus === 'preparing'}
          title="Execute Multiphysics Vehicle Solver (F5 / Ctrl+Enter)"
        >
          <span>{simulationStatus === 'running' ? '⏳' : '▶'}</span>
          <span>{simulationStatus === 'running' ? 'SOLVING...' : 'RUN SOLVER'}</span>
        </button>
      </div>
    </div>
  );
}
