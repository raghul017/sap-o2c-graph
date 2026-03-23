import { FormEvent, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import { API_BASE } from '../constants';
import { ChatMessage, GraphData, GraphNode } from '../types';

interface SuggestedQueriesResponse {
  queries: string[];
}

interface ChatPanelProps {
  graphData: GraphData | null;
  selectedNode: GraphNode | null;
  onHighlightNodes: (ids: string[]) => void;
}

interface ChatApiResponse {
  answer_type: 'data' | 'off_topic' | 'error';
  sql: string | null;
  explanation: string | null;
  columns: string[];
  rows: any[][];
  count: number;
  message: string | null;
}

function extractNodeIds(sql: string, graphData: GraphData | null): string[] {
  if (!graphData) {
    return [];
  }
  const ids = new Set<string>();
  const matches = sql.matchAll(/'([^']+)'/g);
  for (const match of matches) {
    const value = match[1];
    if (graphData.nodes.some((node) => node.id === value)) {
      ids.add(value);
    }
  }
  return [...ids];
}

function assistantHistoryContent(message: ChatMessage) {
  return [message.content, message.sql ? `SQL: ${message.sql}` : null].filter(Boolean).join('\n');
}

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function AgentAvatar() {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: '#111827',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: 14,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      G
    </div>
  );
}

