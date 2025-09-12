// Centralized API configuration
// Prefer a single base URL with optional per-endpoint overrides.

const trim = (s) => (typeof s === 'string' ? s.trim() : '');
const noTrail = (s) => s.replace(/\/+$/g, '');

const V = import.meta.env || {};

// Derive base from explicit base or from provided URLs
const rawBase = trim(V.VITE_API_BASE);
const apiUrlMaybeBase = trim(V.VITE_API_URL);
const explicitQueryUrl = trim(V.VITE_AGENT_QUERY_URL);
const originOf = (url) => {
  try {
    const u = new URL(url, window.location.origin);
    return `${u.protocol}//${u.host}`;
  } catch (_) { return ''; }
};
let apiBase = '';
if (rawBase) {
  apiBase = noTrail(rawBase);
} else if (apiUrlMaybeBase) {
  apiBase = noTrail(originOf(apiUrlMaybeBase));
} else if (explicitQueryUrl) {
  apiBase = noTrail(originOf(explicitQueryUrl));
}

// Allow overriding endpoint paths; otherwise use conventional paths
const EP_QUERY_PATH = trim(V.VITE_ENDPOINT_AGENT_QUERY) || '/agent/query';
const EP_LIST_PATH = trim(V.VITE_ENDPOINT_AGENT_LIST) || '/agent/list';
const EP_UPLOAD_PATH = trim(V.VITE_ENDPOINT_UPLOAD_SIMPLE) || '/upload/simple';
// Allow explicit full URLs to override everything (only via dedicated vars)
// If you set VITE_AGENT_QUERY_URL, it will be used as-is; otherwise we append paths to apiBase
const explicitListUrl = trim(V.VITE_AGENT_LIST_URL);
const explicitUploadUrl = trim(V.VITE_UPLOAD_URL);

export const endpoints = {
  agentQuery: explicitQueryUrl || (apiBase ? apiBase + EP_QUERY_PATH : ''),
  agentList: explicitListUrl || (apiBase ? apiBase + EP_LIST_PATH : ''),
  uploadSimple: explicitUploadUrl || (apiBase ? apiBase + EP_UPLOAD_PATH : ''),
};

export const getApiBase = () => apiBase;
