import { useEffect, useState } from 'react';

import { authEnabled, getSnapshot, subscribe } from '../api/auth';

// { enabled, ready, session }: `enabled` is false when the app runs without accounts (no Supabase keys).
export default function useAuth() {
  const [snap, setSnap] = useState(getSnapshot());
  useEffect(() => {
    setSnap(getSnapshot());
    return subscribe(setSnap);
  }, []);
  return { enabled: authEnabled, ready: snap.ready, session: snap.session };
}
