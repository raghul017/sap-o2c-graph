export interface GraphNode {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  columns?: string[];
  rows?: any[][];
  count?: number;
  answer_type?: 'data' | 'off_topic' | 'error';
  timestamp: Date;
}

export interface NodeNeighbors {
  node: GraphNode;
  neighbors: Array<{
    node: GraphNode;
    relation: string;
    direction: 'in' | 'out';
  }>;
}
