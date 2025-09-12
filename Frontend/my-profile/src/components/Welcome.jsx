import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAgents } from '../lib/apiClient';

export default function Welcome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { list } = await listAgents();
        if (isActive) setAgents(list);
      } catch (err) {
        console.error(err);
        const msg = err?.message || 'Error fetching agents.';
        if (isActive) setError(msg);
      } finally {
        if (isActive) setLoading(false);
      }
    };
    load();
    return () => { isActive = false; };
  }, []);

  const onSelectAgent = (agentId) => {
    navigate(`/ai/${encodeURIComponent(agentId)}`);
  };

  return (
    <div className="text-gray-800">
      <div className="max-w-6xl mx-auto px-2 sm:px-6 py-1 sm:py-2">
        {/* Header (match AI Assistant style) */}
        <div className="border-b-2 border-gray-200">
          <div className="flex sm:items-center justify-between py-1">
            <div className="relative flex items-center space-x-4">
              <div className="flex flex-col leading-tight">
                <div className="text-xl sm:text-2xl mt-1 flex items-center">
                  <span className="text-gray-700 mr-3">Welcome</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">
            Choose an AI agent below to start a conversation. You can switch agents anytime; sessions are kept per agent.
          </p>
        </div>

        {/* Content card (match AI Assistant) */}
        <div className="mt-2 rounded-2xl bg-gray-100 p-3 sm:p-4">
          {/* Agents listed via centralized API config */}
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
              <div key={a.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="font-medium text-slate-900 flex items-center justify-between">
                  <span>{a.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${a.uploadEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {a.uploadEnabled ? 'Uploads On' : 'No Uploads'}
                  </span>
                </div>
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
      </div>
    </div>
  );
}
