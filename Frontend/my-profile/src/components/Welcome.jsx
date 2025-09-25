import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAgents } from '../lib/apiClient';
import { getAgentRoutePath } from '../lib/agentRegistry';

export default function Welcome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agents, setAgents] = useState([]);
  const [capQuery, setCapQuery] = useState(''); // typeahead for capabilities
  const [selectedCaps, setSelectedCaps] = useState([]); // array of normalized capability keys

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
    const target = getAgentRoutePath(agentId);
    navigate(target);
  };

  // Helpers to normalize capability keys and labels consistently
  const capKey = useCallback((s) => String(s || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim(), []);
  const capLabel = useCallback((s) => {
    const raw = String(s || '');
    const lc = capKey(raw);
    if (lc === 'ai' || lc.includes('gpt') || lc.includes('llm')) return 'AI';
    return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }, [capKey]);

  // Compute available capability filters from loaded agents
  const allCaps = useMemo(() => {
    const set = new Map(); // key -> label
    for (const a of agents) {
      const caps = Array.isArray(a.capabilities) ? a.capabilities : [];
      if (caps.length) {
        for (const c of caps) {
          const k = capKey(c);
          if (!k) continue;
          if (!set.has(k)) set.set(k, capLabel(c));
        }
      } else if (a.uploadEnabled) {
        // Back-compat: treat uploadEnabled as a capability for filtering
        if (!set.has('upload')) set.set('upload', 'Upload');
      }
    }
    const arr = Array.from(set, ([key, label]) => ({ key, label }));
    // Sort: AI first, then Upload, then alphabetical
    arr.sort((a, b) => {
      const order = (k) => (k.key === 'ai' ? 0 : k.key === 'upload' ? 1 : 2);
      const oa = order(a), ob = order(b);
      if (oa !== ob) return oa - ob;
      return a.label.localeCompare(b.label);
    });
    return arr;
  }, [agents, capKey, capLabel]);

  const toggleCap = (key) => {
    setSelectedCaps((prev) => {
      const k = capKey(key);
      if (prev.includes(k)) return prev.filter((x) => x !== k);
      return [...prev, k];
    });
  };

  const clearFilters = () => {
    setCapQuery('');
    setSelectedCaps([]);
  };

  const filteredAgents = useMemo(() => {
    const needCaps = selectedCaps.map(capKey);
    return agents.filter((a) => {
      // Capabilities match: require all selected present
      if (needCaps.length) {
        const caps = Array.isArray(a.capabilities) ? a.capabilities : [];
        const keys = new Set(
          caps.length ? caps.map(capKey) : (a.uploadEnabled ? ['upload'] : [])
        );
        for (const c of needCaps) if (!keys.has(c)) return false;
      }
      return true;
    });
  }, [agents, capKey, selectedCaps]);

  // Suggestions for capability query (typeahead)
  const capSuggestions = useMemo(() => {
    const q = capQuery.trim().toLowerCase();
    if (!q) return [];
    return allCaps
      .filter(({ key, label }) => !selectedCaps.includes(key) && (key.includes(q) || label.toLowerCase().includes(q)))
      .slice(0, 12);
  }, [allCaps, capQuery, selectedCaps]);

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
          {/* Capability search & filters */}
          <div className="mb-3">
            <div className="sm:flex sm:items-start sm:gap-2">
              <div className="sm:flex-1">
                <input
                  value={capQuery}
                  onChange={(e) => setCapQuery(e.target.value)}
                  placeholder="Search capabilities (e.g., upload, vision, rag)"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  aria-label="Search capabilities"
                />
                {capSuggestions.length > 0 && (
                  <div className="mt-1 rounded-md border border-slate-300 bg-white p-2 shadow max-h-40 overflow-auto">
                    <div className="flex flex-wrap gap-1.5">
                      {capSuggestions.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { toggleCap(key); setCapQuery(''); }}
                          className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {selectedCaps.length > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-2 sm:mt-0 shrink-0 inline-flex items-center h-8 px-3 rounded-md border text-xs text-slate-600 hover:bg-slate-100"
                  title="Clear filters"
                >
                  Clear
                </button>
              )}
            </div>
            {selectedCaps.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-slate-600 mb-1">Active filters:</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCaps.map((key) => {
                    const label = allCaps.find((c) => c.key === key)?.label || capLabel(key);
                    return (
                      <span key={key} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                        {label}
                        <button type="button" className="ml-1 text-slate-500 hover:text-slate-800" onClick={() => toggleCap(key)} aria-label={`Remove ${label}`}>
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mt-1 text-xs text-slate-500">Showing {filteredAgents.length} of {agents.length}</div>
          </div>
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
            {filteredAgents.map((a) => {
              const caps = Array.isArray(a.capabilities) ? a.capabilities : [];
              const hasCaps = caps.length > 0;

              // AI capability detection (controls subtle star on card)
              const isAiCap = (capLc) => ['ai', 'gpt', 'llm'].some((k) => capLc === k || capLc.includes(k));

              return (
                <div key={a.id} className="relative border rounded-xl p-4 pb-16 bg-white shadow-sm">
                  {/* Simple AI stars (top-right) */}
                  {hasCaps && caps.some((c) => isAiCap(String(c).toLowerCase())) && (
                    <div className="absolute top-2 right-2">
                      <span className="text-indigo-500" title="AI enabled" aria-label="AI enabled">✦</span>
                    </div>
                  )}

                  {/* Header: name */}
                  <div className="font-medium text-slate-900 text-lg pr-8">{a.label}</div>

                  {/* Description */}
                  {a.description && (
                    <div className="text-sm text-slate-600 mt-1">{a.description}</div>
                  )}

                  {/* Capabilities under description */}
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {hasCaps ? (
                        caps.map((cap, idx) => {
                          const capStr = String(cap);
                          const pretty = capStr.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
                          return (
                            <span key={`${a.id}-${idx}`} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">{pretty}</span>
                          );
                        })
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded ${a.uploadEnabled ? 'bg-slate-100 text-slate-800 border border-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                          {a.uploadEnabled ? 'Upload' : 'No Uploads'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Minimal CTA (lower-right, text-only) */}
                  <button
                    type="button"
                    className="absolute bottom-4 right-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 group focus:outline-none"
                    onClick={() => onSelectAgent(a.id)}
                    aria-label={`Let's get started with ${a.label}`}
                  >
                    <span className="bg-gradient-to-r from-fuchsia-500 to-indigo-600 bg-clip-text text-transparent">Let’s get started</span>
                    <span aria-hidden className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">→</span>
                  </button>
                </div>
              );
            })}
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
