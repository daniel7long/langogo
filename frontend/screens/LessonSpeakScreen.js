import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { completeLesson, getLesson, scoreTurn } from '../api/app';
import AsyncState from '../components/AsyncState';
import ChatBubble from '../components/ChatBubble';
import Chip from '../components/Chip';
import LessonTopBar from '../components/LessonTopBar';
import MicGate from '../components/MicGate';
import PrimaryButton from '../components/PrimaryButton';
import RecordingControls from '../components/RecordingControls';
import Screen from '../components/Screen';
import { ListSkeleton } from '../components/Skeleton';
import useAsync from '../hooks/useAsync';
import useLessonAudio from '../hooks/useLessonAudio';
import useSettings from '../hooks/useSettings';
import { lessonProgress } from '../utils/progress';
import { goHub } from '../utils/nav';
import { colors, spacing, typography } from '../theme';

// Can the learner tap the mic while the other speaker is still talking? If so, it cuts the line off.
const ALLOW_INTERRUPT = true;
const MAX_RECORD_MS = 30000;
const MIN_RECORD_MS = 600;

// F2S4: speaking practice.
// The other speaker's lines play by themselves. On your turn, tap the mic to record, then
// Retry or Done. Done uploads the take to the backend, which scores it and keeps the result.
export default function LessonSpeakScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const state = useAsync(() => getLesson(id), [id]);

  return (
    <Screen>
      <AsyncState state={state} skeleton={<ListSkeleton rows={3} />} onBack={() => goHub(router, '/courses')}>
        {(lesson) => (
          <MicGate language={lesson.language}>
            <SpeakView lesson={lesson} />
          </MicGate>
        )}
      </AsyncState>
    </Screen>
  );
}

