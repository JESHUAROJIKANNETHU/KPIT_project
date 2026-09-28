// ============================================================
// Assembly Tree Panel – Engineering CAD Assembly Hierarchy
// Two-way synchronization with 3D Viewport & Store
// ============================================================

import React, { useCallback, useState } from 'react';
import { useWorkstationStore } from '../store/workstationStore';
import { AssemblyNode } from '../data/vehicleAssembly';

function TreeNode({ node, depth, query }: { node: AssemblyNode; depth: number; query: string }) {
  const selectedNodeId = useWorkstationStore(s => s.selectedNodeId);
  const selectNode = useWorkstationStore(s => s.selectNode);
  const toggleNodeExpanded = useWorkstationStore(s => s.toggleNodeExpanded);
  const toggleNodeVisibility = useWorkstationStore(s => s.toggleNodeVisibility);
  const hoverNode = useWorkstationStore(s => s.hoverNode);
  const openContextMenu = useWorkstationStore(s => s.openContextMenu);

  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = 6 + depth * 14;

  const matchesQuery =
    !query ||
    node.name.toLowerCase().includes(query.toLowerCase()) ||
    (node.partId && node.partId.toLowerCase().includes(query.toLowerCase()));

  const handleClick = useCallback(() => {
    selectNode(node.id);
  }, [selectNode, node.id]);

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleNodeExpanded(node.id);
  }, [toggleNodeExpanded, node.id]);

  const handleVisClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleNodeVisibility(node.id);
  }, [toggleNodeVisibility, node.id]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selectNode(node.id);
    openContextMenu(e.clientX, e.clientY, node.id);
  }, [selectNode, openContextMenu, node.id]);

  return (
    <>
      <div
        className={`tree-node${isSelected ? ' tree-node--selected' : ''}${!node.visible ? ' tree-node--hidden' : ''}`}
        style={{ paddingLeft }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => hoverNode(node.id)}
        onMouseLeave={() => hoverNode(null)}
        title={`${node.name} ${node.partId ? `[${node.partId}]` : ''} – Click to select, Right-click for options`}
      >
        <span
          className={`tree-node__expand${node.expanded ? ' tree-node__expand--open' : ''}`}
          onClick={hasChildren ? handleExpandClick : undefined}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          ▶
        </span>
        <span
          className="tree-node__icon"
          style={{ background: node.color }}
        />
        <span className="tree-node__label">
          {node.name}
          {node.partId && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, fontFamily: 'var(--font-mono)' }}>
              {node.partId}
            </span>
          )}
        </span>
        <span
          className="tree-node__vis"
          onClick={handleVisClick}
          title={node.visible ? 'Hide Component' : 'Show Component'}
        >
          {node.visible ? '👁' : '—'}
        </span>
      </div>
      {node.expanded &&
        hasChildren &&
        node.children.map(child => (
          <TreeNode key={child.id} node={child} depth={depth + 1} query={query} />
        ))}
    </>
  );
}

export default function AssemblyTree() {
  const assembly = useWorkstationStore(s => s.assembly);
  const showAllNodes = useWorkstationStore(s => s.showAllNodes);
  const [filterQuery, setFilterQuery] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search Filter for CAD Assembly */}
      <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-panel-alt)' }}>
        <input
          type="text"
          placeholder="Filter assembly parts..."
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
          style={{
            width: '100%',
            height: 22,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 2,
            color: 'var(--text-primary)',
            fontSize: 11,
            padding: '0 6px',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        <TreeNode node={assembly} depth={0} query={filterQuery} />
      </div>
    </div>
  );
}
