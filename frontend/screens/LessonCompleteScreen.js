import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getLeaderboard, getRecord, retryWord } from '../api/app';
import AsyncState from '../components/AsyncState';
import ConfettiCannon from '../components/ConfettiCannon';
import FadeIn from '../components/FadeIn';
import LessonTopBar from '../components/LessonTopBar';
import PrimaryButton from '../components/PrimaryButton';
import RetryWordRow from '../components/RetryWordRow';
import ScoreRing from '../components/ScoreRing';
import Screen from '../components/Screen';
import SecondaryButton from '../components/SecondaryButton';
import ShareSheet from '../components/ShareSheet';
import useAsync from '../hooks/useAsync';
import useSettings from '../hooks/useSettings';
import { goHub } from '../utils/nav';
import { gradeColors, scoreColor } from '../utils/score';
import { colors, radius, shadows, spacing, typography } from '../theme';

const NATIVE = Platform.OS !== 'web';
const CELEBRATE = ['A+', 'A'];

// Lesson result: grade, flowers, three scores, community rank and the words to practise.
// Speaking speed is research data. It is kept on the server and is not shown here.
export default function LessonCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const state = useAsync(async () => {
    const [record, board] = await Promise.all([getRecord(id), getLeaderboard()]);
    return { record, board };
  }, [id]);

  return (
    <Screen>
      <AsyncState state={state} onBack={() => goHub(router, '/courses')}>
        {({ record, board }) => <CompleteView record={record} board={board} />}
      </AsyncState>
    </Screen>
  );
}

function Grade({ grade, onCelebrate }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 70, delay: 150, useNativeDriver: NATIVE }).start();
  }, [pop]);
  const g = gradeColors(grade);
  const celebrate = CELEBRATE.includes(grade);
  return (
    <Pressable onPress={celebrate ? onCelebrate : undefined} accessibilityRole="button" accessibilityLabel={`Grade ${grade}`} style={styles.gradeWrap}>
      <Animated.View
        style={[
          styles.gradeBadge,
          { backgroundColor: g.solid },
          { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] },
        ]}
      >
        <Text style={styles.gradeText}>{grade}</Text>
      </Animated.View>
    </Pressable>
  );
}

function CountUp({ to, prefix = '', style }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const v = new Animated.Value(0);
    const id = v.addListener(({ value }) => setN(Math.round(value)));
    Animated.timing(v, { toValue: to, duration: 900, delay: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [to]);
  return <Text style={style}>{prefix}{n}</Text>;
}

function Tile({ value, label }) {
  return (
    <View style={styles.tile}>
      <ScoreRing value={value} color={scoreColor(value)} />
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function CompleteView({ record, board }) {
  const router = useRouter();
  const { settings } = useSettings();
  const [sharing, setSharing] = useState(false);
  const celebrate = CELEBRATE.includes(record.grade) && settings.effects !== false;
  const [shots, setShots] = useState(celebrate ? 1 : 0);
  const me = board.find((r) => r.you);
  const language = record.language ?? 'French';

  return (
    <View style={styles.root}>
      <ShareSheet visible={sharing} recordId={record.id} record={record} onClose={() => setSharing(false)} />
      <LessonTopBar onClose={() => goHub(router, '/courses')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>LESSON COMPLETE</Text>
        <Grade grade={record.grade} onCelebrate={() => settings.effects !== false && setShots((s) => s + 1)} />
        <Text style={styles.title} accessibilityRole="header">Lesson complete!</Text>
        <View style={styles.rewardRow}>
          <Ionicons name="flower-outline" size={18} color={colors.primary} />
          <CountUp to={record.flowers_earned} prefix="+" style={styles.reward} />
          <Text style={styles.reward}> flowers</Text>
        </View>
        {!!record.unlocked_level && (
          <FadeIn delay={900} style={styles.unlock}>
            <Ionicons name="lock-open-outline" size={16} color={colors.onPrimary} />
            <Text style={styles.unlockText}>Level {record.unlocked_level} unlocked!</Text>
          </FadeIn>
        )}

        <FadeIn delay={350} style={styles.tiles}>
          <Tile value={record.pronunciation} label="Pronunciation" />
          <Tile value={record.fluency} label="Fluency" />
          <Tile value={record.completeness ?? 0} label="Completeness" />
        </FadeIn>

        {record.engine === 'demo' && (
          <FadeIn delay={450} style={styles.demo}>
            <Ionicons name="information-circle-outline" size={18} color={colors.text} />
            <Text style={styles.demoText}>
              Demo scores: these ratings are placeholders. Add your Azure Speech key in backend/.env to get real ones.
            </Text>
          </FadeIn>
        )}

        <FadeIn delay={550}>
          <Pressable onPress={() => router.push('/community')} style={styles.rank} accessibilityRole="button" accessibilityLabel={`My ${language} Community`}>
            <View style={styles.rankIcon}>
              <Ionicons name="trophy-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rankTitle}>My {language} Community</Text>
              <Text style={styles.rankSub}>{me ? `You are #${me.rank} with ${me.flowers} flowers` : 'See the leaderboard'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </FadeIn>

        {record.words.length > 0 && (
          <FadeIn delay={700} style={styles.words}>
            <Text style={styles.eyebrowLeft}>PERSONAL FEEDBACK</Text>
            <Text style={styles.sectionTitle}>Practise these</Text>
            {record.words.map((w) => (
              <RetryWordRow key={w.id} word={w} onSubmit={(word, take) => retryWord(record.id, word.id, take)} />
            ))}
          </FadeIn>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label="Continue" onPress={() => goHub(router, '/courses')} />
        <SecondaryButton label="Share my result" icon="share-outline" onPress={() => setSharing(true)} />
      </View>
      {shots > 0 && <ConfettiCannon shots={shots} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md },
  eyebrow: { ...typography.eyebrow, color: colors.primary, textAlign: 'center' },
  eyebrowLeft: { ...typography.eyebrow, color: colors.primary },
  gradeWrap: { alignSelf: 'center' },
  gradeBadge: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', borderWidth: 8, borderColor: 'rgba(255,255,255,0.8)', ...shadows.lift() },
  gradeText: { ...typography.score, color: colors.onPrimary },
  title: { ...typography.headline, color: colors.text, textAlign: 'center' },
  rewardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  reward: { ...typography.label, color: colors.primary },
  unlock: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primary, borderRadius: radius.full, paddingVertical: spacing.xs, paddingHorizontal: spacing.s12 },
  unlockText: { ...typography.labelSm, color: colors.onPrimary },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.line, ...shadows.card() },
  tileLabel: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  demo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.highlight, borderRadius: radius.md, padding: spacing.s12 },
  demoText: { ...typography.labelSm, color: colors.text, flex: 1, lineHeight: 16 },
  rank: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, backgroundColor: colors.selectedBg, borderRadius: radius.lg, padding: spacing.md },
  rankIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  rankTitle: { ...typography.title, color: colors.text },
  rankSub: { ...typography.caption, color: colors.textMuted },
  words: { gap: spacing.s12 },
  sectionTitle: { ...typography.headline, color: colors.text },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
});
