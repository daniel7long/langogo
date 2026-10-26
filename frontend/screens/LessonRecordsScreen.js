import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getRecords } from '../api/app';
import AsyncState from '../components/AsyncState';
import PrimaryButton from '../components/PrimaryButton';
import RecordRow from '../components/RecordRow';
import Screen from '../components/Screen';
import TopBar from '../components/TopBar';
import useAsync from '../hooks/useAsync';
import { goHub } from '../utils/nav';
import { spacing } from '../theme';

// F3S4: every speaking record, newest first.
export default function LessonRecordsScreen() {
  const router = useRouter();
  const state = useAsync(() => getRecords(), []);

  return (
    <Screen>
      <TopBar title="Lesson Records" />
      <AsyncState state={state}>
        {(records) => (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
              {records.map((r) => (
                <RecordRow
                  key={r.id}
                  record={r}
                  onPress={() => router.push({ pathname: '/retry', params: { id: r.id } })}
                />
              ))}
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
  scroll: { flex: 1 },
  list: { padding: spacing.md, gap: spacing.s12 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm },
});
