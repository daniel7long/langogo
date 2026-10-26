import { setSpeechRate } from './speech';

// The learner's settings (Settings screen), kept in memory so every screen reads the same values.
// The backend keeps the saved copy; api/app.js calls applySettings() whenever it receives them.
export const DEFAULT_SETTINGS = { speech_speed: 'normal', show_translation: true, effects: true };

let current = { ...DEFAULT_SETTINGS };
let loaded = false;
const listeners = new Set();

export function getSettings() {
  return current;
}
export function settingsLoaded() {
  return loaded;
}
export function applySettings(next) {
  if (!next) return;
  current = { ...DEFAULT_SETTINGS, ...next };
  loaded = true;
  setSpeechRate(current.speech_speed);
  listeners.forEach((fn) => fn(current));
}
export function subscribeSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