// phase: playing | paused | waiting | blocked | starting | recording | review | uploading | finishing
function SpeakView({ lesson }) {
  const router = useRouter();
  const turns = lesson.dialogue;
  const audio = useLessonAudio();

  const [cursor, setCursor] = useState(0); // the line in focus; turns.length means "all done"
  const [phase, setPhaseState] = useState('playing');
  const [takes, setTakes] = useState({}); // turn id -> { uri, durationMs }
  const [scores, setScores] = useState({}); // turn id -> pronunciation score of the line you just said
  const [wordScores, setWordScores] = useState({}); // turn id -> [{ text, score }] for tinting the words
  const { settings } = useSettings();
  const [translationChoice, setTranslationChoice] = useState(null); // null = follow the setting
  const showTranslation = translationChoice ?? settings.show_translation;
  const hasTranslations = turns.some((t) => !!t.en);
  const [speakingId, setSpeakingId] = useState(null); // a model line that is playing
  const [replayingId, setReplayingId] = useState(null); // a take of yours that is playing
  const [runKey, setRunKey] = useState(0); // bump to replay the current line (after "blocked")
  const [hint, setHint] = useState(null);
  const [error, setError] = useState(null);

  const phaseRef = useRef('playing');
  const alive = useRef(true);
  const pendingRecord = useRef(false); // start recording as soon as the user's line is reached
  const maxTimer = useRef(null);
  const scroller = useRef(null);
  const offsets = useRef({});
  const finishing = useRef(false);

  const setPhase = (p) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(maxTimer.current);
    };
  }, []);

  const modelHeard = useRef({}); // turn ids whose model reading already played by itself
  const finished = cursor >= turns.length;
  const turn = turns[cursor];

  // ---- The conversation moves along as the cursor moves --------------------------------
  useEffect(() => {
    if (finished) {
      finish();
      return undefined;
    }
    let live = true;
    if (turn.role === 'npc') {
      setPhase('playing');
      setSpeakingId(turn.id);
      audio.playLine({ text: turn.text, audioUrl: turn.audio_url }).then((result) => {
        if (!live || !alive.current) return;
        setSpeakingId(null);
        if (result === 'done') setCursor((c) => c + 1);
        else if (result === 'blocked') setPhase('blocked');
        else setPhase('paused'); // cut off by the user tapping something else
      });
    } else if (pendingRecord.current) {
      pendingRecord.current = false;
      beginRecording();
    } else {
      // Your turn: the model reading plays once by itself, then the mic is ready (it is usable straight away).
      setPhase('waiting');
      if (!modelHeard.current[turn.id]) {
        modelHeard.current[turn.id] = true;
        setSpeakingId(turn.id);
        audio.playLine({ text: turn.text, audioUrl: turn.audio_url }).then(() => {
          if (live && alive.current) setSpeakingId((s) => (s === turn.id ? null : s));
        });
      }
    }
    return () => {
      live = false;
      audio.stopPlayback();
    };
  }, [cursor, runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the line in focus on screen.
  useEffect(() => {
    const y = offsets.current[Math.min(cursor, turns.length - 1)];
    if (y != null && scroller.current) {
      scroller.current.scrollTo({ y: Math.max(0, y - spacing.md), animated: true });
    }
  }, [cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Recording -------------------------------------------------------------------
  const beginRecording = async () => {
    setError(null);
    setHint(null);
    setReplayingId(null);
    setSpeakingId(null);
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

  const stopAndReview = async () => {
    if (phaseRef.current !== 'recording') return;
    clearTimeout(maxTimer.current);
    setPhase('starting'); // a moment of "busy" while the file is finalised
    const take = await audio.stopRecording();
    if (!alive.current) return;
    if (!take || take.durationMs < MIN_RECORD_MS) {
      setHint("That was too short. Tap the mic and say the whole line.");
      setPhase('waiting');
      return;
    }
    setTakes((t) => ({ ...t, [turn.id]: take }));
    setPhase('review');
  };
  const stopRef = useRef(stopAndReview);
  stopRef.current = stopAndReview;

  const onMic = () => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
      if (!ALLOW_INTERRUPT) return;
      const next = turns.findIndex((t, i) => i > cursor && t.role === 'you');
      if (next === -1) return;
      audio.stopPlayback();
      pendingRecord.current = true;
      setCursor(next);
      return;
    }
    if (phaseRef.current === 'waiting') beginRecording();
  };

  const onRetry = () => {
    audio.stopPlayback();
    setTakes((t) => {
      const { [turn.id]: _drop, ...rest } = t;
      return rest;
    });
    beginRecording();
  };

  const onDone = async () => {
    const take = takes[turn.id];
    if (!take) return;
    audio.stopPlayback();
    setReplayingId(null);
    setError(null);
    setPhase('uploading');
    try {
      const result = await scoreTurn(lesson.id, turn.id, take);
      if (!alive.current) return;
      setScores((sc) => ({ ...sc, [turn.id]: result.pronunciation }));
      setWordScores((ws) => ({ ...ws, [turn.id]: result.words }));
      setCursor((c) => c + 1);
    } catch (e) {
      if (!alive.current) return;
      setError(e.message);
      setPhase('review');
    }
  };

  // ---- Finishing -------------------------------------------------------------------
  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    setPhase('finishing');
    setError(null);
    try {
      const record = await completeLesson(lesson.id);
      router.replace({ pathname: '/lesson-complete', params: { id: record.id } });
    } catch (e) {
      finishing.current = false;
      if (alive.current) {
        setError(e.message);
        setPhase('review');
      }
    }
  };

  // ---- Little speaker / replay buttons in the bubbles --------------------------------
  const playModel = (t) => {
    setReplayingId(null);
    setSpeakingId(t.id);
    audio.playLine({ text: t.text, audioUrl: t.audio_url }).then(() => {
      if (alive.current) setSpeakingId((s) => (s === t.id ? null : s));
    });
  };

  // "Hear it again" / "Slow" on your turn: the model reading of the line you are about to say.
  const hearCurrent = (slow) => {
    if (!turn || turn.role !== 'you') return;
    audio.stopPlayback();
    setReplayingId(null);
    setSpeakingId(turn.id);
    audio.playLine({ text: turn.text, audioUrl: turn.audio_url, slow }).then(() => {
      if (alive.current) setSpeakingId((sp) => (sp === turn.id ? null : sp));
    });
  };

  const playTake = (t) => {
    if (replayingId === t.id) {
      audio.stopPlayback();
      setReplayingId(null);
      return;
    }
    setSpeakingId(null);
    setReplayingId(t.id);
    audio.playRecording(takes[t.id].uri).then(() => {
      if (alive.current) setReplayingId((r) => (r === t.id ? null : r));
    });
  };

  // ---- Screen ---------------------------------------------------------------------
  const recordingNow = phase === 'recording' || phase === 'starting';
  const allDoneWithError = finished && error;

  return (
    <>
      <LessonTopBar
        progress={lessonProgress(lesson, 'speak', Math.min(cursor, turns.length))}
        reward={lesson.max_flowers}
        onClose={() => goHub(router, '/courses')}
      />
      <View style={styles.subhead}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{lesson.language} dialogue</Text>
          <Text style={styles.lessonTitle} numberOfLines={1}>{lesson.title}</Text>
        </View>
        {hasTranslations && (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Show translation</Text>
            <Switch
              value={showTranslation}
              onValueChange={setTranslationChoice}
              trackColor={{ false: '#E3D8CC', true: colors.primary }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Show translation"
            />
          </View>
        )}
        <Chip label={`${Math.min(cursor + 1, turns.length)} of ${turns.length}`} />
      </View>

      <ScrollView ref={scroller} style={styles.scroll} contentContainerStyle={styles.chat} showsVerticalScrollIndicator={false}>
        {turns.map((t, i) => (
          <View key={t.id} onLayout={(e) => { offsets.current[i] = e.nativeEvent.layout.y; }}>
            <ChatBubble
              turn={t}
              highlighted={speakingId === t.id || (recordingNow && i === cursor)}
              playing={speakingId === t.id}
              yourTurn={i === cursor && phase === 'waiting' && !takes[t.id]}
              hasRecording={!!takes[t.id]}
              score={scores[t.id]}
              wordScores={wordScores[t.id]}
              showTranslation={showTranslation}
              waiting={i === cursor && (phase === 'waiting' || phase === 'playing' || phase === 'paused')}
              replaying={replayingId === t.id}
              onPlayLine={() => playModel(t)}
              onPlayRecording={() => playTake(t)}
            />
          </View>
        ))}
      </ScrollView>

      {(!!hint || !!error) && (
        <View style={styles.message}>
          <Text style={error ? styles.error : styles.hint}>{error || hint}</Text>
        </View>
      )}
      {allDoneWithError ? (
        <View style={styles.retryFinish}>
          <PrimaryButton label="Try again" onPress={finish} />
        </View>
      ) : (
        <RecordingControls
          phase={phase}
          onStart={onMic}
          onStop={stopAndReview}
          onRetry={onRetry}
          onDone={onDone}
          onResume={() => setRunKey((k) => k + 1)}
          onHear={() => hearCurrent(false)}
          onHearSlow={() => hearCurrent(true)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subhead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.textMuted },
  lessonTitle: { ...typography.label, color: colors.text },
  switchRow: { alignItems: 'center', gap: 2 },
  switchLabel: { ...typography.caption, color: colors.textMuted },
  scroll: { flex: 1 },
  chat: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  message: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  error: { ...typography.body, color: colors.error, textAlign: 'center' },
  retryFinish: { padding: spacing.lg, backgroundColor: colors.surface },
});
