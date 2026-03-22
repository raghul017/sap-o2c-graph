import { useEffect, useState } from 'react';
import axios from 'axios';

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
      <main className="grid min-h-0 flex-1 grid-cols-[3fr_2fr] gap-4 p-4">
        <section className="min-h-0">
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
        </section>
        <section className="min-h-0">
          <ChatPanel graphData={graphData} selectedNode={selectedNode} onHighlightNodes={handleHighlightNodes} />
        </section>
      </main>
    </div>
  );
}

export default App;
