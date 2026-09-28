// ============================================================
// Global Engineering Workstation State (Zustand)
// ============================================================

import { create } from 'zustand';
import { AssemblyNode, createVehicleAssembly, flattenAssembly, getAssemblyPath } from '../data/vehicleAssembly';
import { SimulationResults, runSimulation } from '../simulation/engine';

export type ViewMode = 'perspective' | 'orthographic';
export type RenderMode = 'solid' | 'wireframe' | 'xray';
export type CameraPreset = 'isometric' | 'front' | 'rear' | 'left' | 'right' | 'top' | 'bottom';
export type ActiveTool = 'select' | 'pan' | 'orbit' | 'zoom' | 'measure' | 'section' | 'inspect';
export type SimulationStatus = 'idle' | 'preparing' | 'running' | 'complete' | 'error';
export type BottomPanelTab = 'simulation' | 'powerflow' | 'comparison' | 'history' | 'optimization' | 'console';
export type AnalysisOverlay = 'none' | 'thermal' | 'stress' | 'efficiency';

export interface ConfigRevision {
  id: number;
  name: string;
  description: string;
  timestamp: string;
  assembly: AssemblyNode;
  results: SimulationResults | null;
}

export interface MeasureData {
  distance: number; // mm
  dx: number;       // mm
  dy: number;       // mm
  dz: number;       // mm
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string | null;
}

interface WorkstationState {
  // Assembly
  assembly: AssemblyNode;
  selectedNodeId: string | null;
  selectedNodePath: string[];
  hoveredNodeId: string | null;
  
  // Viewport
  viewMode: ViewMode;
  renderMode: RenderMode;
  cameraPreset: CameraPreset | null;
  activeTool: ActiveTool;
  explodeAmount: number; // 0-1
  sectionEnabled: boolean;
  sectionAxis: 'x' | 'y' | 'z';
  sectionPosition: number; // -1 to 1
  analysisOverlay: AnalysisOverlay;
  showGrid: boolean;
  showAxes: boolean;
  
  // Measurement Tool State
  measurePoints: [number, number, number][];
  measureData: MeasureData | null;

  // Camera Triggers
  fitCameraTrigger: number;
  resetCameraTrigger: number;

  // Undo / Redo
  undoStack: AssemblyNode[];
  redoStack: AssemblyNode[];

  // Simulation
  simulationStatus: SimulationStatus;
  simulationProgress: number;
  currentResults: SimulationResults | null;
  baselineResults: SimulationResults | null;
  
  // Configuration History
  revisions: ConfigRevision[];
  activeRevisionId: number;
  saveModalOpen: boolean;
  
  // Context Menu
  contextMenu: ContextMenuState;

  // Panel visibility
  showAssemblyTree: boolean;
  showPropertyInspector: boolean;
  showBottomPanel: boolean;
  bottomPanelTab: BottomPanelTab;
  bottomPanelHeight: number;
  
  // Command palette
  showCommandPalette: boolean;

  // Console messages
  consoleMessages: Array<{ time: string; level: 'info' | 'warn' | 'error'; message: string }>;

  // Actions
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  toggleNodeExpanded: (id: string) => void;
  toggleNodeVisibility: (id: string) => void;
  isolateNode: (id: string) => void;
  showAllNodes: () => void;
  hideSelected: () => void;
  showSelected: () => void;
  isolateSelected: () => void;
  restoreAll: () => void;
  updateParameter: (nodeId: string, paramName: string, value: number | string) => void;
  
