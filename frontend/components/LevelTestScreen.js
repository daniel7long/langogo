import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { fetchFrenchTest, submitFrenchTest } from '../api/tests';
import Logo from './Logo';
import OptionRow from './OptionRow';
import PrimaryButton from './PrimaryButton';
import Screen from './Screen';
import { colors, spacing, typography } from '../theme';

export default function LevelTestScreen() {
  const router = useRouter();

  const [test, setTest] = useState(null); // { title, time_limit_minutes, questions: [...] }
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionId }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadTest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTest(await fetchFrenchTest());
    } catch (e) {
      setError("Couldn't load the test. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTest();
  }, [loadTest]);

  const total = test?.questions.length ?? 0;
  const question = test?.questions[index];
  const isLast = index === total - 1;
  const selected = question ? answers[question.id] : undefined;

  const payload = useMemo(
    () => Object.entries(answers).map(([question_id, option_id]) => ({ question_id, option_id })),
    [answers]
  );

  const handleNext = async () => {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitFrenchTest(payload);
      router.replace({ pathname: '/test-result', params: { id: result.id } });
    } catch (e) {
      setError("Couldn't submit your answers. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!test) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <View style={styles.retry}>
            <PrimaryButton label="Try again" onPress={loadTest} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.body}>
        <Logo width={160} />

        <Text style={styles.title} accessibilityRole="header">
          {test.title}
        </Text>
        <Text style={styles.subtitle}>
          Complete {total} questions in {test.time_limit_minutes} minute
        </Text>

        <View style={styles.questionBlock}>
          <Text style={styles.questionLabel}>Question {index + 1}</Text>
          <Text style={styles.prompt}>{question.prompt}</Text>

          <View style={styles.options} accessibilityRole="radiogroup">
            {question.options.map((opt) => (
              <OptionRow
                key={opt.id}
                text={opt.text}
                selected={selected === opt.id}
                onPress={() => setAnswers((a) => ({ ...a, [question.id]: opt.id }))}
              />
            ))}
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.footer}>
        {index > 0 && (
          <Pressable onPress={() => setIndex((i) => i - 1)} style={styles.back}>
            <Text style={styles.backText}>Previous</Text>
          </Pressable>
        )}
        <PrimaryButton
          label={isLast ? 'Soumettre' : 'Suivant'}
          onPress={handleNext}
          disabled={!selected}
          loading={submitting}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, alignItems: 'center' },
  title: { ...typography.display, color: colors.text, textAlign: 'center', marginTop: spacing.lg },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  questionBlock: { alignSelf: 'stretch', marginTop: spacing.xl },
  questionLabel: { ...typography.label, color: colors.text },
  prompt: { ...typography.body, color: colors.text, marginTop: spacing.sm },
  options: { marginTop: spacing.md, gap: spacing.s12 },
  error: { ...typography.body, color: colors.error, marginTop: spacing.md, textAlign: 'center' },
  retry: { alignSelf: 'stretch', marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  back: { alignSelf: 'center', paddingVertical: spacing.xs },
  backText: { ...typography.caption, color: colors.textMuted },
});