export function ChatPanel({ graphData, selectedNode, onHighlightNodes }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchSuggestedQueries = async () => {
      try {
        const response = await axios.get<SuggestedQueriesResponse>(`${API_BASE}/api/suggested-queries`);
        setSuggestedQueries(response.data.queries);
      } catch (error) {
        console.error('Failed to load suggested queries', error);
      }
    };
    void fetchSuggestedQueries();
  }, []);

  const historyForApi = useMemo(
    () =>
      messages
        .slice(-10)
        .flatMap((message) => {
          if (message.role === 'user') {
            return [{ role: 'user', content: message.content }];
          }
          return [{ role: 'assistant', content: assistantHistoryContent(message) }];
        })
        .slice(-6),
    [messages],
  );

  const submitQuery = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((current) => [...current.slice(-9), userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post<ChatApiResponse>(`${API_BASE}/api/chat`, {
        query: trimmed,
        history: historyForApi,
      });

      const payload = response.data;
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content:
          payload.answer_type === 'off_topic'
            ? 'This system is designed to answer questions related to the provided dataset only.'
            : payload.explanation || payload.message || 'No response returned.',
        sql: payload.sql || undefined,
        columns: payload.columns,
        rows: payload.rows,
        count: payload.count,
        answer_type: payload.answer_type,
        timestamp: new Date(),
      };

      setMessages((current) => [...current.slice(-9), assistantMessage]);

      if (payload.answer_type === 'data' && payload.sql) {
        const ids = extractNodeIds(payload.sql, graphData);
        if (ids.length) {
          onHighlightNodes(ids);
        }
      }
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : 'Unexpected error while calling the API.';
      setMessages((current) => [
        ...current.slice(-9),
        {
          id: createMessageId(),
          role: 'assistant',
          content: String(message),
          answer_type: 'error',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await submitQuery(input);
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        background: '#ffffff',
      }}
    >
      <div
        style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid #f3f4f6',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Chat with Graph</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
          {selectedNode ? selectedNode.label : 'Order to Cash'}
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', gap: 12, borderBottom: '1px solid #f9fafb' }}>
        <AgentAvatar />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Graph Agent</div>
          <div style={{ fontSize: 12, fontWeight: 400, color: '#6b7280' }}>Graph Agent</div>
          <div
            style={{
              fontSize: 13,
              color: '#374151',
              marginTop: 6,
              lineHeight: 1.5,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              minWidth: 0,
            }}
          >
            Hi! I can help you analyze the <strong>Order to Cash</strong> process.
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {!messages.length && suggestedQueries.length ? (
          <div style={{ paddingTop: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {suggestedQueries.slice(0, 6).map((query) => (
                <button
                  key={query}
                  onClick={() => void submitQuery(query)}
                  style={{
                    border: '1px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#4b5563',
                    borderRadius: 999,
                    padding: '6px 10px',
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <div key={message.id} style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, gap: 8, minWidth: 0 }}>
                <div
                  style={{
                    background: '#111827',
                    color: '#ffffff',
                    borderRadius: '12px 12px 2px 12px',
                    padding: '10px 14px',
                    fontSize: 13,
                    maxWidth: '80%',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    minWidth: 0,
                  }}
                >
                  {message.content}
                </div>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#e5e7eb',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                  }}
                >
                  U
                </div>
              </div>
            );
          }

          const isExpanded = expandedMessages.has(message.id);
          const displayRows = isExpanded ? message.rows : message.rows?.slice(0, 8);
          const remaining = (message.rows?.length ?? 0) - 8;

          return (
            <div key={message.id} style={{ display: 'flex', paddingTop: 10, gap: 12, minWidth: 0 }}>
              <AgentAvatar />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Graph Agent</div>
                <div
                  style={{
                    fontSize: 13,
                    color: '#374151',
                    marginTop: 6,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    minWidth: 0,
                  }}
                >
                  {message.content}
                </div>
                {message.answer_type === 'data' && message.columns && message.columns.length > 0 ? (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 11 }}>
                      <thead>
                        <tr>
                          {message.columns.map((column) => (
                            <th
                              key={column}
                              style={{
                                textAlign: 'left',
                                padding: '4px 6px',
                                borderBottom: '1px solid #e5e7eb',
                                color: '#6b7280',
                                fontWeight: 500,
                              }}
                            >
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows?.map((row, rowIndex) => (
                          <tr key={`${message.id}-${rowIndex}`} style={{ background: rowIndex % 2 === 0 ? '#f9fafb' : '#ffffff' }}>
                            {row.map((cell: any, cellIndex: number) => (
                              <td key={`${message.id}-${rowIndex}-${cellIndex}`} style={{ padding: '4px 6px', fontSize: 11 }}>
                                {String(cell ?? '').slice(0, 25)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!isExpanded && remaining > 0 ? (
                      <div
                        onClick={() =>
                          setExpandedMessages((prev) => {
                            const next = new Set(prev);
                            next.add(message.id);
                            return next;
                          })
                        }
                        style={{
                          fontSize: 12,
                          color: '#6b7280',
                          marginTop: 6,
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.color = '#111827';
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.color = '#6b7280';
                        }}
                      >
                        +{remaining} more results ↓
                      </div>
                    ) : null}
                    {isExpanded ? (
                      <div
                        onClick={() =>
                          setExpandedMessages((prev) => {
                            const next = new Set(prev);
                            next.delete(message.id);
                            return next;
                          })
                        }
                        style={{
                          fontSize: 12,
                          color: '#6b7280',
                          marginTop: 6,
                          cursor: 'pointer',
                        }}
                      >
                        ↑ Show less
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          );
        })}

        {loading ? (
          <div style={{ display: 'flex', paddingTop: 10, gap: 12 }}>
            <AgentAvatar />
            <div style={{ fontSize: 13, color: '#6b7280' }}>Analyzing your query...</div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          padding: '6px 20px',
          fontSize: 11,
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderTop: '1px solid #f3f4f6',
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
        Graph Agent is awaiting instructions
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #f3f4f6',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        <textarea
          placeholder="Analyze anything"
          style={{
            flex: 1,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            resize: 'none',
            minHeight: 36,
            maxHeight: 120,
            fontFamily: 'inherit',
            outline: 'none',
            color: '#111827',
          }}
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submitQuery(input);
            }
          }}
        />
        <button
          type="submit"
          style={{
            background: '#111827',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            cursor: 'pointer',
            height: 36,
          }}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
