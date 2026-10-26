import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

import { BASE_URL } from '../api/client';
import { SLOW_RATE, speakFrench, stopSpeaking } from '../utils/speech';

const IS_WEB = Platform.OS === 'web';

// Everything the speaking screen needs from the audio system:
//   playLine({ text, audioUrl, slow })  plays a dialogue line (recorded voice if there is one, else the
//                                 built-in voice; `slow` always uses the built-in voice, slowed down).
//                                 Resolves 'done' | 'cancelled' | 'blocked'.
//   playRecording(uri)            plays the user's own take. Resolves 'done' | 'cancelled'.
//   stopPlayback()                stops whatever is playing (the pending promise resolves 'cancelled').
//   startRecording()              -> { ok: true } | { ok: false, reason: 'permission' | 'error' }
//   stopRecording()               -> { uri, durationMs } | null
// 'blocked' means the browser refused to play sound before the user touched the page.
export default function useLessonAudio() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const active = useRef(null); // the playback in progress: { finish(result) }
  const startedAt = useRef(0);

  const stopPlayback = useCallback(() => {
    const a = active.current;
    active.current = null;
    if (a) a.finish('cancelled');
    stopSpeaking();
  }, []);

  // Runs one playback. `start(entry, ctx)` begins it and must call entry.finish(result) when it ends.
  const run = useCallback(
    (start) =>
      new Promise((resolve) => {
        stopPlayback();
        const timers = [];
        let player = null;
        let sub = null;
        let settled = false;
        const entry = {
          finish: (result) => {
            if (settled) return;
            settled = true;
            timers.forEach(clearTimeout);
            try { sub?.remove?.(); } catch (e) { /* already gone */ }
            try { player?.pause?.(); player?.remove?.(); } catch (e) { /* already gone */ }
            if (result !== 'done') stopSpeaking();
            if (active.current === entry) active.current = null;
            resolve(result);
          },
        };
        active.current = entry;
        start(entry, {
          after: (fn, ms) => timers.push(setTimeout(fn, ms)),
          attach: (p, s) => { player = p; sub = s; },
        });
      }),
    [stopPlayback]
  );

  const playFile = (entry, ctx, uri, onStarted, onFail) => {
    try {
      const player = createAudioPlayer({ uri });
      const sub = player.addListener('playbackStatusUpdate', (s) => {
        if (s.playing) onStarted();
        if (s.didJustFinish) entry.finish('done');
      });
      ctx.attach(player, sub);
      player.play();
      ctx.after(() => entry.finish('done'), 60000); // safety net
    } catch (e) {
      onFail();
    }
  };

  const playLine = useCallback(
    ({ text, audioUrl, slow }) =>
      run((entry, ctx) => {
        let started = false;
        const onStarted = () => { started = true; };

        // Browsers refuse sound before the user has touched the page. If nothing starts, say so.
        if (IS_WEB) ctx.after(() => { if (!started) entry.finish('blocked'); }, 3000);

        const speak = () => {
          const safety = Math.max(4000, text.length * 120);
          ctx.after(() => entry.finish('done'), safety);
          speakFrench(text, {
            ...(slow ? { rate: SLOW_RATE } : {}),
            onStart: onStarted,
            onDone: () => entry.finish('done'),
            onStopped: () => entry.finish('cancelled'),
            onError: () => {
              if (IS_WEB && !started) { entry.finish('blocked'); return; }
              ctx.after(() => entry.finish('done'), Math.max(1200, text.length * 70)); // let the line "last"
            },
          });
        };

        if (audioUrl && !slow) {
          if (!IS_WEB) ctx.after(() => { if (!started) entry.finish('done'); }, 8000); // file never started
          playFile(entry, ctx, `${BASE_URL}${audioUrl}`, onStarted, speak);
        } else {
          speak();
        }
      }),
    [run]
  );

  const playRecording = useCallback(
    (uri) =>
      run((entry, ctx) => {
        playFile(entry, ctx, uri, () => {}, () => entry.finish('done'));
      }),
    [run]
  );

  const startRecording = useCallback(async () => {
    stopPlayback();
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) return { ok: false, reason: 'permission' };
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'error', message: e?.message };
    }
  }, [recorder, stopPlayback]);

  const stopRecording = useCallback(async () => {
    try {
      await recorder.stop();
    } catch (e) {
      // not recording
    }
    // Back to playback mode, so the replay comes out of the loudspeaker on iOS.
    try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch (e) { /* ignore */ }
    const durationMs = Date.now() - startedAt.current;
    return recorder.uri ? { uri: recorder.uri, durationMs } : null;
  }, [recorder]);

  useEffect(
    () => () => {
      stopPlayback();
      try { if (recorder.isRecording) recorder.stop(); } catch (e) { /* ignore */ }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { playLine, playRecording, stopPlayback, startRecording, stopRecording };
}
