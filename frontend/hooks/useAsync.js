import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// Loads data when the screen comes into focus, and again every time it is focused later,
// so lists refresh after you finish a lesson. The old data stays on screen while it reloads.
export default function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const latest = useRef(0);

  const run = useCallback(async () => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      if (id === latest.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === latest.current) setState((s) => ({ ...s, loading: false, error }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      run();
    }, [run])
  );

  return { ...state, reload: run };
}
