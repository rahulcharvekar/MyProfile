import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const navigate = useNavigate();
  const QUERY_URL = import.meta.env.VITE_AGENT_QUERY_URL || import.meta.env.VITE_API_URL;
  const AGENT_LIST_URL = useMemo(() => {
    const fromEnv = import.meta.env.VITE_AGENT_LIST_URL;
    if (fromEnv) return fromEnv;
    try {
      const u = new URL(String(QUERY_URL || ''), window.location.origin);
      return `${u.protocol}//${u.host}/agent/getall`;
    } catch (_) {
      return '';
    }
  }, [QUERY_URL]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (!AGENT_LIST_URL) return;
      setLoading(true);
      setError('');
      try {
        const res = await fetch(AGENT_LIST_URL);
        let data = null;
        try { data = await res.json(); } catch (_) { /* noop */ }
        if (!res.ok) {
          const fallbackText = data?.error || data?.message || 'Failed to load agents.';
          throw new Error(String(fallbackText));
        }
        let list = [];
        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data?.agents)) list = data.agents;
        else if (Array.isArray(data?.data?.agents)) list = data.data.agents;
        else if (Array.isArray(data?.data)) list = data.data;
        else if (data?.agents && typeof data.agents === 'object') {
          list = Object.entries(data.agents).map(([key, val]) => ({ id: key, ...(val || {}) }));
        }
        const normalized = list.map((it, idx) => {
          const rawId = String(it?.id ?? it?.agent_id ?? it?.name ?? idx);
          const human = (it?.label || it?.name || it?.title || rawId)
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (m) => m.toUpperCase());
          return {
            id: rawId,
            label: human,
            description: it?.description || '',
          };
        });
        if (isActive) setAgents(normalized);
      } catch (err) {
        console.error(err);
        if (isActive) setError(err?.message || 'Error fetching agents.');
      } finally {
        if (isActive) setLoading(false);
      }
    };
    load();
    return () => { isActive = false; };
  }, [AGENT_LIST_URL]);

  const onSelectAgent = (agentId) => {
    navigate(`/ai/${encodeURIComponent(agentId)}`);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Welcome 👋</h1>
      <p className="text-gray-700 mb-4">Pick an agent to start chatting.</p>

      {!AGENT_LIST_URL && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 text-amber-800 p-3">
          Note: Set VITE_AGENT_LIST_URL or VITE_API_URL so we can fetch agents.
        </div>
      )}

      {loading && (
        <div className="mb-4 flex items-center gap-2 text-slate-600">
          <span className="inline-block h-4 w-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          Loading agents…
        </div>
      )}
      {error && (
        <div className="mb-4 rounded border border-rose-300 bg-rose-50 text-rose-800 p-3">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((a) => (
          <div key={a.id} className="border rounded-lg p-4 bg-white">
            <div className="font-medium text-slate-900">{a.label}</div>
            {a.description && (
              <div className="text-sm text-slate-600 mt-1 line-clamp-3">{a.description}</div>
            )}
            <button
              type="button"
              className="mt-3 inline-flex items-center rounded bg-indigo-600 text-white px-3 py-1.5 text-sm hover:bg-indigo-500"
              onClick={() => onSelectAgent(a.id)}
            >
              Chat with {a.label}
            </button>
          </div>
        ))}
      </div>

      {!loading && !error && agents.length === 0 && (
        <div className="rounded-lg border bg-slate-50 p-4 text-slate-700">
          No agents available. Try again later or go directly to the AI Assistant.
          <div className="mt-2">
            <button
              type="button"
              className="inline-flex items-center rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
              onClick={() => navigate('/ai')}
            >
              Open AI Assistant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
