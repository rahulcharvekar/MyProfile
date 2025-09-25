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
  } catch { return ''; }
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
// For agent-specific endpoints, use templates with {agent}
const EP_QUERY_PATH_TMPL = trim(V.VITE_ENDPOINT_AGENT_QUERY) || '/agent/{agent}/query';
const EP_LIST_PATH = trim(V.VITE_ENDPOINT_AGENT_LIST) || '/agent/list';
const EP_FILES_PATH_TMPL = trim(V.VITE_ENDPOINT_AGENT_FILES) || '/agent/{agent}/listfiles';
const EP_UPLOAD_PATH = trim(V.VITE_ENDPOINT_UPLOAD_SIMPLE) || '/upload/simple';
// Allow explicit full URLs to override everything (only via dedicated vars)
// If you set VITE_AGENT_QUERY_URL, it will be used as-is (and may include {agent}); otherwise we append paths to apiBase
const explicitListUrl = trim(V.VITE_AGENT_LIST_URL);
const explicitUploadUrl = trim(V.VITE_UPLOAD_URL);

const replaceAgent = (template, agent) => String(template || '').replace('{agent}', encodeURIComponent(String(agent || '')));

const buildUrl = (pathOrUrl) => {
  if (!pathOrUrl) return '';
  // If it's an absolute URL, return as-is; else prefix with apiBase
  try {
    const u = new URL(pathOrUrl);
    return u.toString();
  } catch {
    // not absolute
  }
  return apiBase ? noTrail(apiBase) + pathOrUrl : '';
};

export const endpoints = {
  // Legacy, kept for backward compatibility (may be empty if template form is used)
  agentQuery: explicitQueryUrl && !explicitQueryUrl.includes('{agent}')
    ? explicitQueryUrl
    : '',
  agentList: explicitListUrl || (apiBase ? apiBase + EP_LIST_PATH : ''),
  uploadSimple: explicitUploadUrl || (apiBase ? apiBase + EP_UPLOAD_PATH : ''),
};

export const getAgentQueryUrl = (agent) => {
  // Prefer explicit URL if provided; support {agent} token
  if (explicitQueryUrl) {
    const src = explicitQueryUrl.includes('{agent}')
      ? replaceAgent(explicitQueryUrl, agent)
      : explicitQueryUrl; // treat as absolute non-templated URL
    return src;
  }
  const path = replaceAgent(EP_QUERY_PATH_TMPL, agent);
  return buildUrl(path);
};

export const getAgentListFilesUrl = (agent) => {
  const path = replaceAgent(EP_FILES_PATH_TMPL, agent);
  return buildUrl(path);
};

export const getApiBase = () => apiBase;
