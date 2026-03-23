import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node as RFNode,
} from '@xyflow/react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force';
import '@xyflow/react/dist/style.css';

import { GraphData, GraphEdge, GraphNode } from '../types';

interface GraphPanelProps {
  graphData: GraphData | null;
  setGraphData: React.Dispatch<React.SetStateAction<GraphData | null>>;
  selectedNode: GraphNode | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<GraphNode | null>>;
  highlightedNodeIds: Set<string>;
}

function getNodeColor(nodeType: string): string {
  const blue = ['BusinessPartner', 'SalesOrder', 'Product', 'Plant'];
  return blue.includes(nodeType) ? '#93C5FD' : '#FCA5A5';
}

function getNodeBorderColor(nodeType: string): string {
  const blue = ['BusinessPartner', 'SalesOrder', 'Product', 'Plant'];
  return blue.includes(nodeType) ? '#3B82F6' : '#EF4444';
}

function runForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Record<string, { x: number; y: number }> {
  const width = 1200;
  const height = 900;

  const simNodes: Array<{ id: string; x: number; y: number }> = nodes.map((node) => ({
    id: node.id,
    x: width / 2 + (Math.random() - 0.5) * 600,
    y: height / 2 + (Math.random() - 0.5) * 600,
  }));

  const idSet = new Set(nodes.map((node) => node.id));
  const simLinks = edges
    .filter((edge) => idSet.has(edge.source) && idSet.has(edge.target))
    .map((edge) => ({ source: edge.source, target: edge.target }));

  const sim = forceSimulation(simNodes)
    .force(
      'link',
      forceLink(simLinks)
        .id((d: any) => d.id)
        .distance(60)
        .strength(0.3),
    )
    .force('charge', forceManyBody().strength(-80))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide(12))
    .stop();

  sim.tick(250);

  const positions: Record<string, { x: number; y: number }> = {};
  simNodes.forEach((node) => {
    positions[node.id] = { x: node.x, y: node.y };
  });
  return positions;
}

const CircularNode = memo(function CircularNode({ data }: { data: any }) {
  const size = data.isSelected ? 16 : 10;

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div
        title={data.label}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: getNodeColor(data.nodeType),
          border: `2px solid ${getNodeBorderColor(data.nodeType)}`,
          cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: data.isSelected
            ? `0 0 0 3px ${getNodeBorderColor(data.nodeType)}40`
            : 'none',
        }}
      />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </>
  );
});

