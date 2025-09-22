import { useRef } from 'react';
import { getOrCreateSessionId } from '../lib/chatUtils';

export default function useSessionId(key = 'ai_session_id') {
  const ref = useRef(null);
  if (!ref.current) {
    ref.current = getOrCreateSessionId(key);
  }
  return ref.current;
}

