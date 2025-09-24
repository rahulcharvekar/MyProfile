import { useEffect, useState } from 'react';
import { listAgents } from '../lib/apiClient';

export default function useAgentMeta(agentId) {
  const [state, setState] = useState({
    label: '',
    description: '',
    welcomeMessage: '',
    isUploadEnabled: true,
  });

  useEffect(() => {
    let isActive = true;
    const run = async () => {
      if (!agentId) return;
      try {
        const { byId } = await listAgents();
        const entry = byId[agentId];
        if (!entry) return;
        const caps = Array.isArray(entry.capabilities) ? entry.capabilities : [];
        let isUploadEnabled = true;
        if (caps.length) {
          isUploadEnabled = caps.some((c) => typeof c === 'string' && c.toLowerCase().includes('upload'));
        } else if (typeof entry.uploadEnabled === 'boolean') {
          isUploadEnabled = entry.uploadEnabled;
        }
        if (!isActive) return;
        setState({
          label: entry.label || '',
          description: entry.description || '',
          welcomeMessage: entry.welcomeMessage || '',
          isUploadEnabled: Boolean(isUploadEnabled),
        });
      } catch (_) {
        // ignore
      }
    };
    run();
    return () => { isActive = false; };
  }, [agentId]);

  return state;
}
