import { useEffect } from 'react';

export default function useAutoScroll(ref, deps = []) {
  useEffect(() => {
    if (ref?.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

