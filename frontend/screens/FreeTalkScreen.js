import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import Text from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { finishFreeTalk, sendFreeTalkTurn, startFreeTalk } from '../api/app';
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
import { confirm, notify } from '../utils/dialog';
import { goHub } from '../utils/nav';
import { isRtl } from '../utils/rtl';
import { colors, radius, spacing, typography } from '../theme';

// If the learner has not started to answer this long after the partner finishes, a "Not sure what to say?" link appears;
// the example answers only open when the learner taps it.
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
  const [showHints, setShowHints] = useState(false); // example answers are open
  const [offerHelp, setOfferHelp] = useState(false); // the "Not sure what to say?" link is visible
  const [speakingId, setSpeakingId] = useState(null);
  const [replaying, setReplaying] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [error, setError] = useState(null);
  const [choice, setChoice] = useState(null);
  const [scores, setScores] = useState({}); // learner turn id -> pronunciation score of that turn
  const [wordScores, setWordScores] = useState({}); // learner turn id -> [{ text, score }] to tint the words
  const [ending, setEnding] = useState(false);
  const showTranslation = choice ?? settings.show_translation;
  const MIN_TURNS = start.min_turns ?? 5; // a dialogue needs this many of your turns to get a rating and the flowers
  const REWARD = start.reward ?? 10; // flowers for a dialogue of at least NEED_SEC seconds
  const NEED_SEC = start.reward_seconds ?? 300;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 5000);
    return () => clearInterval(id);
  }, []);
  const longEnough = elapsed >= NEED_SEC;

  const phaseRef = useRef('playing');
  const alive = useRef(true);
  const playId = useRef(0);
  const hintUsed = useRef(false);
  const hintsCount = useRef(0); // turns in which the example answers were opened
  const scoredRef = useRef([]); // scored turns: sent when the dialogue ends (a backup if the server restarted)
  const startedAt = useRef(Date.now());
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
  const spoken = turns.filter((t) => t.role === 'you').length; // your turns so far
  const enough = spoken >= MIN_TURNS;

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
    if (phase !== 'waiting' || offerHelp || !hints.length) return undefined;
    const t = setTimeout(() => setOfferHelp(true), HINT_AFTER_MS);
    return () => clearTimeout(t);
  }, [phase, offerHelp, hints]);

  useEffect(() => {
    if (scroller.current) setTimeout(() => scroller.current && scroller.current.scrollToEnd({ animated: true }), 80);
  }, [turns.length, showHints, offerHelp]);

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
        sessionId: start.session_id,
        history,
        turnNo: history.length,
        hintUsed: hintUsed.current,
        recording: take,
      });
      if (!alive.current) return;
      if (hintUsed.current) hintsCount.current += 1;
      hintUsed.current = false;
      if (result.scores) {
        setScores((s) => ({ ...s, [result.you.id]: result.scores.pronunciation }));
        setWordScores((s) => ({ ...s, [result.you.id]: result.scores.words }));
        scoredRef.current.push({ text: result.you.text, ...result.scores });
      }
      setTake(null);
      setShowHints(false);
      setOfferHelp(false);
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

  // ---- Ending the dialogue -------------------------------------------------------------------------
  // The learner can end it whenever they want, but not by accident: it always asks first, and the dialogue only gets
  // a rating and flowers once it has MIN_TURNS of the learner's turns. Leaving earlier is still possible (it is
  // logged as "left early" and earns nothing). You can't end while recording or while an answer is being checked.
  const busy = ['recording', 'starting', 'uploading', 'finishing'].includes(phase) || ending;

  const wrapUp = async (finished) => {
    audio.stopPlayback();
    clearTimeout(maxTimer.current);
    setEnding(true);
    setPhase('finishing');
    try {
      return await finishFreeTalk({
        sessionId: start.session_id,
        topicId: start.topic.id,
        seconds: Math.round((Date.now() - startedAt.current) / 1000),
        hintsUsed: hintsCount.current,
        finished,
        turns: scoredRef.current,
      });
    } catch (e) {
      if (alive.current) {
        setEnding(false);
        setPhase('waiting');
        notify("Couldn't end the dialogue", e.message);
      }
      return null;
    }
  };

  const requestEnd = async () => {
    if (busy) return;
    if (spoken === 0) {
      audio.stopPlayback();
      goHub(router, '/courses'); // nothing said yet: nothing to rate
      return;
    }
    const ok = await confirm(
      enough ? 'End this dialogue?' : 'Leave this dialogue?',
      enough
        ? longEnough
          ? `You've said ${spoken} turns. You'll get ${REWARD} flowers and your ratings.`
          : `You've said ${spoken} turns. You'll get your ratings. Talk for 5 minutes in total to earn ${REWARD} flowers too.`
        : `You've said ${spoken} of ${MIN_TURNS} turns. A dialogue needs ${MIN_TURNS} turns to get ratings, so leaving now earns nothing. Keep talking a little longer?`,
      enough ? 'End and see my rating' : 'Leave anyway',
      'Keep talking'
    );
    if (!ok || !alive.current) return;
    const out = await wrapUp(enough);
    if (!out || !alive.current) return;
    if (out.record) router.replace({ pathname: '/lesson-complete', params: { id: out.record.id } });
    else goHub(router, '/courses');
  };

  const changeTopic = async (id) => {
    if (busy) return;
    if (spoken > 0) {
      const ok = await confirm(
        'Change topic?',
        enough
          ? `This ends the current dialogue without a rating or flowers. To get your ${REWARD} flowers, tap End dialogue instead.`
          : 'This ends the current dialogue without a rating or flowers.',
        'Change topic',
        'Stay'
      );
      if (!ok || !alive.current) return;
      const out = await wrapUp(false);
      if (!out) return;
    }
    onTopic(id);
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
  const helpPhase = ['waiting', 'starting', 'recording'].includes(phase) && hints.length > 0;
  const hintsVisible = showHints && helpPhase;
  const helpLinkVisible = offerHelp && !showHints && helpPhase;

  return (
    <>
      <LessonTopBar progress={Math.min(spoken / MIN_TURNS, 1) * 0.5 + Math.min(elapsed / NEED_SEC, 1) * 0.5} reward={REWARD} confirmClose={false} onClose={requestEnd} />

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

      <View style={styles.endRow}>
        <Text style={styles.endInfo}>
          {enough
            ? longEnough
              ? `Ready for your rating · +${REWARD} flowers`
              : `Rating ready · keep talking for 5 minutes to earn +${REWARD} flowers`
            : `${spoken} of ${MIN_TURNS} turns for your rating · ${REWARD} flowers for 5+ minutes`}
        </Text>
        <Pressable
          onPress={requestEnd}
          disabled={busy}
          style={[styles.endBtn, enough && styles.endBtnReady, busy && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel="End dialogue"
        >
          <Ionicons name="flag-outline" size={16} color={enough ? colors.onPrimary : colors.primary} />
          <Text style={[styles.endBtnText, enough && { color: colors.onPrimary }]}>End dialogue</Text>
        </Pressable>
      </View>

      {start.topics.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicsScroll} contentContainerStyle={styles.topics}>
          {start.topics.map((t) => {
            const on = t.id === start.topic.id;
            return (
              <Pressable key={t.id} onPress={() => !on && changeTopic(t.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Talk about ${t.name}`}>
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
            score={scores[t.id]}
            wordScores={wordScores[t.id]}
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

        {helpLinkVisible && (
          <Pressable
            onPress={() => setShowHints(true)}
            style={styles.helpLink}
            accessibilityRole="button"
            accessibilityLabel="Not sure what to say? Show example answers"
          >
            <Ionicons name="bulb-outline" size={18} color={colors.primary} />
            <Text style={styles.helpLinkText}>Not sure what to say?</Text>
          </Pressable>
        )}

        {hintsVisible && (
          <View style={styles.hints} accessibilityRole="summary">
            <Text style={styles.hintsTitle}>Not sure what to say? Try one of these</Text>
            {hints.map((h, i) => (
              <View key={i} style={styles.hint}>
                <View style={styles.flex}>
                  <Text style={[styles.hintText, rtl && { writingDirection: 'rtl' }]}>{h.text}</Text>
                  {!!h.en && <Text style={styles.hintEn}>{h.en}</Text>}
                </View>
              </View>
            ))}
            <Text style={styles.hintsFoot}>Read one out loud, or say it in your own words.</Text>
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
  endRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  endInfo: { ...typography.caption, color: colors.textMuted, flex: 1 },
  endBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.s12, minHeight: 36, borderRadius: radius.full, backgroundColor: colors.selectedBg },
  endBtnReady: { backgroundColor: colors.primary },
  endBtnText: { ...typography.labelSm, color: colors.primary },
  topicsScroll: { flexGrow: 0, flexShrink: 0 },
  topics: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  subhead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  demo: { ...typography.caption, color: colors.error, flex: 1 },
  switchRow: { alignItems: 'center', gap: 2 },
  switchLabel: { ...typography.caption, color: colors.textMuted },
  chat: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  take: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, height: 44, borderRadius: radius.full, backgroundColor: colors.selectedBg },
  takeText: { ...typography.labelSm, color: colors.primary },
  helpLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, height: 44, borderRadius: radius.full, backgroundColor: colors.selectedBg },
  helpLinkText: { ...typography.label, color: colors.primary },
  hints: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: '#FAF4EE', gap: spacing.sm, borderWidth: 1, borderColor: colors.orange200 },
  hintsTitle: { ...typography.label, color: colors.text },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.s12, borderRadius: radius.lg, backgroundColor: colors.surface },
  hintText: { ...typography.bodyStrong, color: colors.text },
  hintEn: { ...typography.caption, color: colors.textMuted },
  hintsFoot: { ...typography.caption, color: colors.textMuted },
  message: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  error: { ...typography.body, color: colors.error, textAlign: 'center' },
});
