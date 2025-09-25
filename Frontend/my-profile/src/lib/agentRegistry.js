export const agentRegistry = {
  dochelp: {
    path: '/dochelp',
  },
};

export const getAgentRoutePath = (agentId) => {
  if (!agentId) return '/welcome';
  const key = String(agentId).trim();
  const entry = agentRegistry[key];
  if (entry?.path) return entry.path;
  return `/ai/${encodeURIComponent(key)}`;
};
