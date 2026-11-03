import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { sendFreeTalkTurn, startFreeTalk } from '../api/app';
import AsyncState from '../components/AsyncState';
import ChatBubble from '../components/ChatBubble';
import Chip from '../components/Chip';
import LessonTopBar from '../components/LessonTopBar';
import MicGate from '../components/MicGate';
import RecordingControls from '../components/RecordingControls';
import Screen from '../components/Screen';
import { ListSkeleton } from '../components/Skeleton';
import Waveform from '../components/Waveform';
import useLessonAudio from '../hooks/useLessonAudio';
import useSettings from '../hooks/useSettings';
import { goHub } from '../utils/nav';
import { isRtl } from '../utils/rtl';
import { colors, radius, spacing, typography } from '../theme';

// If the learner has not started to answer this long after the partner finishes, hints appear.
const HINT_AFTER_MS = 2000;
const MAX_RECORD_MS = 30000;
const MIN_RECORD_MS = 600;

// Free Talk: the same conversation flow as a lesson dialogue (the partner speaks by itself, you tap the mic,
// Retry or Done), but the partner is an AI and the subject is one of the learner's favorite topics. The level
// follows the learner's course level; short answers or hints make the partner simpler (done on the server).
export default function FreeTalkScreen() {
  const router = useRouter();
  const [topicId, setTopicId] = useState(null); // null = let the server pick one of your favorite topics
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const latest = useRef(0);

  const load = useCallback(
    async (topic) => {
      const id = ++latest.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await startFreeTalk(topic);
        if (id === latest.current) setState({ data, loading: false, error: null });
      } catch (error) {
        if (id === latest.current) setState((s) => ({ ...s, loading: false, error }));
      }
    },
    []
  );

  useEffect(() => {
    load(topicId);
  }, [topicId, load]);

  return (
    <Screen>
      <AsyncState
        state={{ ...state, reload: () => load(topicId) }}
        skeleton={<ListSkeleton rows={3} />}
        onBack={() => goHub(router, '/courses')}
      >
        {(start) => (
          <MicGate language={start.language}>
            <TalkView key={`${start.topic.id}-${start.turn.id}-${start.turn.text}`} start={start} onTopic={setTopicId} />
          </MicGate>
        )}
      </AsyncState>
    </Screen>
  );
}

