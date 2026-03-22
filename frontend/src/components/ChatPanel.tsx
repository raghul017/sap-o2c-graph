import { FormEvent, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import { API_BASE } from '../constants';
import { ChatMessage, GraphData, GraphNode } from '../types';
import { ResultsTable } from './ResultsTable';

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

export function ChatPanel({ graphData, selectedNode, onHighlightNodes }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);
  const [expandedSqlIds, setExpandedSqlIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchSuggestedQueries = async () => {
      try {
        const response = await axios.get<SuggestedQueriesResponse>(`${API_BASE}/api/suggested-queries`);
        setSuggestedQueries(response.data.queries);
      } catch (error) {
        console.error('Failed to load suggested queries', error);
      }
    };
    fetchSuggestedQueries();
  }, []);

  const historyForApi = useMemo(
    () =>
      messages.slice(-10).flatMap((message) => {
        if (message.role === 'user') {
          return [{ role: 'user', content: message.content }];
        }
        return [{ role: 'assistant', content: assistantHistoryContent(message) }];
      }).slice(-6),
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
        content: payload.explanation || payload.message || 'No explanation returned.',
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

  const conversationStarted = messages.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-slate-800" style={{ background: '#161B27' }}>
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="text-sm font-semibold text-slate-100">Chat</div>
        <div className="mt-1 text-xs text-slate-400">
          {selectedNode ? `Selected node: ${selectedNode.label}` : 'Ask questions about the O2C graph and SQL dataset.'}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-5 py-4 scrollbar-thin">
        {!conversationStarted ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
            Ask about orders, deliveries, billing, payments, products, plants, or customers.
          </div>
        ) : null}

        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-lg bg-blue-700 px-4 py-3 text-[13px] text-white">
                  {message.content}
                </div>
              </div>
            );
          }

          const sqlExpanded = expandedSqlIds.has(message.id);
          const cardTone =
            message.answer_type === 'off_topic'
              ? 'text-amber-200'
              : message.answer_type === 'error'
                ? 'text-rose-100'
                : 'text-slate-100';

          return (
            <div key={message.id} className="flex justify-start">
              <div
                className={`max-w-[95%] rounded-[10px] border px-[14px] py-[14px] text-sm ${cardTone}`}
                style={
                  message.answer_type === 'off_topic'
                    ? { background: '#1C1508', border: '1px solid #92400E' }
                    : message.answer_type === 'error'
                      ? { background: '#2A1318', border: '1px solid #7F1D1D' }
                      : { background: '#161B27', border: '1px solid #1E2D3D' }
                }
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                {message.answer_type === 'data' ? (
                  <>
                    <div className="mt-3 inline-flex rounded-md bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-300">
                      {message.count ?? 0} results found
                    </div>
                    {message.sql ? (
                      <div className="mt-3">
                        <button
                          className="text-xs font-medium text-sky-300 hover:text-sky-200"
                          onClick={() =>
                            setExpandedSqlIds((current) => {
                              const next = new Set(current);
                              if (next.has(message.id)) {
                                next.delete(message.id);
                              } else {
                                next.add(message.id);
                              }
                              return next;
                            })
                          }
                        >
                          {sqlExpanded ? 'Hide SQL' : 'Show SQL'}
                        </button>
                        {sqlExpanded ? (
                          <pre
                            className="mt-2 overflow-auto rounded-lg p-3 scrollbar-thin"
                            style={{
                              background: '#0D1117',
                              border: '1px solid #21262D',
                              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                              fontSize: '11px',
                              color: '#79C0FF',
                            }}
                          >
                            <code>{message.sql}</code>
                          </pre>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-3">
                      <ResultsTable columns={message.columns} rows={message.rows} count={message.count} />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}

        {loading ? (
          <div className="flex justify-start">
            <div className="rounded-lg border px-4 py-3 text-sm text-slate-300" style={{ background: '#161B27', border: '1px solid #1E2D3D' }}>
              <span className="inline-flex items-center gap-1">
                Analyzing your query
                <span className="animate-pulse">.</span>
                <span className="animate-pulse [animation-delay:150ms]">.</span>
                <span className="animate-pulse [animation-delay:300ms]">.</span>
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {!conversationStarted && suggestedQueries.length ? (
        <div className="border-t border-slate-800 px-5 py-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">Suggested Queries</div>
          <div className="flex flex-wrap gap-2">
            {suggestedQueries.map((query) => (
              <button
                key={query}
                className="rounded-md px-3 py-1.5 text-[12px] transition"
                style={{
                  background: '#1E2433',
                  border: '1px solid #2D3748',
                  color: '#94A3B8',
                }}
                onClick={() => {
                  setInput(query);
                  void submitQuery(query);
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderColor = '#3B82F6';
                  event.currentTarget.style.color = '#E2E8F0';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderColor = '#2D3748';
                  event.currentTarget.style.color = '#94A3B8';
                }}
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form className="border-t border-slate-800 p-4" onSubmit={onSubmit}>
        <div className="flex items-center gap-3">
          <input
            className="h-12 flex-1 rounded-lg px-4 text-[14px] outline-none transition placeholder:text-slate-500"
            style={{
              background: '#0F1117',
              border: '1px solid #2D3748',
              color: '#E2E8F0',
            }}
            placeholder="Ask about orders, billing, products, payments..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-12 rounded-lg px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            style={{ background: loading || !input.trim() ? undefined : '#3B82F6' }}
            onMouseEnter={(event) => {
              if (!loading && input.trim()) {
                event.currentTarget.style.background = '#2563EB';
              }
            }}
            onMouseLeave={(event) => {
              if (!loading && input.trim()) {
                event.currentTarget.style.background = '#3B82F6';
              }
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
