// Small utilities used by AIAssistant

export const normalizeNewlines = (text) => String(text || "").trim().replace(/\\n/g, "\n");

export const makePrettyIdLabel = (id) => {
  if (!id) return '';
  return String(id)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
};

export const getOrCreateSessionId = (key = 'ai_session_id') => {
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const sid = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, sid);
    return sid;
  } catch {
    return `web-${Date.now()}`;
  }
};

export const validateAttachment = (file, { acceptRe, maxBytes }) => {
  if (!file) return { ok: false, error: 'No file' };
  if (typeof maxBytes === 'number' && file.size > maxBytes) {
    return { ok: false, error: 'File too large' };
  }
  if (acceptRe && !acceptRe.test(file.name)) {
    return { ok: false, error: 'Unsupported file type' };
  }
  return { ok: true };
};

export const makeWelcomeText = ({ apiWelcome, agentTitle, agentHint }) => {
  const apiW = normalizeNewlines(apiWelcome);
  if (apiW) return apiW;
  const defaultWelcome = `👋 You are now chatting with ${agentTitle || 'the selected'} agent.`;
  return normalizeNewlines(`${defaultWelcome} ${agentHint}`.trim());
};

export const parseBotResponse = (data) => {
  if (!data) return '✅ Done.';
  if (typeof data?.response === 'string' && data.response) return data.response;
  if (typeof data === 'string' && data) return data;
  if (data?.message) return data.message;
  return '✅ Done.';
};
