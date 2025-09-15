import { endpoints } from './apiConfig';

const toPrettyLabel = (idOrName) => String(idOrName || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (m) => m.toUpperCase());

const parseUploadFlag = (entry) => {
  const raw = entry?.isuploadrequired ?? entry?.is_upload_require ?? entry?.upload_required ?? entry?.allow_upload ?? entry?.enable_upload;
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    if (['yes', 'true', '1'].includes(v)) return true;
    if (['no', 'false', '0'].includes(v)) return false;
    return true;
  }
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  return true; // default allow
};

// simple in-memory cache for agent list
let _agentsCache = null; // { at: number, value: { raw, list, byId } }
const AGENTS_TTL_MS = 60_000; // 60s

export async function listAgents(signal, { force = false } = {}) {
  if (!endpoints.agentList) return { raw: null, list: [], byId: {} };
  const now = Date.now();
  if (!force && _agentsCache && (now - _agentsCache.at) < AGENTS_TTL_MS) {
    return _agentsCache.value;
  }

  const res = await fetch(endpoints.agentList, { signal });
  let data = null;
  try { data = await res.json(); } catch (_) { /* noop */ }
  if (!res.ok) {
    return { raw: data, list: [], byId: {} };
  }

  // Normalize various shapes
  let list = [];
  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data?.agents)) list = data.agents;
  else if (Array.isArray(data?.data?.agents)) list = data.data.agents;
  else if (Array.isArray(data?.data)) list = data.data;
  else if (data?.agents && typeof data.agents === 'object') {
    list = Object.entries(data.agents).map(([key, val]) => ({ id: key, ...(val || {}) }));
  }

  const normalized = list.map((it, idx) => {
    const id = String(it?.id ?? it?.agent_id ?? it?.name ?? idx);
    return {
      id,
      label: toPrettyLabel(it?.label || it?.name || it?.title || id),
      description: it?.description,
      welcomeMessage: it?.welcomemessage,
      uploadEnabled: parseUploadFlag(it),
      raw: it,
    };
  });

  const byId = Object.fromEntries(normalized.map((a) => [a.id, a]));
  const value = { raw: data, list: normalized, byId };
  _agentsCache = { at: now, value };
  return value;
}

export async function queryAgent({ input, agent, sessionId }, signal) {
  if (!endpoints.agentQuery) throw new Error('Agent query endpoint not configured');
  const res = await fetch(endpoints.agentQuery, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, agent, session_id: sessionId }),
    signal,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* noop */ }
  if (!res.ok) {
    let textFallback = '';
    try { textFallback = await res.text(); } catch (_) { /* noop */ }
    const errText = data?.error || data?.message || textFallback || 'Request failed';
    const err = new Error(String(errText));
    err.data = data;
    throw err;
  }
  return data;
}

export async function uploadFile(file, { agent, signal } = {}) {
  if (!endpoints.uploadSimple) throw new Error('Upload endpoint not configured');
  const formData = new FormData();
  formData.append('file', file, file.name);
  // Build URL and append optional agent query param
  let url;
  try {
    url = new URL(endpoints.uploadSimple, window.location.origin);
  } catch (_) {
    // Fallback: assume relative path
    url = new URL(String(endpoints.uploadSimple || '/'), window.location.origin);
  }
  if (agent) url.searchParams.set('agent', String(agent));
  const res = await fetch(url.toString(), { method: 'POST', body: formData, signal });
  let data = null;
  try { data = await res.json(); } catch (_) { /* noop */ }
  if (!res.ok) {
    const err = new Error(String(data?.error || data?.message || 'Upload failed'));
    err.data = data;
    throw err;
  }
  return data;
}
