// ============================================================
// KPIT Vehicle Digital Twin Engineering Workstation
// Main Application Shell
// ============================================================

import React, { useEffect } from 'react';
import MenuBar from './components/MenuBar';
import Toolbar from './components/Toolbar';
import AssemblyTree from './components/AssemblyTree';
import Viewport3D from './components/Viewport3D';
import PropertyInspector from './components/PropertyInspector';
import BottomPanel from './components/BottomPanel';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import { useWorkstationStore } from './store/workstationStore';

export default function App() {
  const showAssemblyTree = useWorkstationStore(s => s.showAssemblyTree);
  const showPropertyInspector = useWorkstationStore(s => s.showPropertyInspector);
  const showBottomPanel = useWorkstationStore(s => s.showBottomPanel);
  const toggleCommandPalette = useWorkstationStore(s => s.toggleCommandPalette);
  const toggleAssemblyTree = useWorkstationStore(s => s.toggleAssemblyTree);
  const togglePropertyInspector = useWorkstationStore(s => s.togglePropertyInspector);
  const toggleBottomPanel = useWorkstationStore(s => s.toggleBottomPanel);
  const runSimulationAction = useWorkstationStore(s => s.runSimulationAction);
  const selectNode = useWorkstationStore(s => s.selectNode);

  // Global hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette: Ctrl+K or Ctrl+P
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'p')) {
        e.preventDefault();
        toggleCommandPalette();
      }
      // Toggle Assembly Tree: Ctrl+B
      else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleAssemblyTree();
      }
      // Toggle Property Inspector: Ctrl+I
      else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        togglePropertyInspector();
      }
      // Toggle Bottom Panel: Ctrl+J
      else if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        toggleBottomPanel();
      }
      // Run Simulation: F5 or Ctrl+Enter
      else if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
        e.preventDefault();
        runSimulationAction();
      }
      // Deselect on Escape
      else if (e.key === 'Escape') {
        selectNode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    toggleCommandPalette,
    toggleAssemblyTree,
    togglePropertyInspector,
    toggleBottomPanel,
    runSimulationAction,
    selectNode,
  ]);

  return (
    <div className="app-shell">
      {/* CAD Menu Bar */}
      <MenuBar />

      {/* CAD Toolbar */}
      <Toolbar />

      {/* Main Workspace (Assembly Tree, 3D Canvas, Property Inspector) */}
      <div className="workspace">
        {showAssemblyTree && (
          <div className="panel-tree">
            <div className="panel-tree__header">
              <span>Assembly Structure</span>
              <div className="panel-tree__header-actions">
                <button
                  className="panel-tree__header-btn"
                  onClick={toggleAssemblyTree}
                  title="Collapse Tree Panel"
                >
                  ◀
                </button>
              </div>
            </div>
            <div className="panel-tree__body">
              <AssemblyTree />
            </div>
          </div>
        )}

        {/* 3D Vehicle Viewport */}
        <div className="viewport-container">
          <Viewport3D />
        </div>

        {/* Property Inspector */}
        {showPropertyInspector && (
          <div className="panel-props">
            <div className="panel-props__header">
              <span>Property Inspector</span>
              <button
                className="panel-tree__header-btn"
                style={{ marginLeft: 'auto' }}
                onClick={togglePropertyInspector}
                title="Collapse Inspector Panel"
              >
                ▶
              </button>
            </div>
            <div className="panel-props__body">
              <PropertyInspector />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Engineering Analysis & Simulation Panel */}
      {showBottomPanel && <BottomPanel />}

      {/* Bottom Workstation Status Bar */}
      <StatusBar />

      {/* Command Palette Modal */}
      <CommandPalette />
    </div>
  );
}