function GraphCanvas({
  graphData,
  selectedNode,
  setSelectedNode,
  highlightedNodeIds,
}: GraphPanelProps) {
  const { fitView } = useReactFlow();
  const [showFilters, setShowFilters] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set());
  const [popupNodeId, setPopupNodeId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 24, y: 72 });
  const [layoutVersion, setLayoutVersion] = useState(0);
  const layoutRef = useRef<Record<string, { x: number; y: number }>>({});
  const layoutDoneRef = useRef(false);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (graphData && visibleTypes.size === 0) {
      setVisibleTypes(new Set(graphData.nodes.map((node) => node.type)));
    }
  }, [graphData, visibleTypes.size]);

  useEffect(() => {
    if (!graphData || layoutDoneRef.current) {
      return;
    }
    layoutDoneRef.current = true;
    layoutRef.current = runForceLayout(graphData.nodes, graphData.edges);
    setLayoutVersion((version) => version + 1);
  }, [graphData]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!popupRef.current) {
        return;
      }
      if (!popupRef.current.contains(event.target as globalThis.Node)) {
        setPopupNodeId(null);
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  const typeCounts = useMemo(() => {
    if (!graphData) {
      return {} as Record<string, number>;
    }
    return graphData.nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [graphData]);

  const rfNodes = useMemo<RFNode[]>(() => {
    if (!graphData || layoutVersion === 0) {
      return [];
    }
    return graphData.nodes
      .filter((node) => visibleTypes.has(node.type))
      .map((node) => ({
      id: node.id,
      type: 'custom',
      position: layoutRef.current[node.id] ?? { x: 0, y: 0 },
      draggable: false,
      selectable: true,
      data: {
        label: node.label,
        nodeType: node.type,
        meta: node.data,
        isSelected: selectedNode?.id === node.id || highlightedNodeIds.has(node.id),
      },
    }));
  }, [graphData, layoutVersion, visibleTypes, selectedNode?.id, highlightedNodeIds]);

  const rfEdges = useMemo(
    () => {
      if (!graphData) {
        return [];
      }
      const visibleIds = new Set(
        graphData.nodes.filter((node) => visibleTypes.has(node.type)).map((node) => node.id),
      );
      return graphData.edges
        .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
        .map((edge, index) => ({
        id: `e-${index}-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        style: {
          stroke: '#BFDBFE',
          strokeWidth: 1,
          opacity: 0.5,
        },
        type: 'straight' as const,
      }));
    },
    [graphData, visibleTypes],
  );

  useEffect(() => {
    if (layoutVersion === 0 || rfNodes.length === 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      fitView({ padding: 0.05 });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [layoutVersion, rfNodes.length, fitView]);

  const popupNode = useMemo(() => {
    if (!graphData || !popupNodeId) {
      return null;
    }
    return graphData.nodes.find((node) => node.id === popupNodeId) ?? null;
  }, [graphData, popupNodeId]);

  const popupFields = useMemo(() => {
    if (!popupNode) {
      return [] as Array<[string, string]>;
    }
    return Object.entries(popupNode.data || {})
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]);
  }, [popupNode]);

  const nodeTypes = useMemo(() => ({ custom: CircularNode }), []);

  return (
    <div style={{ position: 'relative', height: '100%', background: '#F9FAFB' }}>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 10,
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          onClick={() => fitView({ padding: 0.1 })}
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ⤢ Minimize
        </button>
        <button
          onClick={() => setShowFilters((current) => !current)}
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ◧ {showFilters ? 'Hide' : 'Show'} Granular Overlay
        </button>
      </div>

      {showFilters ? (
        <div
          style={{
            position: 'absolute',
            top: 52,
            left: 12,
            zIndex: 10,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            maxWidth: 720,
          }}
        >
          {Object.entries(typeCounts).map(([type, count]) => {
            const active = visibleTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => {
                  setVisibleTypes((current) => {
                    const next = new Set(current);
                    if (next.has(type)) {
                      next.delete(type);
                    } else {
                      next.add(type);
                    }
                    return next;
                  });
                }}
                style={{
                  background: active ? '#ffffff' : '#f9fafb',
                  border: '1px solid #e5e7eb',
                  color: active ? '#111827' : '#6b7280',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {type} ({count})
              </button>
            );
          })}
        </div>
      ) : null}

      {popupNode ? (
        <div
          ref={popupRef}
          style={{
            position: 'absolute',
            left: Math.max(12, popupPosition.x),
            top: Math.max(64, popupPosition.y),
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '16px',
            minWidth: 280,
            maxWidth: 340,
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            zIndex: 1000,
            fontSize: 13,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
              {popupNode.type}
            </div>
            <button
              onClick={() => setPopupNodeId(null)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#9ca3af',
              }}
            >
              ×
            </button>
          </div>
          {popupFields.slice(0, 8).map(([key, value]) => (
            <div key={key} style={{ marginBottom: 6, lineHeight: 1.45, color: '#374151' }}>
              <span style={{ fontWeight: 600, color: '#111827' }}>{key}:</span> {value}
            </div>
          ))}
          {popupFields.length > 8 ? (
            <div style={{ marginTop: 8, color: '#9ca3af', fontStyle: 'italic' }}>
              {popupFields.length - 8} additional fields hidden for readability
            </div>
          ) : null}
          <div style={{ marginTop: 12, color: '#6b7280' }}>
            Connections:{' '}
            {
              rfEdges.filter(
                (edge) => edge.source === popupNode.id || edge.target === popupNode.id,
              ).length
            }
          </div>
        </div>
      ) : null}

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elevateEdgesOnSelect={false}
        onlyRenderVisibleElements={true}
        style={{ background: '#F9FAFB' }}
        defaultEdgeOptions={{ type: 'straight' }}
        onNodeClick={(event, node) => {
          const originalNode =
            graphData?.nodes.find((candidate) => candidate.id === node.id) ?? null;
          setSelectedNode(originalNode);
          setPopupNodeId(node.id);
          setPopupPosition({ x: event.clientX + 16, y: event.clientY - 12 });
        }}
      >
        <Background color="#e5e7eb" gap={32} size={1} />
      </ReactFlow>
    </div>
  );
}

export function GraphPanel(props: GraphPanelProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
