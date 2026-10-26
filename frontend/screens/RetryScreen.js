import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getRecord, retryWord } from '../api/app';
import AsyncState from '../components/AsyncState';
import Chip from '../components/Chip';
import PrimaryButton from '../components/PrimaryButton';
import RetryWordRow from '../components/RetryWordRow';
import Screen from '../components/Screen';
import ShareSheet from '../components/ShareSheet';
import TopBar from '../components/TopBar';
import useAsync from '../hooks/useAsync';
import { goHub } from '../utils/nav';
import { colors, radius, spacing, typography } from '../theme';

// F3S5: scores for one finished lesson and its words to retry (5 flowers per retry).
export default function RetryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const state = useAsync(() => getRecord(id), [id]);
  const [sharing, setSharing] = useState(false);

  return (
    <Screen>
      <TopBar title="Retry" />
      <ShareSheet visible={sharing} recordId={id} record={state.data} onClose={() => setSharing(false)} />
      <AsyncState state={state} onBack={() => router.back()}>
        {(record) => (
          <>
            <ScrollView contentContainerStyle={styles.scroll}>
              <View style={styles.summary}>
                <View style={styles.summaryTop}>
                  <Text style={styles.summaryTitle}>Lv{record.level} - Lesson {record.lesson_no}</Text>
                  <Pressable onPress={() => setSharing(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Share">
                    <Ionicons name="open-outline" size={20} color={colors.accentText} />
                  </Pressable>
                </View>
                <Text style={styles.summarySub}>Completed lesson in Lv{record.level}</Text>
                <View style={styles.scores}>
                  <Chip tone="orange" label={`Grade ${record.grade}`} />
                  <Chip tone="teal" label={`Pronunciation ${record.pronunciation}`} />
                  <Chip tone="green" label={`Fluency ${record.fluency}`} />
                </View>
              </View>

              <Text style={styles.earn}>Earn 5 flowers for each retry!</Text>
              <View style={styles.words}>
                {record.words.length === 0 && <Text style={styles.empty}>Nothing to retry.</Text>}
                {record.words.map((w) => (
                  <RetryWordRow key={w.id} word={w} onSubmit={(word, take) => retryWord(record.id, word.id, take)} />
                ))}
              </View>
            </ScrollView>
            <View style={styles.footer}>
              <PrimaryButton label="Back to lessons" onPress={() => goHub(router, '/courses')} />
            </View>
          </>
        )}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md },
  summary: { backgroundColor: colors.selectedBg, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTitle: { ...typography.title, color: colors.text },
  summarySub: { ...typography.body, color: colors.text },
  scores: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  score: { ...typography.labelSm, color: colors.text },
  earn: { ...typography.label, color: colors.accentText },
  words: { gap: spacing.s12 },
  empty: { ...typography.body, color: colors.textMuted },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
