// ============================================================
// Command Palette – Engineering Quick Launcher
// Fast keyboard access to all CAD / CAE Workstation Commands
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useWorkstationStore } from '../store/workstationStore';

interface Command {
  id: string;
  name: string;
  category: string;
  shortcut?: string;
  execute: () => void;
}

export default function CommandPalette() {
  const show = useWorkstationStore(s => s.showCommandPalette);
  const toggle = useWorkstationStore(s => s.toggleCommandPalette);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSimulationAction = useWorkstationStore(s => s.runSimulationAction);
  const resetToBaseline = useWorkstationStore(s => s.resetToBaseline);
  const setRenderMode = useWorkstationStore(s => s.setRenderMode);
  const setCameraPreset = useWorkstationStore(s => s.setCameraPreset);
  const triggerFitCamera = useWorkstationStore(s => s.triggerFitCamera);
  const triggerResetCamera = useWorkstationStore(s => s.triggerResetCamera);
  const setExplodeAmount = useWorkstationStore(s => s.setExplodeAmount);
  const toggleExplode = useWorkstationStore(s => s.toggleExplode);
  const toggleSection = useWorkstationStore(s => s.toggleSection);
  const setAnalysisOverlay = useWorkstationStore(s => s.setAnalysisOverlay);
  const toggleAssemblyTree = useWorkstationStore(s => s.toggleAssemblyTree);
  const togglePropertyInspector = useWorkstationStore(s => s.togglePropertyInspector);
  const toggleBottomPanel = useWorkstationStore(s => s.toggleBottomPanel);
  const setBottomPanelTab = useWorkstationStore(s => s.setBottomPanelTab);
  const showAllNodes = useWorkstationStore(s => s.showAllNodes);
  const hideSelected = useWorkstationStore(s => s.hideSelected);
  const isolateSelected = useWorkstationStore(s => s.isolateSelected);
  const toggleGrid = useWorkstationStore(s => s.toggleGrid);
  const toggleAxes = useWorkstationStore(s => s.toggleAxes);
  const setActiveTool = useWorkstationStore(s => s.setActiveTool);
  const setSaveModalOpen = useWorkstationStore(s => s.setSaveModalOpen);
  const undo = useWorkstationStore(s => s.undo);
  const redo = useWorkstationStore(s => s.redo);

  const commands: Command[] = [
    {
      id: 'tool-measure',
      name: 'Tool: Activate CAD Geometry Measurement',
      category: 'Tools',
      shortcut: 'M',
      execute: () => setActiveTool('measure'),
    },
    {
      id: 'cam-fit',
      name: 'Camera: Fit Complete Model to Viewport',
      category: 'Camera',
      shortcut: 'F',
      execute: triggerFitCamera,
    },
    {
      id: 'cam-reset',
      name: 'Camera: Reset Camera to Default Isometric',
      category: 'Camera',
      shortcut: 'R',
      execute: triggerResetCamera,
    },
    {
      id: 'sim-run',
      name: 'Simulation: Run Full Vehicle Engineering Solver',
      category: 'Simulation',
      shortcut: 'F5',
      execute: () => {
        runSimulationAction();
        setBottomPanelTab('simulation');
      },
    },
    {
      id: 'sim-powerflow',
      name: 'Analysis: View Drivetrain Sankey Power Flow & Losses',
      category: 'Analysis',
      execute: () => {
        setBottomPanelTab('powerflow');
        useWorkstationStore.setState({ showBottomPanel: true });
      },
    },
    {
      id: 'sim-opt',
      name: 'Design: Run Generative Weight / Range Optimization',
      category: 'Design',
      execute: () => {
        setBottomPanelTab('optimization');
        useWorkstationStore.setState({ showBottomPanel: true });
      },
    },
    {
      id: 'sim-compare',
      name: 'Analysis: Compare Configuration vs Baseline',
      category: 'Analysis',
      execute: () => {
        setBottomPanelTab('comparison');
        useWorkstationStore.setState({ showBottomPanel: true });
      },
    },
    {
      id: 'rev-save',
      name: 'Revision: Save Current Configuration Snapshot',
      category: 'Revision',
      shortcut: 'Ctrl+S',
      execute: () => setSaveModalOpen(true),
    },
    {
      id: 'edit-undo',
      name: 'Edit: Undo Parameter Change',
      category: 'Edit',
      shortcut: 'Ctrl+Z',
      execute: undo,
    },
    {
      id: 'edit-redo',
      name: 'Edit: Redo Parameter Change',
      category: 'Edit',
      shortcut: 'Ctrl+Y',
      execute: redo,
    },
    {
      id: 'view-iso',
      name: 'View: Set Isometric Camera Orientation',
      category: 'View',
      shortcut: 'Num 0',
      execute: () => setCameraPreset('isometric'),
    },
    {
      id: 'view-front',
      name: 'View: Set Front Orthogonal View',
      category: 'View',
      shortcut: 'Num 1',
      execute: () => setCameraPreset('front'),
    },
    {
      id: 'view-rear',
      name: 'View: Set Rear Orthogonal View',
      category: 'View',
      shortcut: 'Num 3',
      execute: () => setCameraPreset('rear'),
    },
    {
      id: 'view-left',
      name: 'View: Set Left View',
      category: 'View',
      execute: () => setCameraPreset('left'),
    },
    {
      id: 'view-right',
      name: 'View: Set Right View',
      category: 'View',
      execute: () => setCameraPreset('right'),
    },
    {
      id: 'view-top',
      name: 'View: Set Top Plan View',
      category: 'View',
      shortcut: 'Num 7',
      execute: () => setCameraPreset('top'),
    },
    {
      id: 'shade-solid',
      name: 'Shading: Solid Realistic PBR Shaded Mode',
      category: 'Rendering',
      execute: () => setRenderMode('solid'),
    },
    {
      id: 'shade-wire',
      name: 'Shading: Wireframe CAD Mesh Display',
      category: 'Rendering',
      execute: () => setRenderMode('wireframe'),
    },
    {
      id: 'shade-xray',
      name: 'Shading: X-Ray Internal Packaging Transparency',
      category: 'Rendering',
      execute: () => setRenderMode('xray'),
    },
    {
      id: 'cae-thermal',
      name: 'CAE: Thermal Gradient Surface Heatmap Overlay',
      category: 'CAE',
      execute: () => setAnalysisOverlay('thermal'),
    },
    {
      id: 'cae-stress',
      name: 'CAE: Von Mises Finite Element Stress Distribution',
      category: 'CAE',
      execute: () => setAnalysisOverlay('stress'),
    },
    {
      id: 'cae-eff',
      name: 'CAE: Subsystem Energy Efficiency Mapping',
      category: 'CAE',
      execute: () => setAnalysisOverlay('efficiency'),
    },
    {
      id: 'cae-none',
      name: 'CAE: Clear All Analysis Overlays',
      category: 'CAE',
      execute: () => setAnalysisOverlay('none'),
    },
    {
      id: 'asm-explode-toggle',
      name: 'Assembly: Toggle Exploded View (0% <-> 100%)',
      category: 'Assembly',
      shortcut: 'E',
      execute: toggleExplode,
    },
    {
      id: 'asm-explode-100',
      name: 'Assembly: Explode Subsystems to 100%',
      category: 'Assembly',
      execute: () => setExplodeAmount(1.0),
    },
    {
      id: 'asm-explode-0',
      name: 'Assembly: Collapse Assembly to 0% (Nominal)',
      category: 'Assembly',
      execute: () => setExplodeAmount(0.0),
    },
    {
      id: 'asm-section',
      name: 'Assembly: Toggle Cutting Cross-Section Plane',
      category: 'Assembly',
      shortcut: 'S',
      execute: toggleSection,
    },
    {
      id: 'asm-hide',
      name: 'Assembly: Hide Selected Component',
      category: 'Assembly',
      shortcut: 'H',
      execute: hideSelected,
    },
    {
      id: 'asm-isolate',
      name: 'Assembly: Isolate Selected Component',
      category: 'Assembly',
      shortcut: 'I',
      execute: isolateSelected,
    },
    {
      id: 'asm-showall',
      name: 'Assembly: Unhide All Components (Show All)',
      category: 'Assembly',
      execute: showAllNodes,
    },
    {
      id: 'asm-reset',
      name: 'Model: Revert All Parameters to Engineering Baseline',
      category: 'Model',
      execute: resetToBaseline,
    },
    {
      id: 'ui-tree',
      name: 'Workspace: Toggle Assembly Model Tree Panel',
      category: 'UI',
      shortcut: 'Ctrl+B',
      execute: toggleAssemblyTree,
    },
    {
      id: 'ui-props',
      name: 'Workspace: Toggle Property Inspector Panel',
      category: 'UI',
      shortcut: 'Ctrl+I',
      execute: togglePropertyInspector,
    },
    {
      id: 'ui-panel',
      name: 'Workspace: Toggle Engineering Results Panel',
      category: 'UI',
      shortcut: 'Ctrl+J',
      execute: toggleBottomPanel,
    },
    {
      id: 'view-grid',
      name: 'View: Toggle Reference Ground Plane Grid',
      category: 'View',
      shortcut: 'G',
      execute: toggleGrid,
    },
    {
      id: 'view-axes',
      name: 'View: Toggle Triad Coordinate Axes (XYZ)',
      category: 'View',
      execute: toggleAxes,
    },
  ];

  const filtered = commands.filter(
    c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (show) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].execute();
        toggle();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      toggle();
    }
  };

  if (!show) return null;

  return (
    <div className="command-palette-overlay" onClick={toggle}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="command-palette__input"
          placeholder="Search engineering actions, CAD tools, CAE modes..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="command-palette__list">
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>
              No matching CAD/CAE commands found.
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                className={`command-palette__item${i === selectedIndex ? ' command-palette__item--active' : ''}`}
                style={{
                  background: i === selectedIndex ? 'var(--bg-hover)' : 'transparent',
                  color: i === selectedIndex ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
                onClick={() => {
                  cmd.execute();
                  toggle();
                }}
              >
                <span>{cmd.name}</span>
                {cmd.shortcut && (
                  <span className="command-palette__item-shortcut">{cmd.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
