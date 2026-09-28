// ============================================================
// Menu Bar – Engineering CAD Application Menu
// Fully connected engineering menus with functional actions
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkstationStore } from '../store/workstationStore';

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const resetToBaseline = useWorkstationStore(s => s.resetToBaseline);
  const toggleAssemblyTree = useWorkstationStore(s => s.toggleAssemblyTree);
  const togglePropertyInspector = useWorkstationStore(s => s.togglePropertyInspector);
  const toggleBottomPanel = useWorkstationStore(s => s.toggleBottomPanel);
  const setBottomPanelTab = useWorkstationStore(s => s.setBottomPanelTab);
  const toggleGrid = useWorkstationStore(s => s.toggleGrid);
  const toggleAxes = useWorkstationStore(s => s.toggleAxes);
  const setRenderMode = useWorkstationStore(s => s.setRenderMode);
  const toggleSection = useWorkstationStore(s => s.toggleSection);
  const toggleExplode = useWorkstationStore(s => s.toggleExplode);
  const showAllNodes = useWorkstationStore(s => s.showAllNodes);
  const hideSelected = useWorkstationStore(s => s.hideSelected);
  const isolateSelected = useWorkstationStore(s => s.isolateSelected);
  const selectNode = useWorkstationStore(s => s.selectNode);
  const runSim = useWorkstationStore(s => s.runSimulationAction);
  const toggleCommandPalette = useWorkstationStore(s => s.toggleCommandPalette);
  const setAnalysisOverlay = useWorkstationStore(s => s.setAnalysisOverlay);
  const setViewMode = useWorkstationStore(s => s.setViewMode);
  const setCameraPreset = useWorkstationStore(s => s.setCameraPreset);
  const triggerFitCamera = useWorkstationStore(s => s.triggerFitCamera);
  const triggerResetCamera = useWorkstationStore(s => s.triggerResetCamera);
  const setActiveTool = useWorkstationStore(s => s.setActiveTool);
  const setSaveModalOpen = useWorkstationStore(s => s.setSaveModalOpen);
  const undo = useWorkstationStore(s => s.undo);
  const redo = useWorkstationStore(s => s.redo);
  const canUndo = useWorkstationStore(s => s.canUndo());
  const canRedo = useWorkstationStore(s => s.canRedo());
  const assembly = useWorkstationStore(s => s.assembly);
  const currentResults = useWorkstationStore(s => s.currentResults);

  // Export results as downloadable JSON report
  const handleExportResults = useCallback(() => {
    const reportData = {
      title: 'KPIT Vehicle Digital Twin Engineering Report',
      timestamp: new Date().toISOString(),
      assemblySummary: {
        id: assembly.id,
        name: assembly.name,
      },
      results: currentResults,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KPIT-DigitalTwin-Report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [assembly, currentResults]);

  const menus: MenuGroup[] = [
    {
      label: 'File',
      items: [
        { label: 'Save Revision...', shortcut: 'Ctrl+S', action: () => setSaveModalOpen(true) },
        { label: 'Export Telemetry & Results JSON', action: handleExportResults },
        { separator: true, label: '' },
        { label: 'Revert to Factory Baseline', action: resetToBaseline },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo Parameter Change', shortcut: 'Ctrl+Z', action: undo, disabled: !canUndo },
        { label: 'Redo Parameter Change', shortcut: 'Ctrl+Y', action: redo, disabled: !canRedo },
        { separator: true, label: '' },
        { label: 'Deselect Entity', shortcut: 'Esc', action: () => selectNode(null) },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Fit Model to Viewport', shortcut: 'F', action: triggerFitCamera },
        { label: 'Reset Camera View', shortcut: 'R', action: triggerResetCamera },
        { separator: true, label: '' },
        { label: 'Assembly Model Tree', shortcut: 'Ctrl+B', action: toggleAssemblyTree },
        { label: 'Property Inspector', shortcut: 'Ctrl+I', action: togglePropertyInspector },
        { label: 'Engineering Results Panel', shortcut: 'Ctrl+J', action: toggleBottomPanel },
        { separator: true, label: '' },
        { label: 'Datum Ground Grid', shortcut: 'G', action: toggleGrid },
        { label: 'Coordinate Triad Axes', action: toggleAxes },
        { separator: true, label: '' },
        { label: 'Perspective Projection', action: () => setViewMode('perspective') },
        { label: 'Orthographic Projection', action: () => setViewMode('orthographic') },
        { separator: true, label: '' },
        { label: 'Shading: Solid PBR', action: () => setRenderMode('solid') },
        { label: 'Shading: CAD Wireframe', action: () => setRenderMode('wireframe') },
        { label: 'Shading: X-Ray Translucent', action: () => setRenderMode('xray') },
        { separator: true, label: '' },
        { label: 'Isometric View', shortcut: 'Num 0', action: () => setCameraPreset('isometric') },
        { label: 'Front Orthogonal View', shortcut: 'Num 1', action: () => setCameraPreset('front') },
        { label: 'Rear Orthogonal View', shortcut: 'Num 3', action: () => setCameraPreset('rear') },
        { label: 'Left View', action: () => setCameraPreset('left') },
        { label: 'Right View', action: () => setCameraPreset('right') },
        { label: 'Top Plan View', shortcut: 'Num 7', action: () => setCameraPreset('top') },
        { label: 'Bottom View', action: () => setCameraPreset('bottom') },
      ],
    },
    {
      label: 'Model',
      items: [
        { label: 'Hide Selected Component', shortcut: 'H', action: hideSelected },
        { label: 'Isolate Selected Component', shortcut: 'I', action: isolateSelected },
        { label: 'Show All Components', action: showAllNodes },
        { separator: true, label: '' },
        { label: 'Toggle Exploded Assembly', shortcut: 'E', action: toggleExplode },
        { label: 'Toggle Cross-Section Cut', shortcut: 'S', action: toggleSection },
      ],
    },
    {
      label: 'Simulation',
      items: [
        { label: 'Run Full Multiphysics Solver', shortcut: 'F5', action: runSim },
        { separator: true, label: '' },
        {
          label: 'View Drivetrain Power Flow',
          action: () => {
            setBottomPanelTab('powerflow');
            useWorkstationStore.setState({ showBottomPanel: true });
          },
        },
        {
          label: 'Compare Configurations',
          action: () => {
            setBottomPanelTab('comparison');
            useWorkstationStore.setState({ showBottomPanel: true });
          },
        },
        {
          label: 'Generative Design Optimization',
          action: () => {
            setBottomPanelTab('optimization');
            useWorkstationStore.setState({ showBottomPanel: true });
          },
        },
      ],
    },
    {
      label: 'Analysis',
      items: [
        { label: 'Clear CAE Overlays', action: () => setAnalysisOverlay('none') },
        { label: 'Thermal Gradient Surface Heatmap', action: () => setAnalysisOverlay('thermal') },
        { label: 'Von Mises Finite Element Stress', action: () => setAnalysisOverlay('stress') },
        { label: 'Subsystem Energy Efficiency Mapping', action: () => setAnalysisOverlay('efficiency') },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Engineering Command Palette...', shortcut: 'Ctrl+P', action: toggleCommandPalette },
        { label: 'Distance Measurement Tool', shortcut: 'M', action: () => setActiveTool('measure') },
        { separator: true, label: '' },
        {
          label: 'Solver Execution Console',
          action: () => {
            setBottomPanelTab('console');
            useWorkstationStore.setState({ showBottomPanel: true });
          },
        },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts & CAD Guide', shortcut: 'F1', action: () => setShowHelpModal(true) },
        {
          label: 'About KPIT Digital Twin Workstation',
          action: () =>
            alert(
              'KPIT Vehicle Digital Twin Engineering Workstation v2.4\nProfessional CAD/CAE Parametric Modeling Environment\nEquipped with 3D Vehicle Assembly, Deterministic Multi-Physics Solver, and Drivetrain Energy Analytics.'
            ),
        },
      ],
    },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuItemClick = useCallback((item: MenuItem) => {
    if (item.disabled) return;
    if (item.action) item.action();
    setOpenMenu(null);
  }, []);

  return (
    <div className="menu-bar" ref={menuRef}>
      <div className="menu-bar__brand" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 14, height: 14, color: 'var(--accent-blue)' }}>
          <path d="M8 1L2 5v6l6 4 6-4V5L8 1zm0 2l4 2.5v5L8 13l-4-2.5v-5L8 3z" />
        </svg>
        <span style={{ fontWeight: 700, letterSpacing: '0.8px', color: '#fff' }}>KPIT</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'normal' }}>TWIN</span>
      </div>

      {menus.map(menu => (
        <div key={menu.label} style={{ position: 'relative' }}>
          <div
            className="menu-bar__item"
            onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
          >
            {menu.label}
          </div>
          {openMenu === menu.label && (
            <div className="context-menu" style={{ top: '100%', left: 0, minWidth: 230, zIndex: 1000 }}>
              {menu.items.map((item, i) =>
                item.separator ? (
                  <div key={i} className="context-menu__sep" />
                ) : (
                  <div
                    key={i}
                    className="context-menu__item"
                    style={{
                      opacity: item.disabled ? 0.35 : 1,
                      cursor: item.disabled ? 'not-allowed' : 'pointer',
                    }}
                    onClick={() => handleMenuItemClick(item)}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <span className="context-menu__item-shortcut">{item.shortcut}</span>}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}

      <div className="menu-bar__spacer" />
      <div className="menu-bar__status">
        KPIT Twin · Professional CAD/CAE Modeling Workspace
      </div>

      {/* Help / Keyboard Shortcuts Modal */}
      {showHelpModal && (
        <div className="save-dialog-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="save-dialog" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div className="save-dialog__title">Engineering Workstation Navigation & Shortcuts</div>
            <div style={{ maxHeight: 340, overflowY: 'auto', fontSize: 12 }}>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>CAD Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><kbd>Left Click</kbd></td><td>Select component in 3D viewport</td></tr>
                  <tr><td><kbd>Right Click</kbd></td><td>Component Engineering Context Menu</td></tr>
                  <tr><td><kbd>Left Drag</kbd></td><td>Orbit camera view</td></tr>
                  <tr><td><kbd>Right Drag / Shift+Left</kbd></td><td>Pan camera</td></tr>
                  <tr><td><kbd>Scroll Wheel</kbd></td><td>Zoom in / out</td></tr>
                  <tr><td><kbd>F</kbd></td><td>Fit entire vehicle model to viewport</td></tr>
                  <tr><td><kbd>R</kbd></td><td>Reset camera to default isometric orientation</td></tr>
                  <tr><td><kbd>M</kbd></td><td>CAD Geometry Distance Measurement Tool</td></tr>
                  <tr><td><kbd>E</kbd></td><td>Toggle Exploded Assembly View</td></tr>
                  <tr><td><kbd>H</kbd></td><td>Hide selected component</td></tr>
                  <tr><td><kbd>I</kbd></td><td>Isolate selected component</td></tr>
                  <tr><td><kbd>S</kbd></td><td>Toggle Cross-Section Cutting Plane</td></tr>
                  <tr><td><kbd>G</kbd></td><td>Toggle Datum Ground Plane Grid</td></tr>
                  <tr><td><kbd>F5 / Ctrl+Enter</kbd></td><td>Run Multi-Physics Simulation Solver</td></tr>
                  <tr><td><kbd>Ctrl+Z / Ctrl+Y</kbd></td><td>Undo / Redo parameter changes</td></tr>
                  <tr><td><kbd>Ctrl+K / Ctrl+P</kbd></td><td>Quick Engineering Command Palette</td></tr>
                  <tr><td><kbd>Esc</kbd></td><td>Deselect entity or cancel active tool</td></tr>
                </tbody>
              </table>
            </div>
            <div className="save-dialog__actions">
              <button className="save-dialog__btn save-dialog__btn--primary" onClick={() => setShowHelpModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
