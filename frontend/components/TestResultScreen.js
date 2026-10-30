import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { fetchFrenchResult } from '../api/tests';
import Logo from './Logo';
import PrimaryButton from './PrimaryButton';
import ScoreGauge from './ScoreGauge';
import Screen from './Screen';
import { colors, spacing, typography } from '../theme';

export default function TestResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError('No test result to show yet.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchFrenchResult(id));
    } catch (e) {
      setError("Couldn't load your result.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!result) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <View style={styles.errorActions}>
            {id && <PrimaryButton label="Try again" onPress={load} />}
            <Pressable onPress={() => router.replace('/level-test')} style={styles.link}>
              <Text style={styles.linkText}>Retake the test</Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Logo width={160} />

        <Text style={styles.title} accessibilityRole="header">
          My Test Result
        </Text>
        <Text style={styles.score}>
          Score {result.score}/{result.max_score}
        </Text>

        <View style={styles.gauge}>
          <ScoreGauge score={result.score} level={result.level} maxScore={result.max_score} />
        </View>

        <View style={styles.breakdown}>
          <Text style={styles.part}>Sentences {result.completion_score}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.part}>Speaking {result.speech_score}</Text>
        </View>
        <View style={styles.start}>
          <Text style={styles.startLabel}>You start at</Text>
          <Text style={styles.startTitle}>
            Level {result.start_level} · Lesson {result.start_lesson_no}
          </Text>
          <Text style={styles.startLesson}>{result.start_lesson_title}</Text>
        </View>

        <Text style={styles.message}>
          <Text style={styles.highlight}>{result.recommended_minutes_per_day} minutes</Text> per day
          {'\n'}You can become{'\n'}a master of French
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Suivant" onPress={() => router.push('/favorite-topics')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  scroll: { flex: 1 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center' },
  title: { ...typography.display, color: colors.text, textAlign: 'center', marginTop: spacing.lg },
  score: { ...typography.label, color: colors.text, marginTop: spacing.sm },
  gauge: { marginTop: spacing.lg },
  breakdown: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, marginTop: spacing.md },
  part: { ...typography.caption, color: colors.textMuted },
  dot: { ...typography.caption, color: colors.textMuted },
  start: { alignItems: 'center', marginTop: spacing.md },
  startLabel: { ...typography.eyebrow, color: colors.primary },
  startTitle: { ...typography.title, color: colors.text, marginTop: 2 },
  startLesson: { ...typography.body, color: colors.textMuted },
  message: {
    ...typography.display,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  highlight: { color: colors.accentText },
  error: { ...typography.body, color: colors.error, textAlign: 'center' },
  errorActions: { alignSelf: 'stretch', marginTop: spacing.md, gap: spacing.sm },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
  linkText: { ...typography.label, color: colors.accentText },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
