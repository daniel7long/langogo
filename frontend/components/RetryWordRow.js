import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Waveform from './Waveform';
import useLessonAudio from '../hooks/useLessonAudio';
import { scoreInk, scoreTint } from '../utils/score';
import { colors, radius, shadows, spacing, typography } from '../theme';

const MAX_MS = 15000;
const MIN_MS = 500;

// A word to practice again (F2S5 and F3S5): hear the word, record yourself, hear your take, see the score.
// Tap the mic to start recording and tap it again to stop; the take is sent to onSubmit(word, take),
// which must resolve with { flowers_earned, pronunciation, previous, tip }.
export default function RetryWordRow({ word, onSubmit }) {
  const audio = useLessonAudio();
  const [phase, setPhase] = useState('idle'); // idle | starting | recording | uploading
  const [take, setTake] = useState(null);
  const [replaying, setReplaying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  const phaseRef = useRef('idle');
  const timer = useRef(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const go = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const start = async () => {
    setError(null);
    setReplaying(false);
    go('starting');
    const r = await audio.startRecording();
    if (!alive.current) return;
    if (!r.ok) {
      go('idle');
      setError(
        r.reason === 'permission'
          ? 'Microphone access is needed. Allow it in your browser or phone settings and try again.'
          : "Couldn't start recording. Check your microphone."
      );
      return;
    }
    go('recording');
    timer.current = setTimeout(() => stopRef.current(), MAX_MS);
  };

  const stop = async () => {
    if (phaseRef.current !== 'recording') return;
    clearTimeout(timer.current);
    go('starting');
    const recorded = await audio.stopRecording();
    if (!alive.current) return;
    if (!recorded || recorded.durationMs < MIN_MS) {
      go('idle');
      setError('That was too short. Tap the mic and say the word.');
      return;
    }
    setTake(recorded);
    go('uploading');
    try {
      const r = await onSubmit(word, recorded);
      if (alive.current) setResult(r);
    } catch (e) {
      if (alive.current) setError(e.message);
    }
    if (alive.current) go('idle');
  };
  const stopRef = useRef(stop);
  stopRef.current = stop;

  const onMic = () => {
    if (phase === 'recording') stop();
    else if (phase === 'idle') start();
  };

  const playTake = () => {
    if (replaying) {
      audio.stopPlayback();
      setReplaying(false);
      return;
    }
    setReplaying(true);
    audio.playRecording(take.uri).then(() => alive.current && setReplaying(false));
  };

  const shownScore = result ? result.pronunciation : word.score;
  const recording = phase === 'recording';
  const busy = phase === 'starting' || phase === 'uploading';
  const improved = result && result.previous != null && result.pronunciation > result.previous;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.eyebrow}>{word.kind === 'phrase' ? 'Phrase' : 'Word'}</Text>
        {shownScore != null && (
          <View style={[styles.score, { backgroundColor: scoreTint(shownScore) }]} accessibilityLabel={`Score ${shownScore}`}>
            <Text style={[styles.scoreText, { color: scoreInk(shownScore) }]}>{shownScore}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.word, word.kind === 'phrase' && styles.phrase]}>{word.text}</Text>
      <Text style={styles.tip}>{result?.tip || word.tip}</Text>

      {result && !error && (
        <View style={styles.resultRow}>
          <Ionicons name={improved ? 'trending-up' : 'checkmark-circle-outline'} size={16} color={colors.greenText} />
          <Text style={styles.result}>
            {improved ? `Better! ${result.previous} → ${result.pronunciation}` : `Pronunciation ${result.pronunciation}`}  ·  +{result.flowers_earned} flowers
          </Text>
        </View>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <Pressable
          onPress={() => audio.playLine({ text: word.text })}
          style={styles.play}
          accessibilityRole="button"
          accessibilityLabel={`Play ${word.text}`}
        >
          <Ionicons name="volume-high-outline" size={18} color={colors.primary} />
          <Text style={styles.playText}>Play</Text>
        </Pressable>
        {take && (
          <Pressable
            onPress={playTake}
            style={styles.replay}
            accessibilityRole="button"
            accessibilityLabel={replaying ? 'Stop your recording' : 'Play your recording'}
          >
            <Ionicons name={replaying ? 'pause' : 'play'} size={14} color={colors.primary} />
            {replaying && <Waveform active bars={6} height={14} />}
          </Pressable>
        )}
        <Pressable
          onPress={onMic}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={recording ? `Stop recording ${word.text}` : `Try ${word.text} again`}
          style={[styles.retry, recording && styles.retryOn, busy && styles.retryBusy]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : recording ? (
            <Waveform active color={colors.onPrimary} bars={5} height={16} />
          ) : (
            <Ionicons name="mic" size={18} color={colors.primary} />
          )}
          <Text style={[styles.retryText, recording && { color: colors.onPrimary }]}>
            {recording ? 'Tap to stop' : phase === 'uploading' ? 'Checking…' : 'Try again'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 4,
    ...shadows.card(),
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { ...typography.eyebrow, color: '#9A5B2E' },
  score: { minWidth: 46, height: 32, paddingHorizontal: 12, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  scoreText: { ...typography.label },
  word: { ...typography.headline, color: colors.text },
  phrase: { ...typography.title },
  tip: { ...typography.body, color: colors.textMuted },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  result: { ...typography.labelSm, color: colors.greenText },
  error: { ...typography.labelSm, color: colors.error },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.s12 },
  play: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1, borderColor: colors.orange200, backgroundColor: colors.surface },
  playText: { ...typography.labelSm, color: colors.primary },
  replay: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 44, height: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: radius.full, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary },
  retry: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.full, borderWidth: 1, borderColor: colors.orange200, backgroundColor: colors.tint },
  retryOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  retryBusy: { opacity: 0.8 },
  retryText: { ...typography.labelSm, color: colors.primary },
});
