import * as Speech from 'expo-speech';

// Reads text aloud with the phone's / browser's built-in voice, in the language being learned.
// The language is set when the app learns it (see api/app.js), e.g. 'fr-FR', 'es-ES', 'zh-CN'.
let locale = 'fr-FR';
let normalRate = 0.9;

const RATES = { normal: 0.9, slow: 0.65 };
export const SLOW_RATE = 0.55; // the "Slow" buttons on the cards

export function setSpeechLocale(next) {
  if (next) locale = next;
}

// 'slow' | 'normal': the learner's speed setting for every voice line.
export function setSpeechRate(speed) {
  normalRate = RATES[speed] ?? RATES.normal;
}

// handlers may contain Speech callbacks (onDone, ...) and `rate` to speak at a different speed.
export function speakText(text, handlers = {}) {
  Speech.stop();
  Speech.speak(text, { language: locale, rate: normalRate, ...handlers });
}

// The old name, kept so the screens that already use it keep working in every language.
export const speakFrench = speakText;

export function stopSpeaking() {
  Speech.stop();
}
