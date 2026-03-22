import { useEffect, useState } from 'react';
import axios from 'axios';
import { Group, Panel, Separator } from 'react-resizable-panels';

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
    load();
  }, []);

  const handleHighlightNodes = (ids: string[]) => {
    if (!ids.length) {
      return;
    }
    setHighlightedNodeIds(new Set(ids));
    window.setTimeout(() => {
      setHighlightedNodeIds(new Set());
    }, 5000);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-transparent text-slate-100">
      <Header stats={stats} />
      <main className="min-h-0 flex-1 overflow-hidden p-4">
        <Group direction="horizontal" style={{ flex: 1, overflow: 'hidden' }}>
          <Panel defaultSize={60} minSize={30} maxSize={80}>
            <div className="h-full min-h-0 pr-2">
              {loading ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/50 text-sm text-slate-400">
                  Loading graph explorer...
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
            </div>
          </Panel>
          <Separator
            style={{
              width: '4px',
              background: '#1E2D3D',
              cursor: 'col-resize',
              transition: 'background 0.2s',
              position: 'relative',
            }}
            className="group"
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '1px',
                height: '40px',
                background: '#475569',
              }}
              className="group-hover:bg-[#3B82F6]"
            />
          </Separator>
          <Panel defaultSize={40} minSize={20} maxSize={70}>
            <div className="h-full min-h-0 pl-2">
              <ChatPanel graphData={graphData} selectedNode={selectedNode} onHighlightNodes={handleHighlightNodes} />
            </div>
          </Panel>
        </Group>
      </main>
    </div>
  );
}

export default App;
