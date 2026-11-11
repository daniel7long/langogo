import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { pingUsage } from '../api/app';

const EVERY_MS = 30000;

// Counts the time the learner spends in the app: every 30 seconds while the app is open and in front, it tells the
// server how many seconds passed. Nothing is sent while the app is in the background or the tab is hidden.
// `area` ('freetalk' or null) says which part of the app the learner is in, so the time in Free Talk is counted separately.
export default function useUsagePing(active, area = null) {
  const areaRef = useRef(area);
  const flushRef = useRef(() => {});
  useEffect(() => {
    // Moving into or out of Free Talk: send the time so far to the area it belongs to.
    flushRef.current();
    areaRef.current = area;
  }, [area]);

  useEffect(() => {
    if (!active) return undefined;
    const visible = () => (Platform.OS === 'web' && typeof document !== 'undefined' ? !document.hidden : AppState.currentState === 'active');
    let last = Date.now();
    let first = true;
    const flush = () => {
      const now = Date.now();
      const seconds = Math.round((now - last) / 1000);
      last = now;
      if (!visible() || seconds < 1) return;
      pingUsage(Math.min(seconds, 90), first, areaRef.current);
      first = false;
    };
    flushRef.current = flush;
    const timer = setInterval(flush, EVERY_MS);
    const onChange = () => {
      if (visible()) last = Date.now(); // coming back: start counting from now, not from before
      else flush(); // leaving: send what is left
    };
    const sub = AppState.addEventListener('change', onChange);
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', onChange);
    return () => {
      clearInterval(timer);
      sub.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onChange);
    };
  }, [active]);
}
