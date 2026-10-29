import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { BASE_URL } from '../api/client';

// Reads words and sentences aloud in the language being learned.
//
// 1. Recorded voice first: backend/generate_tts.py makes a normal and a slow recording of every word and
//    sentence in the lessons (Azure neural voices). They sound the same on every phone and browser.
// 2. The phone's / browser's own voice is the fallback, for any text without a recording (or if the
//    recordings cannot be reached). Many phones have no voice for the language, so this can sound wrong.
//
// The language is set when the app learns it (see api/app.js), e.g. 'fr-FR', 'es-ES', 'zh-CN'.
const IS_WEB = Platform.OS === 'web';

let locale = 'fr-FR';
let normalRate = 0.9;

const RATES = { normal: 0.9, slow: 0.65 };
export const SLOW_RATE = 0.55; // the "Slow" buttons on the cards
const SLOW_BELOW = 0.7; // any rate at or under this plays the slow recording

export function setSpeechLocale(next) {
  if (next) {
    locale = next;
    loadClips();
  }
}

// 'slow' | 'normal': the learner's speed setting for every voice line.
export function setSpeechRate(speed) {
  normalRate = RATES[speed] ?? RATES.normal;
}

// ---- The list of recordings ---------------------------------------------------------------------
// /media/tts/<lang>/manifest.json: { clips: { "<text>": "<id>" } }, files "<id>.mp3" and "<id>-s.mp3" (slow).
const clipSets = {}; // lang -> { state: 'loading' | 'ready' | 'none', map, at }
const langOf = () => locale.split('-')[0].toLowerCase();