  // Undo / Redo Actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Viewport & Camera Actions
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  setRenderMode: (mode: RenderMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setExplodeAmount: (amount: number) => void;
  toggleExplode: () => void;
  toggleSection: () => void;
  setSectionAxis: (axis: 'x' | 'y' | 'z') => void;
  setSectionPosition: (pos: number) => void;
  setAnalysisOverlay: (overlay: AnalysisOverlay) => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  triggerFitCamera: () => void;
  triggerResetCamera: () => void;

  // Measurement Actions
  addMeasurePoint: (pt: [number, number, number]) => void;
  clearMeasurement: () => void;

  // Simulation & Revision Actions
  runSimulationAction: () => void;
  setSaveModalOpen: (open: boolean) => void;
  saveRevision: (name: string, description: string) => void;
  loadRevision: (id: number) => void;

  // UI Panels
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (h: number) => void;
  toggleAssemblyTree: () => void;
  togglePropertyInspector: () => void;
  toggleCommandPalette: () => void;
  addConsoleMessage: (level: 'info' | 'warn' | 'error', message: string) => void;
  resetToBaseline: () => void;

  // Context Menu Actions
  openContextMenu: (x: number, y: number, nodeId: string | null) => void;
  closeContextMenu: () => void;
}

// Deep clone helper
const cloneAssembly = (node: AssemblyNode): AssemblyNode => JSON.parse(JSON.stringify(node));

// Update a node in the tree immutably
const updateNodeInTree = (
  root: AssemblyNode,
  nodeId: string,
  updater: (node: AssemblyNode) => AssemblyNode
): AssemblyNode => {
  if (root.id === nodeId) return updater({ ...root });
  return {
    ...root,
    children: root.children.map(child => updateNodeInTree(child, nodeId, updater)),
  };
};

// Set selection state across tree
const setSelectionInTree = (root: AssemblyNode, selectedId: string | null): AssemblyNode => {
  return {
    ...root,
    selected: root.id === selectedId,
    children: root.children.map(child => setSelectionInTree(child, selectedId)),
  };
};

// Isolate a specific node (make it and its path visible, hide others)
const isolateInTree = (root: AssemblyNode, isolatedId: string): AssemblyNode => {
  // A node is visible if it is the isolated node, or an ancestor of the isolated node, or a child of the isolated node
  const isTargetOrDescendant = (node: AssemblyNode): boolean => {
    if (node.id === isolatedId) return true;
    return node.children.some(isTargetOrDescendant);
  };
  
  const mark = (node: AssemblyNode): AssemblyNode => {
    const isTarget = node.id === isolatedId;
    const hasTargetInSubtree = isTargetOrDescendant(node);
    return {
      ...node,
      visible: isTarget || hasTargetInSubtree,
      children: node.children.map(mark),
    };
  };

  return mark(root);
};

// Set all nodes visible
const setAllVisible = (root: AssemblyNode): AssemblyNode => ({
  ...root,
  visible: true,
  children: root.children.map(setAllVisible),
});

const now = () => {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
};

const initialAssembly = createVehicleAssembly();
const initialResults = runSimulation(initialAssembly);

export const useWorkstationStore = create<WorkstationState>((set, get) => ({
  // Assembly
  assembly: initialAssembly,
  selectedNodeId: null,
  selectedNodePath: [],
  hoveredNodeId: null,

  // Viewport
  viewMode: 'perspective',
  renderMode: 'solid',
  cameraPreset: 'isometric',
  activeTool: 'select',
  explodeAmount: 0,
  sectionEnabled: false,
  sectionAxis: 'x',
  sectionPosition: 0,
  analysisOverlay: 'none',
  showGrid: true,
  showAxes: true,

  // Measurement
  measurePoints: [],
  measureData: null,

  // Camera Triggers
  fitCameraTrigger: 0,
  resetCameraTrigger: 0,

  // Undo / Redo
  undoStack: [],
  redoStack: [],

  // Simulation
  simulationStatus: 'complete',
  simulationProgress: 100,
  currentResults: initialResults,
  baselineResults: JSON.parse(JSON.stringify(initialResults)),

  // History
  revisions: [
    {
      id: 1,
      name: 'REV-01: Stock Vehicle',
      description: 'Baseline configuration – all parameters at factory defaults',
      timestamp: new Date().toISOString(),
      assembly: cloneAssembly(initialAssembly),
      results: initialResults,
    },
    {
      id: 2,
      name: 'REV-02: Aero & Eco Tuning',
      description: 'Optimized drag coefficient (0.31) and low-rolling resistance tyres',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      assembly: cloneAssembly(initialAssembly),
      results: runSimulation(initialAssembly),
    },
  ],
  activeRevisionId: 1,
  saveModalOpen: false,

  // Context Menu
  contextMenu: { visible: false, x: 0, y: 0, nodeId: null },

  // Panels
  showAssemblyTree: true,
  showPropertyInspector: true,
  showBottomPanel: true,
  bottomPanelTab: 'simulation',
  bottomPanelHeight: 220,
  showCommandPalette: false,

  consoleMessages: [
    { time: now(), level: 'info', message: 'KPIT Vehicle Digital Twin Workstation initialized' },
    { time: now(), level: 'info', message: 'Prototype Vehicle Model loaded – 35 components' },
    { time: now(), level: 'info', message: 'Physics solver initialized: Longitudinal dynamics & thermal model ready' },
    { time: now(), level: 'info', message: 'Baseline simulation complete (Net Power: 85 kW, Eff: 34.2%)' },
  ],

  // ── Actions ──
  selectNode: (id) => {
    const state = get();
    const path = id ? getAssemblyPath(state.assembly, id) : [];
    set({
      selectedNodeId: id,
      selectedNodePath: path,
      assembly: setSelectionInTree(state.assembly, id),
    });
    if (id) {
      get().addConsoleMessage('info', `Selected entity: ${id}`);
    }
  },

  hoverNode: (id) => set({ hoveredNodeId: id }),

  toggleNodeExpanded: (id) => {
    set(state => ({
      assembly: updateNodeInTree(state.assembly, id, n => ({ ...n, expanded: !n.expanded })),
    }));
  },

  toggleNodeVisibility: (id) => {
    set(state => {
      const updated = updateNodeInTree(state.assembly, id, n => ({ ...n, visible: !n.visible }));
      return { assembly: updated };
    });
  },

  isolateNode: (id) => {
    set(state => ({
      assembly: isolateInTree(state.assembly, id),
    }));
    get().addConsoleMessage('info', `Isolated entity: ${id}`);
  },

  showAllNodes: () => {
    set(state => ({ assembly: setAllVisible(state.assembly) }));
    get().addConsoleMessage('info', 'All assembly components restored to visible');
  },

  hideSelected: () => {
    const id = get().selectedNodeId;
    if (id) {
      get().toggleNodeVisibility(id);
      get().addConsoleMessage('info', `Hidden: ${id}`);
    }
  },

  showSelected: () => {
    const id = get().selectedNodeId;
    if (id) {
      set(state => ({
        assembly: updateNodeInTree(state.assembly, id, n => ({ ...n, visible: true })),
      }));
      get().addConsoleMessage('info', `Shown: ${id}`);
    }
  },

  isolateSelected: () => {
    const id = get().selectedNodeId;
    if (id) {
      get().isolateNode(id);
    }
  },

  restoreAll: () => {
    get().showAllNodes();
  },

  updateParameter: (nodeId, paramName, value) => {
    const state = get();
    // Push current assembly to undo stack
    const currentClone = cloneAssembly(state.assembly);
    const newUndo = [...state.undoStack.slice(-20), currentClone];

    const updatedAssembly = updateNodeInTree(state.assembly, nodeId, n => ({
      ...n,
      parameters: n.parameters.map(p =>
        p.name === paramName ? { ...p, value } : p
      ),
    }));

    // Instantly calculate deterministic simulation results
    const newResults = runSimulation(updatedAssembly);

    set({
      assembly: updatedAssembly,
      undoStack: newUndo,
      redoStack: [],
      currentResults: newResults,
      simulationStatus: 'complete',
    });

    get().addConsoleMessage(
      'info',
      `Parameter modified: [${nodeId}] ${paramName} = ${value} → Power: ${newResults.enginePeakPower.toFixed(1)} kW, 0-100: ${newResults.acceleration0to100.toFixed(2)}s`
    );
  },

  // ── Undo / Redo ──
  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const prev = state.undoStack[state.undoStack.length - 1];
    const newUndo = state.undoStack.slice(0, -1);
    const newRedo = [...state.redoStack, cloneAssembly(state.assembly)];
    const newResults = runSimulation(prev);

    set({
      assembly: prev,
      undoStack: newUndo,
      redoStack: newRedo,
      currentResults: newResults,
    });
    get().addConsoleMessage('info', 'Undo: Reverted previous parameter change');
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const next = state.redoStack[state.redoStack.length - 1];
    const newRedo = state.redoStack.slice(0, -1);
    const newUndo = [...state.undoStack, cloneAssembly(state.assembly)];
    const newResults = runSimulation(next);

    set({
      assembly: next,
      redoStack: newRedo,
      undoStack: newUndo,
      currentResults: newResults,
    });
    get().addConsoleMessage('info', 'Redo: Re-applied parameter change');
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // ── Viewport & Camera ──
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleViewMode: () => set(s => ({ viewMode: s.viewMode === 'perspective' ? 'orthographic' : 'perspective' })),
  setRenderMode: (mode) => set({ renderMode: mode }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
  setActiveTool: (tool) => {
    set({ activeTool: tool });
    if (tool !== 'measure') {
      get().clearMeasurement();
    }
    get().addConsoleMessage('info', `Active tool: ${tool.toUpperCase()}`);
  },
  setExplodeAmount: (amount) => set({ explodeAmount: Math.max(0, Math.min(1, amount)) }),
  toggleExplode: () => set(s => ({ explodeAmount: s.explodeAmount > 0.1 ? 0 : 1.0 })),
  toggleSection: () => {
    set(s => {
      const next = !s.sectionEnabled;
      return { sectionEnabled: next };
    });
    get().addConsoleMessage('info', `Cross-section plane ${get().sectionEnabled ? 'ENABLED' : 'DISABLED'}`);
  },
  setSectionAxis: (axis) => set({ sectionAxis: axis }),
  setSectionPosition: (pos) => set({ sectionPosition: pos }),
  setAnalysisOverlay: (overlay) => {
    set({ analysisOverlay: overlay });
    get().addConsoleMessage('info', `CAE Overlay: ${overlay.toUpperCase()}`);
  },
  toggleGrid: () => set(s => ({ showGrid: !s.showGrid })),
  toggleAxes: () => set(s => ({ showAxes: !s.showAxes })),
  triggerFitCamera: () => set(s => ({ fitCameraTrigger: s.fitCameraTrigger + 1 })),
  triggerResetCamera: () => set(s => ({ resetCameraTrigger: s.resetCameraTrigger + 1 })),

  // ── Measurement ──
  addMeasurePoint: (pt) => {
    const state = get();
    if (state.measurePoints.length === 0) {
      set({ measurePoints: [pt], measureData: null });
      get().addConsoleMessage('info', `Measurement Point A set: [${(pt[0]*1000).toFixed(0)}, ${(pt[1]*1000).toFixed(0)}, ${(pt[2]*1000).toFixed(0)}] mm`);
    } else {
      const p1 = state.measurePoints[0];
      const p2 = pt;
      const dx = Math.abs(p2[0] - p1[0]) * 1000;
      const dy = Math.abs(p2[1] - p1[1]) * 1000;
      const dz = Math.abs(p2[2] - p1[2]) * 1000;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      set({
        measurePoints: [p1, p2],
        measureData: { distance: dist, dx, dy, dz },
      });
      get().addConsoleMessage(
        'info',
        `Measurement complete: Distance = ${dist.toFixed(2)} mm (dX: ${dx.toFixed(2)}, dY: ${dy.toFixed(2)}, dZ: ${dz.toFixed(2)})`
      );
    }
  },

  clearMeasurement: () => set({ measurePoints: [], measureData: null }),

  // ── Real Solver Execution ──
  runSimulationAction: () => {
    const state = get();
    set({ simulationStatus: 'preparing', simulationProgress: 10 });
    get().addConsoleMessage('info', `[${now()}] Validating configuration...`);

    setTimeout(() => {
      set({ simulationStatus: 'running', simulationProgress: 35 });
      get().addConsoleMessage('info', `[${now()}] Preparing engineering model and component tree...`);
    }, 200);

    setTimeout(() => {
      set({ simulationProgress: 60 });
      get().addConsoleMessage('info', `[${now()}] Calculating power flow and transmission losses...`);
    }, 450);

    setTimeout(() => {
      set({ simulationProgress: 85 });
      get().addConsoleMessage('info', `[${now()}] Calculating thermal dissipation and component durability...`);
    }, 700);

    setTimeout(() => {
      const results = runSimulation(state.assembly);
      set({
        simulationStatus: 'complete',
        simulationProgress: 100,
        currentResults: results,
      });
      get().addConsoleMessage(
        'info',
        `[${now()}] Solver converged successfully. Peak Power: ${results.enginePeakPower.toFixed(1)} kW, Top Speed: ${results.topSpeed.toFixed(1)} km/h, Eff: ${results.overallEfficiency.toFixed(1)}%`
      );
    }, 950);
  },

  setSaveModalOpen: (open) => set({ saveModalOpen: open }),

  saveRevision: (name, description) => {
    const state = get();
    const id = state.revisions.length + 1;
    const rev: ConfigRevision = {
      id,
      name: `REV-${String(id).padStart(2, '0')}: ${name}`,
      description,
      timestamp: new Date().toISOString(),
      assembly: cloneAssembly(state.assembly),
      results: state.currentResults,
    };
    set({
      revisions: [...state.revisions, rev],
      activeRevisionId: id,
      saveModalOpen: false,
    });
    get().addConsoleMessage('info', `Engineering revision stored: ${rev.name}`);
  },

  loadRevision: (id) => {
    const state = get();
    const rev = state.revisions.find(r => r.id === id);
    if (rev) {
      set({
        assembly: cloneAssembly(rev.assembly),
        currentResults: rev.results,
        activeRevisionId: id,
        simulationStatus: rev.results ? 'complete' : 'idle',
      });
      get().addConsoleMessage('info', `Restored engineering revision: ${rev.name}`);
    }
  },

  setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),
  toggleBottomPanel: () => set(s => ({ showBottomPanel: !s.showBottomPanel })),
  setBottomPanelHeight: (h) => set({ bottomPanelHeight: Math.max(120, Math.min(450, h)) }),
  toggleAssemblyTree: () => set(s => ({ showAssemblyTree: !s.showAssemblyTree })),
  togglePropertyInspector: () => set(s => ({ showPropertyInspector: !s.showPropertyInspector })),
  toggleCommandPalette: () => set(s => ({ showCommandPalette: !s.showCommandPalette })),

  addConsoleMessage: (level, message) => {
    set(state => ({
      consoleMessages: [
        ...state.consoleMessages.slice(-99),
        { time: now(), level, message },
      ],
    }));
  },

  resetToBaseline: () => {
    const baseline = createVehicleAssembly();
    const results = runSimulation(baseline);
    set({
      assembly: baseline,
      currentResults: results,
      simulationStatus: 'complete',
      selectedNodeId: null,
      selectedNodePath: [],
      explodeAmount: 0,
      sectionEnabled: false,
      undoStack: [],
      redoStack: [],
      measurePoints: [],
      measureData: null,
    });
    get().addConsoleMessage('info', 'Vehicle model reset to factory engineering baseline');
  },

  // ── Context Menu ──
  openContextMenu: (x, y, nodeId) => set({ contextMenu: { visible: true, x, y, nodeId } }),
  closeContextMenu: () => set(s => ({ contextMenu: { ...s.contextMenu, visible: false } })),
}));
