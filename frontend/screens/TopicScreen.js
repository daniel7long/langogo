import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getTopicLessons, unlockTopic } from '../api/app';
import AsyncState from '../components/AsyncState';
import LessonRow from '../components/LessonRow';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TopBar from '../components/TopBar';
import useAsync from '../hooks/useAsync';
import { confirm, notify } from '../utils/dialog';
import { colors, radius, spacing, typography } from '../theme';

// F3S3: the lessons inside one topic (for example Sports), locked until you unlock the topic.
export default function TopicScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const state = useAsync(() => getTopicLessons(id), [id]);

  return (
    <Screen>
      <TopBar title={state.data ? state.data.topic.name : ''} profile />
      <AsyncState state={state} onBack={() => router.back()}>
        {(data) => <TopicView data={data} reload={state.reload} />}
      </AsyncState>
    </Screen>
  );
}

function TopicView({ data, reload }) {
  const { topic, unlocked, lessons } = data;
  const [busy, setBusy] = useState(false);

  const unlock = async () => {
    const ok = await confirm('Unlock topic', `Spend ${topic.cost} flowers to unlock ${topic.name}?`, 'Unlock');
    if (!ok) return;
    setBusy(true);
    try {
      await unlockTopic(topic.id);
      reload();
    } catch (e) {
      notify("Couldn't unlock", e.message);
    } finally {
      setBusy(false);
    }
  };

  const open = (lesson) => {
    if (lesson.locked) {
      notify('Locked', `Unlock ${topic.name} to start this lesson.`);
    } else {
      notify('Coming soon', 'The content for this lesson is not available yet.');
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.list}>
        {lessons.length === 0 && <Text style={styles.empty}>No lessons in this topic yet.</Text>}
        {lessons.map((l) => (
          <LessonRow
            key={l.id}
            label={`Lesson ${l.index}`}
            title={l.title}
            status={l.locked ? 'locked' : 'available'}
            onPress={() => open(l)}
          />
        ))}
      </ScrollView>

      <View style={styles.panel}>
        <Text style={styles.pitch}>Learn {data.word_count} new words</Text>
        <Text style={styles.pitch}>{data.scenario_count}+ real-life scenarios</Text>
        {unlocked ? (
          <Text style={styles.unlocked}>Topic unlocked</Text>
        ) : (
          <PrimaryButton label="Unlock this topic" onPress={unlock} loading={busy} />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.s12 },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  panel: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pitch: { ...typography.title, color: colors.text, textAlign: 'center' },
  unlocked: { ...typography.label, color: colors.lessonCompleted, textAlign: 'center', marginTop: spacing.sm },
});
