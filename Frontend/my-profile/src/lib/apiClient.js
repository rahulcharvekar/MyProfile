import { endpoints, getAgentQueryUrl, getAgentListFilesUrl } from './apiConfig';

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

// Extract and normalize capabilities from a variety of possible shapes
const normalizeCapabilities = (entry) => {
  let rawCaps = entry?.capabilities ?? entry?.caps ?? entry?.features ?? entry?.abilities;
  let list = [];
  if (Array.isArray(rawCaps)) {
    list = rawCaps;
  } else if (rawCaps && typeof rawCaps === 'object') {
    // treat object keys with truthy values as enabled capabilities
    list = Object.entries(rawCaps)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k);
  } else if (typeof rawCaps === 'string') {
    // split by comma/space/pipe
    list = rawCaps.split(/[\s,|]+/g).filter(Boolean);
  }
  // clean up strings and presentable labels
  const cleaned = list
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/[_-]+/g, ' '));
  return cleaned;
};

const extractFileName = (entry) => {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  if (typeof entry === 'object') {
    const candidates = [
      entry.filename,
      entry.file_name,
      entry.file,
      entry.name,
      entry.title,
      entry.document_name,
      entry.path,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    if (typeof entry.id === 'string' && entry.id.trim()) return entry.id.trim();
    if (typeof entry.id === 'number') return String(entry.id);
    return 'Untitled file';
  }
  return String(entry || '').trim();
};

const normalizeFileNames = (list) => {
  if (!Array.isArray(list)) return [];
  const names = list
    .map((entry) => extractFileName(entry))
    .filter((name) => Boolean(name) && name !== '{}');
  return Array.from(new Set(names));
};

export const resolveUploadedFilename = (payload, fallbackName) => {
  if (!payload) return fallbackName;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed || fallbackName;
  }
  const direct = extractFileName(payload);
  if (direct && direct !== 'Untitled file') return direct;
  if (Array.isArray(payload?.files) && payload.files.length > 0) {
    const fromFiles = extractFileName(payload.files[0]);
    if (fromFiles && fromFiles !== 'Untitled file') return fromFiles;
  }
  if (payload.data) return resolveUploadedFilename(payload.data, fallbackName);
  return fallbackName;
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
  try { data = await res.json(); } catch { /* noop */ }
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
    const capabilities = normalizeCapabilities(it);
    const hasUploadCapability = capabilities.some((c) => c.toLowerCase().includes('upload'));
    return {
      id,
      label: toPrettyLabel(it?.label || it?.name || it?.title || id),
      description: it?.description,
      welcomeMessage: it?.welcomemessage,
      // Prefer capabilities to drive upload visibility; fallback to legacy flags
      uploadEnabled: capabilities.length ? hasUploadCapability : parseUploadFlag(it),
      capabilities,
      raw: it,
    };
  });

  const byId = Object.fromEntries(normalized.map((a) => [a.id, a]));
  const value = { raw: data, list: normalized, byId };
  _agentsCache = { at: now, value };
  return value;
}

export async function resolveAgentPath(agent) {
  if (!agent) return '';
  try {
    const cache = await listAgents();
    const entry = cache?.byId?.[String(agent)] || null;
    if (!entry) return String(agent);
    const raw = entry.raw || {};
    const seg = raw.path || raw.slug || raw.name || entry.id || agent;
    return String(seg);
  } catch {
    return String(agent);
  }
}

export async function queryAgent({ input, agent, sessionId, extraTools, filename, files, payloadMode = 'default' }, signal) {
  const agentSeg = await resolveAgentPath(agent);
  const url = getAgentQueryUrl(agentSeg) || endpoints.agentQuery;
  if (!url) throw new Error('Agent query endpoint not configured');
  const useMinimalPayload = payloadMode === 'minimal';
  let payload;
  if (useMinimalPayload) {
    payload = { input };
    if (filename !== undefined) payload.filename = filename;
  } else {
    payload = {
      input,
      input_text: input,
      agent_name: agent,
    };
    if (sessionId) payload.session_id = sessionId;
    if (Array.isArray(extraTools)) payload.extra_tools = extraTools;
    if (filename !== undefined) payload.filename = filename;
    if (Array.isArray(files) && files.length > 0) payload.files = files;
  }
  console.log(payload)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  let data = null;
  try { data = await res.json(); } catch { /* noop */ }
  if (!res.ok) {
    let textFallback = '';
    try { textFallback = await res.text(); } catch { /* noop */ }
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
  } catch {
    // Fallback: assume relative path
    url = new URL(String(endpoints.uploadSimple || '/'), window.location.origin);
  }
  if (agent) url.searchParams.set('agent', String(agent));
  const res = await fetch(url.toString(), { method: 'POST', body: formData, signal });
  let data = null;
  try { data = await res.json(); } catch { /* noop */ }
  if (!res.ok) {
    const err = new Error(String(data?.error || data?.message || 'Upload failed'));
    err.data = data;
    throw err;
  }
  return data;
}

export async function listAgentFiles(agent, signal) {
  const agentSeg = await resolveAgentPath(agent);
  const url = getAgentListFilesUrl(agentSeg);
  if (!url) return [];
  const res = await fetch(url, { method: 'GET', signal });
  let data = null;
  try { data = await res.json(); } catch { /* noop */ }
  if (!res.ok) return [];
  // Normalize return to array of strings (filenames)
  if (Array.isArray(data)) return normalizeFileNames(data);
  if (Array.isArray(data?.files)) return normalizeFileNames(data.files);
  if (Array.isArray(data?.data?.files)) return normalizeFileNames(data.data.files);
  const guess = normalizeFileNames(Object.values(data || {}));
  if (guess.length) return guess;
  return [];
}
