import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Background,
  Controls,
  Node,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { API_BASE, NODE_COLORS, NODE_TYPE_ORDER } from '../constants';
import { GraphData, GraphNode, NodeNeighbors } from '../types';

interface GraphPanelProps {
  graphData: GraphData | null;
  setGraphData: React.Dispatch<React.SetStateAction<GraphData | null>>;
  selectedNode: GraphNode | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<GraphNode | null>>;
  highlightedNodeIds: Set<string>;
}

const TYPE_X: Record<string, number> = {
  BusinessPartner: 0,
  SalesOrder: 220,
  SalesOrderItem: 440,
  Delivery: 660,
  BillingDocument: 880,
  JournalEntry: 1100,
  Payment: 1320,
  Product: 440,
  Plant: 660,
};

const TYPE_Y_OFFSET: Record<string, number> = {
  BusinessPartner: 0,
  SalesOrder: 0,
  SalesOrderItem: 0,
  Delivery: 0,
  BillingDocument: 0,
  JournalEntry: 0,
  Payment: 0,
  Product: 900,
  Plant: 900,
};

function computeLayout(nodes: GraphNode[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const typeCounters: Record<string, number> = {};
  const Y_GAP = 90;

  for (const node of nodes) {
    const t = node.type;
    if (typeCounters[t] === undefined) {
      typeCounters[t] = 0;
    }
    const idx = typeCounters[t]++;
    positions[node.id] = {
      x: TYPE_X[t] ?? 0,
      y: (TYPE_Y_OFFSET[t] ?? 0) + idx * Y_GAP,
    };
  }

  return positions;
}

function CustomNode({ data }: { data: any }) {
  return (
    <div
      style={{
        background: `${NODE_COLORS[data.nodeType] ?? '#64748B'}12`,
        border: `1px solid ${(NODE_COLORS[data.nodeType] ?? '#64748B')}50`,
        borderRadius: '6px',
        padding: '6px 10px',
        minWidth: '110px',
        maxWidth: '150px',
        cursor: 'pointer',
        boxShadow: data.isHighlighted ? `0 0 0 2px ${NODE_COLORS[data.nodeType] ?? '#64748B'}` : 'none',
        outline: data.isSelected ? `2px solid ${NODE_COLORS[data.nodeType] ?? '#64748B'}` : 'none',
      }}
      className="transition-all duration-200"
    >
      <div
        style={{
          color: NODE_COLORS[data.nodeType] ?? '#64748B',
          fontSize: '8px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.8,
          marginBottom: '2px',
        }}
      >
        {data.nodeType}
      </div>
      <div
        style={{
          color: '#CBD5E1',
          fontSize: '11px',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data.label}
      </div>
    </div>
  );
}

function GraphCanvas({
  graphData,
  setGraphData,
  selectedNode,
  setSelectedNode,
  highlightedNodeIds,
}: GraphPanelProps) {
  const { fitView } = useReactFlow();
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(['BusinessPartner', 'SalesOrder', 'Delivery', 'BillingDocument', 'Payment']),
  );
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);
  const typeCounts = useMemo(() => {
    if (!graphData) {
      return {};
    }
    return graphData.nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [graphData]);

  const rfNodes = useMemo<Node[]>(() => {
    if (!graphData) {
      return [];
    }
    const positions = computeLayout(graphData.nodes);
    return graphData.nodes
      .filter((node) => visibleTypes.has(node.type))
      .map((node) => ({
        id: node.id,
        type: 'custom',
        position: positions[node.id] ?? { x: 0, y: 0 },
        data: {
          label: node.label,
          nodeType: node.type,
          meta: node.data,
          isHighlighted: highlightedNodeIds.has(node.id),
          isSelected: selectedNode?.id === node.id,
        },
      }));
  }, [graphData, visibleTypes, highlightedNodeIds, selectedNode]);

  const rfEdges = useMemo(() => {
    if (!graphData) {
      return [];
    }
    const visibleNodeIds = new Set(rfNodes.map((node) => node.id));
    return graphData.edges
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge, index) => ({
        id: `e-${edge.source}-${edge.target}-${edge.relation}-${index}`,
        source: edge.source,
        target: edge.target,
        label: edge.relation,
        animated: edge.relation === 'SETTLED_BY',
        style: { stroke: '#64748B', strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fill: '#94A3B8' },
      }));
  }, [graphData, rfNodes]);

  useEffect(() => {
    if (rfNodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.1, includeHiddenNodes: false });
      }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [fitView, rfNodes.length]);

  const mergeGraphData = useCallback((neighbors: NodeNeighbors) => {
    setGraphData((current) => {
      if (!current) {
        return current;
      }
      const nodeMap = new Map(current.nodes.map((node) => [node.id, node]));
      const edgeMap = new Map(current.edges.map((edge) => [`${edge.source}|${edge.target}|${edge.relation}`, edge]));

      if (neighbors.node) {
        nodeMap.set(neighbors.node.id, neighbors.node);
      }

      neighbors.neighbors.forEach((neighbor) => {
        nodeMap.set(neighbor.node.id, neighbor.node);
        const edge =
          neighbor.direction === 'out'
            ? { source: neighbors.node.id, target: neighbor.node.id, relation: neighbor.relation }
            : { source: neighbor.node.id, target: neighbors.node.id, relation: neighbor.relation };
        edgeMap.set(`${edge.source}|${edge.target}|${edge.relation}`, edge);
      });

      return {
        nodes: Array.from(nodeMap.values()),
        edges: Array.from(edgeMap.values()),
      };
    });
  }, [setGraphData]);

  const onNodeClick = useCallback(
    async (_event: React.MouseEvent, rfNode: Node) => {
      if (!graphData) {
        return;
      }
      const originalNode = graphData.nodes.find((node) => node.id === rfNode.id) ?? null;
      setSelectedNode(originalNode);

      try {
        const res = await axios.get<NodeNeighbors>(
          `${API_BASE}/api/graph/expand/${encodeURIComponent(rfNode.id)}`,
        );
        mergeGraphData(res.data);
      } catch (error) {
        console.error('Failed to expand node', error);
      }
    },
    [graphData, mergeGraphData, setSelectedNode],
  );

  const toggleType = useCallback((type: string) => {
    setVisibleTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50">
      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        <button
          className="rounded-md border border-slate-700 bg-slate-900/90 px-3 py-1 text-xs text-slate-200"
          onClick={() => fitView({ duration: 300, padding: 0.2 })}
        >
          Reset View
        </button>
        <button
          className="rounded-md border border-slate-700 bg-slate-900/90 px-3 py-1 text-xs text-slate-200"
          onClick={() => fitView({ duration: 300, padding: 0.2 })}
        >
          Fit All
        </button>
      </div>

      <div className="absolute left-4 top-16 z-10 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
        {NODE_TYPE_ORDER.map((type) => {
          const active = visibleTypes.has(type);
          return (
            <button
              key={type}
              className="transition"
              style={{
                background: active ? `${NODE_COLORS[type]}18` : 'transparent',
                border: active ? `1px solid ${NODE_COLORS[type]}60` : '1px solid #2D3748',
                color: active ? NODE_COLORS[type] : '#475569',
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
              onClick={() => toggleType(type)}
            >
              {type} ({typeCounts[type] ?? 0})
            </button>
          );
        })}
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView={false}
        defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
        minZoom={0.15}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        selectNodesOnDrag={false}
        onlyRenderVisibleElements
        onNodeClick={onNodeClick}
      >
        <Background color="#1e293b" gap={18} />
        <Controls />
      </ReactFlow>

      {selectedNode ? (
        <div className="absolute bottom-4 left-4 z-10 w-[320px] rounded-xl border border-slate-700 p-4 backdrop-blur" style={{ background: '#161B27' }}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div
                className="mb-2 inline-flex rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  backgroundColor: `${NODE_COLORS[selectedNode.type] || '#64748B'}18`,
                  color: NODE_COLORS[selectedNode.type] || '#CBD5E1',
                }}
              >
                {selectedNode.type}
              </div>
              <div className="text-sm font-semibold text-slate-100">{selectedNode.label}</div>
            </div>
            <button className="text-xs text-slate-400 hover:text-slate-200" onClick={() => setSelectedNode(null)}>
              X
            </button>
          </div>
          <div className="max-h-[240px] space-y-2 overflow-auto pr-1 text-xs scrollbar-thin">
            {Object.entries(selectedNode.data)
              .filter(([, value]) => value !== null && value !== '')
              .map(([key, value]) => (
                <div key={key} className="grid grid-cols-[110px,1fr] gap-2">
                  <div className="font-medium text-slate-400">{key}</div>
                  <div className="break-all text-slate-200">{String(value)}</div>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GraphPanel(props: GraphPanelProps) {
  if (!props.graphData) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/50 text-sm text-slate-400">
        Loading graph...
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
