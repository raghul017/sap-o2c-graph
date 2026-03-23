import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from 'react-resizable-panels';

import { API_BASE } from './constants';
import { ChatPanel } from './components/ChatPanel';
import { GraphPanel } from './components/GraphPanel';
import { Header } from './components/Header';
import { GraphData, GraphNode } from './types';

interface GraphStats {
  total_nodes: number;
  total_edges: number;
  by_type: Record<string, number>;
}

function App() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<GraphStats | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [graphRes, statsRes] = await Promise.all([
          axios.get<GraphData>(`${API_BASE}/api/graph`),
          axios.get<GraphStats>(`${API_BASE}/api/stats`),
        ]);
        setGraphData(graphRes.data);
        setStats(statsRes.data);
      } catch (error) {
        console.error('Failed to load initial frontend data', error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleHighlightNodes = (ids: string[]) => {
    setHighlightedNodeIds(new Set(ids));
    if (!ids.length) {
      return;
    }
    window.setTimeout(() => {
      setHighlightedNodeIds(new Set());
    }, 5000);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', background: '#ffffff' }}>
      <Header stats={stats} />
      <PanelGroup direction="horizontal" style={{ flex: 1, overflow: 'hidden' }}>
        <Panel defaultSize={68} minSize={40}>
          {loading ? (
            <div
              style={{
                display: 'flex',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                fontSize: 13,
                background: '#f9fafb',
              }}
            >
              Loading graph...
            </div>
          ) : (
            <GraphPanel
              graphData={graphData}
              setGraphData={setGraphData}
              selectedNode={selectedNode}
              setSelectedNode={setSelectedNode}
              highlightedNodeIds={highlightedNodeIds}
            />
          )}
        </Panel>
        <PanelResizeHandle
          style={{
            width: '4px',
            background: '#e5e7eb',
            cursor: 'col-resize',
          }}
          onDragging={(isDragging: boolean) => {
            document.body.style.cursor = isDragging ? 'col-resize' : '';
          }}
        />
        <Panel defaultSize={32} minSize={25} maxSize={55}>
          <ChatPanel graphData={graphData} selectedNode={selectedNode} onHighlightNodes={handleHighlightNodes} />
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default App;