// phase: playing | paused | waiting | blocked | starting | recording | review | uploading
function TalkView({ start, onTopic }) {
  const router = useRouter();
  const audio = useLessonAudio();
  const { settings } = useSettings();
  const rtl = isRtl(start.lang);

  const [turns, setTurns] = useState([start.turn]);
  const [hints, setHints] = useState(start.hints || []);
  const [level, setLevel] = useState(start.level);
  const [phase, setPhaseState] = useState('playing');
  const [take, setTake] = useState(null);
  const [showHints, setShowHints] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [replaying, setReplaying] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [error, setError] = useState(null);
  const [choice, setChoice] = useState(null);
  const showTranslation = choice ?? settings.show_translation;

  const phaseRef = useRef('playing');
  const alive = useRef(true);
  const playId = useRef(0);
  const hintUsed = useRef(false);
  const maxTimer = useRef(null);
  const scroller = useRef(null);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

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

  const lastNpc = [...turns].reverse().find((t) => t.role === 'npc');

  // ---- The partner speaks whenever there is a new line of theirs ---------------------------------
  useEffect(() => {
    if (!lastNpc) return undefined;
    const mine = ++playId.current;
    setPhase('playing');
    setSpeakingId(lastNpc.id);
    audio.playLine({ text: lastNpc.text, audioUrl: lastNpc.audio_url }).then((result) => {
      if (!alive.current || mine !== playId.current) return;
      setSpeakingId(null);
      if (result === 'blocked') setPhase('blocked');
      else setPhase('waiting'); // done, or cut off by the learner tapping something else
    });
    return () => {
      audio.stopPlayback();
    };
  }, [lastNpc && lastNpc.id, runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Hints: nothing started 2 seconds after the partner finished -> offer help --------------------------
  useEffect(() => {
    if (phase !== 'waiting' || showHints || !hints.length) return undefined;
    const t = setTimeout(() => setShowHints(true), HINT_AFTER_MS);
    return () => clearTimeout(t);
  }, [phase, showHints, hints]);

  useEffect(() => {
    if (scroller.current) setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 80);
  }, [turns.length, showHints]);

  // ---- Recording ----------------------------------------------------------------------------------
  const beginRecording = async () => {
    setError(null);
    setReplaying(false);
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
    if (showHints) hintUsed.current = true;
    setPhase('recording');
    clearTimeout(maxTimer.current);
    maxTimer.current = setTimeout(() => stopRef.current(), MAX_RECORD_MS);
  };

  const stopAndReview = async () => {
    if (phaseRef.current !== 'recording') return;
    clearTimeout(maxTimer.current);
    setPhase('starting');
    const got = await audio.stopRecording();
    if (!alive.current) return;
    if (!got || got.durationMs < MIN_RECORD_MS) {
      setError('That was too short. Tap the mic and say a little more.');
      setPhase('waiting');
      return;
    }
    setTake(got);
    setPhase('review');
  };
  const stopRef = useRef(stopAndReview);
  stopRef.current = stopAndReview;

  const onMic = () => {
    const p = phaseRef.current;
    if (p === 'playing' || p === 'paused') {
      playId.current += 1; // the partner's line was cut off on purpose: do not treat it as "finished"
      audio.stopPlayback();
      setSpeakingId(null);
      beginRecording();
    } else if (p === 'waiting') {
      beginRecording();
    }
  };

  const onRetry = () => {
    audio.stopPlayback();
    setTake(null);
    beginRecording();
  };

  const onDone = async () => {
    if (!take) return;
    audio.stopPlayback();
    setReplaying(false);
    setError(null);
    setPhase('uploading');
    try {
      const history = turnsRef.current.map((t) => ({ role: t.role, text: t.text }));
      const result = await sendFreeTalkTurn({
        topicId: start.topic.id,
        history,
        turnNo: history.length,
        hintUsed: hintUsed.current,
        recording: take,
      });
      if (!alive.current) return;
      hintUsed.current = false;
      setTake(null);
      setShowHints(false);
      setHints(result.hints || []);
      if (result.level) setLevel(result.level);
      setTurns((t) => [...t, result.you, result.turn]); // the new partner line triggers its own playback
    } catch (e) {
      if (!alive.current) return;
      setError(e.message);
      if (e.status === 422) {
        setTake(null); // nothing was heard: record again
        setPhase('waiting');
      } else {
        setPhase('review');
      }
    }
  };

  // ---- Little buttons ------------------------------------------------------------------------------
  const playModel = (t) => {
    playId.current += 1;
    setReplaying(false);
    setSpeakingId(t.id);
    audio.playLine({ text: t.text, audioUrl: t.audio_url }).then(() => {
      if (alive.current) setSpeakingId((s) => (s === t.id ? null : s));
    });
  };

  const hearHint = (h) => {
    playId.current += 1;
    hintUsed.current = true;
    setSpeakingId(null);
    audio.playLine({ text: h.text, slow: false });
  };

  const hearCurrent = (slow) => {
    if (!lastNpc) return;
    playId.current += 1;
    audio.stopPlayback();
    setSpeakingId(lastNpc.id);
    audio.playLine({ text: lastNpc.text, audioUrl: slow ? null : lastNpc.audio_url, slow }).then(() => {
      if (alive.current) setSpeakingId((s) => (s === lastNpc.id ? null : s));
    });
  };

  const playTake = () => {
    if (!take) return;
    if (replaying) {
      audio.stopPlayback();
      setReplaying(false);
      return;
    }
    setReplaying(true);
    audio.playRecording(take.uri).then(() => alive.current && setReplaying(false));
  };

  const hasTranslations = turns.some((t) => !!t.en);
  const speaking = speakingId != null;
  const hintsVisible = showHints && hints.length > 0 && ['waiting', 'starting', 'recording'].includes(phase);

  return (
    <>
      <LessonTopBar onClose={() => goHub(router, '/courses')} />

      <View style={styles.head}>
        <View style={styles.avatar}>
          {speaking ? <Waveform active color={colors.onPrimary} bars={5} height={22} /> : <Text style={styles.avatarText}>{(lastNpc?.speaker || 'A').charAt(0)}</Text>}
        </View>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>Free Talk · {start.language}</Text>
          <Text style={styles.title} numberOfLines={1}>{lastNpc?.speaker} · {start.topic.name}</Text>
        </View>
        <Chip label={`Level ${level}`} tone="green" />
      </View>

      {start.topics.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics}>
          {start.topics.map((t) => {
            const on = t.id === start.topic.id;
            return (
              <Pressable key={t.id} onPress={() => !on && onTopic(t.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Talk about ${t.name}`}>
                <Chip label={t.name} tone={on ? 'orange' : 'grey'} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {(hasTranslations || start.demo) && (
        <View style={styles.subhead}>
          {start.demo ? <Text style={styles.demo}>Demo mode: the server has no OpenAI key yet.</Text> : <View style={styles.flex} />}
          {hasTranslations && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Show translation</Text>
              <Switch value={showTranslation} onValueChange={setChoice} trackColor={{ false: '#E3D8CC', true: colors.primary }} thumbColor="#FFFFFF" accessibilityLabel="Show translation" />
            </View>
          )}
        </View>
      )}

      <ScrollView ref={scroller} style={styles.flex} contentContainerStyle={styles.chat} showsVerticalScrollIndicator={false}>
        {turns.map((t) => (
          <ChatBubble
            key={t.id}
            turn={t}
            rtl={rtl}
            highlighted={speakingId === t.id}
            playing={speakingId === t.id}
            showTranslation={showTranslation}
            onPlayLine={() => playModel(t)}
          />
        ))}

        {phase === 'review' && !!take && (
          <Pressable onPress={playTake} style={styles.take} accessibilityRole="button" accessibilityLabel={replaying ? 'Stop your recording' : 'Play your recording'}>
            <Ionicons name={replaying ? 'pause' : 'play'} size={18} color={colors.primary} />
            <Text style={styles.takeText}>{replaying ? 'Playing your answer…' : 'Play your answer'}</Text>
          </Pressable>
        )}

        {hintsVisible && (
          <View style={styles.hints} accessibilityRole="summary">
            <Text style={styles.hintsTitle}>Not sure what to say? Try one of these</Text>
            {hints.map((h, i) => (
              <Pressable key={i} onPress={() => hearHint(h)} style={styles.hint} accessibilityRole="button" accessibilityLabel={`Hear: ${h.text}`}>
                <View style={styles.flex}>
                  <Text style={[styles.hintText, rtl && { writingDirection: 'rtl' }]}>{h.text}</Text>
                  {!!h.en && <Text style={styles.hintEn}>{h.en}</Text>}
                </View>
                <Ionicons name="volume-high-outline" size={20} color={colors.primary} />
              </Pressable>
            ))}
            <Text style={styles.hintsFoot}>Tap one to hear it, then say it in your own words.</Text>
          </View>
        )}
      </ScrollView>

      {!!error && (
        <View style={styles.message}>
          <Text style={styles.error}>{error}</Text>
        </View>
      )}
      <RecordingControls
        phase={phase}
        onStart={onMic}
        onStop={stopAndReview}
        onRetry={onRetry}
        onDone={onDone}
        onResume={() => setRunKey((k) => k + 1)}
        onHear={() => hearCurrent(false)}
        onHearSlow={() => hearCurrent(true)}
        caption={`Answer in ${start.language}, in your own words`}
        reviewCaption="Play your answer above, or record it again."
        busyTitle="Thinking…"
        busyCaption="Listening to what you said"
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.title, color: colors.onPrimary },
  eyebrow: { ...typography.eyebrow, color: colors.textMuted },
  title: { ...typography.label, color: colors.text },
  topics: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  subhead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  demo: { ...typography.caption, color: colors.error, flex: 1 },
  switchRow: { alignItems: 'center', gap: 2 },
  switchLabel: { ...typography.caption, color: colors.textMuted },
  chat: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  take: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, height: 44, borderRadius: radius.full, backgroundColor: colors.selectedBg },
  takeText: { ...typography.labelSm, color: colors.primary },
  hints: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: '#FAF4EE', gap: spacing.sm, borderWidth: 1, borderColor: colors.orange200 },
  hintsTitle: { ...typography.label, color: colors.text },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.s12, borderRadius: radius.lg, backgroundColor: colors.surface },
  hintText: { ...typography.bodyStrong, color: colors.text },
  hintEn: { ...typography.caption, color: colors.textMuted },
  hintsFoot: { ...typography.caption, color: colors.textMuted },
  message: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  error: { ...typography.body, color: colors.error, textAlign: 'center' },
});
