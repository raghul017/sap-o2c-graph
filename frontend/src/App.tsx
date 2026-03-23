import { useEffect, useRef, useState } from 'react';
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
  const [chatWidth, setChatWidth] = useState(380);
  const isDragging = useRef(false);

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

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!isDragging.current) {
        return;
      }
      const newWidth = window.innerWidth - event.clientX;
      if (newWidth >= 280 && newWidth <= 700) {
        setChatWidth(newWidth);
      }
    };

    const onUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
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

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', background: '#ffffff' }}>
      <Header stats={stats} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
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
        </div>
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: 4,
            background: '#e5e7eb',
            cursor: 'col-resize',
            flexShrink: 0,
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = '#94a3b8';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = '#e5e7eb';
          }}
        />
        <div
          style={{
            width: chatWidth,
            flexShrink: 0,
            borderLeft: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            overflow: 'hidden',
          }}
        >
          <ChatPanel graphData={graphData} selectedNode={selectedNode} onHighlightNodes={handleHighlightNodes} />
        </div>
      </div>
    </div>
  );
}

export default App;
