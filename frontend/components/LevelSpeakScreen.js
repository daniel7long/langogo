import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { fetchFrenchTest, submitFrenchSpeech } from '../api/tests';
import AsyncState from './AsyncState';
import Chip from './Chip';
import IconButton from './IconButton';
import Logo from './Logo';
import MicGate from './MicGate';
import PrimaryButton from './PrimaryButton';
import RecordingControls from './RecordingControls';
import Screen from './Screen';
import { ListSkeleton } from './Skeleton';
import useAsync from '../hooks/useAsync';
import useLessonAudio from '../hooks/useLessonAudio';
import { goHub } from '../utils/nav';
import PressableScale from './PressableScale';
import { SLOW_RATE, speakText, stopSpeaking } from '../utils/speech';
import { colors, radius, shadows, spacing, typography } from '../theme';

const MAX_RECORD_MS = 30000;
const MIN_RECORD_MS = 600;

// The last step of the level test: read one French sentence aloud. It is scored like a dialogue line
// (pronunciation and fluency) and there is no retry: when you stop, the recording is sent and you see your result.
export default function LevelSpeakScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const state = useAsync(fetchFrenchTest, []);

  return (
    <Screen>
      <AsyncState state={state} skeleton={<ListSkeleton rows={3} />} onBack={() => router.replace('/level-test')}>
        {(test) => (
          <MicGate language="French">
            <SpeakStep testId={id} speaking={test.speaking} />
          </MicGate>
        )}
      </AsyncState>
    </Screen>
  );
}

// phase: waiting | starting | recording | uploading | failed
function SpeakStep({ testId, speaking }) {
  const router = useRouter();
  const audio = useLessonAudio();
  const [phase, setPhaseState] = useState('waiting');
  const [hint, setHint] = useState(null);
  const [error, setError] = useState(null);
  const [heard, setHeard] = useState(false); // the learner has played the sentence: the mic unlocks
  const [listening, setListening] = useState(false);

  const phaseRef = useRef('waiting');
  const alive = useRef(true);
  const maxTimer = useRef(null);
  const take = useRef(null); // the recording that is being sent (kept so a network failure can resend the same one)

  const setPhase = (p) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(maxTimer.current);
      stopSpeaking();
    };
  }, []);

  // The learner taps Listen (normal or slow) to hear the sentence before recording. It never plays by itself.
  const listen = (slow) => {
    if (phaseRef.current !== 'waiting') return;
    if (listening) {
      stopSpeaking();
      setListening(false);
      return;
    }
    const end = () => alive.current && setListening(false);
    setHeard(true);
    setListening(true);
    speakText(speaking.sentence, { ...(slow ? { rate: SLOW_RATE } : {}), onDone: end, onStopped: end, onError: end });
  };

  const send = async () => {
    setError(null);
    setPhase('uploading');
    try {
      const result = await submitFrenchSpeech(testId, take.current);
      if (alive.current) router.replace({ pathname: '/test-result', params: { id: result.id } });
    } catch (e) {
      if (!alive.current) return;
      setError(e.message || "Couldn't send your recording.");
      if (e.status === 422) {
        // The server could not use this recording (empty, no speech heard): nothing was scored, so record again.
        take.current = null;
        setPhase('waiting');
      } else {
        setPhase('failed'); // a connection problem: send the same recording again
      }
    }
  };

  const beginRecording = async () => {
    stopSpeaking();
    setListening(false);
    setError(null);
    setHint(null);
    setPhase('starting');
    const r = await audio.startRecording();
    if (!alive.current) return;
    if (!r.ok) {
      setPhase('waiting');
      setError(
        r.reason === 'permission'
          ? 'Langogo needs microphone access. Allow it in your browser or phone settings, then tap the mic again.'
          : "Couldn't start recording. Check your microphone and try again."
      );
      return;
    }
    setPhase('recording');
    clearTimeout(maxTimer.current);
    maxTimer.current = setTimeout(() => stopRef.current(), MAX_RECORD_MS);
  };

  const stopAndSend = async () => {
    if (phaseRef.current !== 'recording') return;
    clearTimeout(maxTimer.current);
    setPhase('starting');
    const recorded = await audio.stopRecording();
    if (!alive.current) return;
    if (!recorded || recorded.durationMs < MIN_RECORD_MS) {
      // Nothing usable was said, so nothing is scored and this does not count as the try.
      setHint('That was too short. Tap the mic and read the whole sentence.');
      setPhase('waiting');
      return;
    }
    take.current = recorded;
    send();
  };
  const stopRef = useRef(stopAndSend);
  stopRef.current = stopAndSend;

  const onStart = () => {
    if (phaseRef.current === 'waiting') beginRecording();
  };

  return (
    <>
      <View style={styles.top}>
        <IconButton name="close" label="Close" onPress={() => goHub(router, '/courses')} />
        <Chip label="Part 2 of 2" />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Logo width={140} />
        <Text style={styles.title} accessibilityRole="header">Speaking check</Text>
        <Text style={styles.instructions}>{speaking.instructions}</Text>

        <View style={styles.card} accessibilityLabel={speaking.sentence}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
          <Text style={styles.sentence}>{speaking.sentence}</Text>
        </View>
        <View style={styles.listenRow}>
          <PressableScale onPress={() => listen(false)} style={styles.listenBtn} accessibilityRole="button" accessibilityLabel={listening ? 'Stop the audio' : 'Listen to the sentence'}>
            <Ionicons name={listening ? 'stop' : 'volume-high'} size={18} color={colors.onPrimary} />
            <Text style={styles.listenText}>{listening ? 'Stop' : 'Listen'}</Text>
          </PressableScale>
          <PressableScale onPress={() => listen(true)} style={styles.slowBtn} accessibilityRole="button" accessibilityLabel="Listen to the sentence slowly">
            <Ionicons name="speedometer-outline" size={18} color={colors.primary} />
            <Text style={styles.slowText}>Slow</Text>
          </PressableScale>
        </View>
        <Text style={styles.note}>Your score combines this with your answers to the questions.</Text>
      </ScrollView>

      {(!!hint || !!error) && (
        <View style={styles.message}>
          <Text style={error ? styles.error : styles.hint}>{error || hint}</Text>
        </View>
      )}
      {phase === 'failed' ? (
        <View style={styles.retrySend}>
          <PrimaryButton label="Send again" onPress={send} />
        </View>
      ) : (
        <RecordingControls
          phase={phase}
          hideHelpers
          micDisabled={!heard}
          caption={heard ? undefined : 'Tap Listen first, then the microphone unlocks'}
          onStart={onStart}
          onStop={stopAndSend}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.md, height: 64 },
  scroll: { flex: 1 },
  body: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  title: { ...typography.display, color: colors.text, textAlign: 'center', marginTop: spacing.md },
  instructions: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.s12,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadows.lift(),
  },
  sentence: { ...typography.display, color: colors.text, textAlign: 'center' },
  listenRow: { flexDirection: 'row', gap: spacing.s12, marginTop: spacing.lg },
  listenBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: colors.primary, ...shadows.button() },
  listenText: { ...typography.label, color: colors.onPrimary },
  slowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1, borderColor: colors.orange200, backgroundColor: colors.tint },
  slowText: { ...typography.label, color: colors.primary },
  note: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
  message: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  error: { ...typography.body, color: colors.error, textAlign: 'center' },
  retrySend: { padding: spacing.lg, backgroundColor: colors.surface },
});