function loadClips() {
  const lang = langOf();
  const set = clipSets[lang];
  if (set && (set.state === 'ready' || set.state === 'loading')) return;
  if (set && set.state === 'none' && Date.now() - set.at < 60000) return; // try again after a minute
  clipSets[lang] = { state: 'loading', map: {}, at: Date.now() };
  fetch(`${BASE_URL}/media/tts/${lang}/manifest.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((m) => { clipSets[lang] = { state: 'ready', map: (m && m.clips) || {}, at: Date.now() }; })
    .catch(() => { clipSets[lang] = { state: 'none', map: {}, at: Date.now() }; });
}

function clipUrl(text, slow) {
  const lang = langOf();
  const set = clipSets[lang];
  if (!set || set.state !== 'ready') {
    loadClips(); // not loaded yet: use the phone's voice this time
    return null;
  }
  const id = set.map[String(text || '').trim()];
  return id ? `${BASE_URL}/media/tts/${lang}/${id}${slow ? '-s' : ''}.mp3` : null;
}

// ---- Playing a recording ------------------------------------------------------------------------
const CLIP_START_TIMEOUT = 8000; // if a recording has not started by then, use the phone's voice
let clipCurrent = null; // { stop() } of the recording being played

// Web: ONE audio element for the whole app. Phones (iPhone especially) allow sound on an element
// the learner has already started with a tap, so later lines can start by themselves.
let webAudio = null;
const getWebAudio = () => {
  if (!webAudio) {
    webAudio = new window.Audio();
    webAudio.preload = 'auto';
  }
  return webAudio;
};

const SILENT_WAV = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

// The first tap anywhere "unlocks" the audio element, so a line that starts by itself later still plays.
function installUnlock() {
  if (!IS_WEB || typeof document === 'undefined') return;
  const unlock = () => {
    document.removeEventListener('touchend', unlock, true);
    document.removeEventListener('click', unlock, true);
    if (clipCurrent) return; // a real recording is already starting in this tap
    try {
      const a = getWebAudio();
      a.src = SILENT_WAV;
      const p = a.play();
      if (p && p.then) p.then(() => { if (!clipCurrent) a.pause(); }).catch(() => {});
    } catch (e) { /* not important */ }
  };
  document.addEventListener('touchend', unlock, true);
  document.addEventListener('click', unlock, true);
}
installUnlock();

function webDriver(url, ev) {
  const a = getWebAudio();
  a.onplaying = ev.playing;
  a.onended = ev.ended;
  a.onerror = () => ev.failed(new Error('The recording could not be loaded.'));
  a.src = url;
  const p = a.play();
  if (p && p.catch) {
    p.catch((e) => {
      if (e && e.name === 'AbortError') return; // a newer recording took over
      if (e && e.name === 'NotAllowedError') ev.blocked(e); // the browser wants a tap first
      else ev.failed(e);
    });
  }
  return {
    release: () => {
      a.onplaying = a.onended = a.onerror = null;
      try { a.pause(); } catch (e) { /* already stopped */ }
    },
  };
}

function nativeDriver(url, ev) {
  try { setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); } catch (e) { /* ignore */ }
  const player = createAudioPlayer({ uri: url });
  const sub = player.addListener('playbackStatusUpdate', (s) => {
    if (s.playing) ev.playing();
    if (s.didJustFinish) ev.ended();
  });
  player.play();
  return {
    release: () => {
      try { sub?.remove?.(); } catch (e) { /* gone */ }
      try { player.pause?.(); player.remove?.(); } catch (e) { /* gone */ }
    },
  };
}

// Plays one recording and reports through the same callbacks as the phone's voice.
// If it cannot be played (missing file, slow network), `useVoice()` speaks the text with the phone's voice.
function playClip(url, options, useVoice) {
  let started = false;
  let finished = false;
  let handle = null;
  const entry = { stop: () => finish(options.onStopped) };
  const settle = () => {
    clearTimeout(timer);
    if (clipCurrent === entry) clipCurrent = null;
    try { if (handle) handle.release(); } catch (e) { /* ignore */ }
  };
  function finish(cb, arg) {
    if (finished) return;
    finished = true;
    settle();
    if (cb) cb(arg);
  }
  const toVoice = () => {
    if (finished) return;
    finished = true;
    settle();
    useVoice();
  };
  const timer = setTimeout(() => { if (!started) toVoice(); }, CLIP_START_TIMEOUT);
  clipCurrent = entry;

  const events = {
    playing: () => {
      if (started || finished) return;
      started = true;
      clearTimeout(timer);
      if (options.onStart) options.onStart();
    },
    ended: () => finish(options.onDone),
    failed: (e) => (started ? finish(options.onError, e) : toVoice()),
    blocked: (e) => finish(options.onError, e),
  };
  try {
    handle = IS_WEB ? webDriver(url, events) : nativeDriver(url, events);
  } catch (e) {
    toVoice();
  }
}

function stopClip() {
  if (clipCurrent) clipCurrent.stop();
}

// ---- The phone's / browser's own voice (fallback) -----------------------------------------------
// On the web this talks to the browser's speech engine directly (the same calls as audio-test.html).
const synth = IS_WEB && typeof window !== 'undefined' ? window.speechSynthesis || null : null;
const canSpeakOnWeb = () => !!synth && typeof window.SpeechSynthesisUtterance === 'function';

let webCurrent = null; // the line being spoken: { u, finished }
let webTimer = null;

const isInterruption = (e) => e && (e.error === 'interrupted' || e.error === 'canceled');

function webSpeak(text, options) {
  const { language, rate, onStart, onDone, onStopped, onError } = options;
  if (!canSpeakOnWeb()) {
    if (onError) onError(new Error('This browser cannot read text aloud.'));
    return;
  }
  clearTimeout(webTimer);

  const mine = { u: null, finished: false };
  const finish = (cb, arg) => {
    if (mine.finished) return;
    mine.finished = true;
    if (webCurrent === mine) webCurrent = null;
    if (cb) cb(arg);
  };

  const run = () => {
    if (webCurrent !== mine) return; // a newer line took over while we waited
    const u = new window.SpeechSynthesisUtterance(text);
    mine.u = u; // keep a reference: Chrome can drop the "end" event of an utterance that was garbage collected
    u.lang = language;
    u.rate = rate;
    u.onstart = () => { if (onStart) onStart(); };
    u.onend = () => finish(onDone);
    u.onerror = (e) => (isInterruption(e) ? finish(onStopped) : finish(onError, e));
    try {
      synth.speak(u);
      if (synth.paused) synth.resume(); // some Android browsers leave the engine paused
    } catch (e) {
      finish(onError, e);
    }
  };

  const previous = webCurrent;
  webCurrent = mine;
  if (synth.speaking || synth.pending || previous) {
    // Cancel the old line, then give the engine a moment before starting the new one.
    try { synth.cancel(); } catch (e) { /* ignore */ }
    webTimer = setTimeout(run, 120);
  } else {
    run(); // nothing to cancel: speak right away, inside the learner's tap
  }
}

function webStop() {
  clearTimeout(webTimer);
  webCurrent = null;
  try { if (synth) synth.cancel(); } catch (e) { /* ignore */ }
}

function speakWithVoice(text, options) {
  if (IS_WEB) {
    webSpeak(text, options);
    return;
  }
  Speech.stop();
  Speech.speak(text, options);
}

function stopVoice() {
  if (IS_WEB) webStop();
  else Speech.stop();
}

// ---- What the screens call ----------------------------------------------------------------------
// handlers may contain callbacks (onStart, onDone, onStopped, onError) and `rate` to speak at a different speed.
export function speakText(text, handlers = {}) {
  const options = { language: locale, rate: normalRate, ...handlers };
  stopClip();
  const url = clipUrl(text, options.rate <= SLOW_BELOW);
  if (url) {
    if (!IS_WEB || (synth && (synth.speaking || synth.pending))) stopVoice();
    playClip(url, options, () => speakWithVoice(text, options));
    return;
  }
  speakWithVoice(text, options);
}

// The old name, kept so the screens that already use it keep working in every language.
export const speakFrench = speakText;

export function stopSpeaking() {
  stopClip();
  if (!IS_WEB || webCurrent || (synth && (synth.speaking || synth.pending))) stopVoice();
}
