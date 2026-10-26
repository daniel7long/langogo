import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getLeaderboard, getRecords } from '../api/app';
import AsyncState from '../components/AsyncState';
import Chip from '../components/Chip';
import PrimaryButton from '../components/PrimaryButton';
import RecordRow from '../components/RecordRow';
import Screen from '../components/Screen';
import TopBar from '../components/TopBar';
import useAsync from '../hooks/useAsync';
import { goHub } from '../utils/nav';
import { colors, radius, shadows, spacing, typography } from '../theme';

// "My French Community": the leaderboard, your totals and your lesson records.
// Speaking speed and other research data are kept on the server and never shown here.
export default function CommunityScreen() {
  const router = useRouter();
  const state = useAsync(async () => {
    const [board, records] = await Promise.all([getLeaderboard(), getRecords()]);
    return { board, records };
  }, []);

  return (
    <Screen>
      <AsyncState state={state} skeleton="list">
        {({ board, records }) => <View style={styles.flex}><Body board={board} records={records} router={router} /></View>}
      </AsyncState>
    </Screen>
  );
}

function Body({ board, records, router }) {
  const me = board.find((r) => r.you);
  const avg = records.length
    ? Math.round(records.reduce((s, r) => s + (r.pronunciation + r.fluency) / 2, 0) / records.length)
    : null;
  const language = records[0]?.language ?? 'French';

  return (
    <>
      <TopBar title={`My ${language} Community`} onBack={() => goHub(router, '/courses')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.chips}>
          <Chip icon="checkmark-circle-outline" tone="green" label={`${records.length} lesson${records.length === 1 ? '' : 's'} completed`} />
          {avg !== null && <Chip icon="ribbon-outline" tone="teal" label={`Average score ${avg}`} />}
          {me && <Chip icon="flower-outline" tone="orange" label={`${me.flowers} flowers`} />}
        </View>

        <Text style={styles.eyebrow}>LEADERBOARD</Text>
        <View style={styles.board}>
          {board.map((row) => (
            <View key={row.name} style={[styles.row, row.you && styles.rowYou]}>
              <View style={[styles.rank, row.rank <= 3 && styles.rankTop]}>
                {row.rank <= 3 ? (
                  <Ionicons name="trophy-outline" size={16} color={colors.primary} />
                ) : (
                  <Text style={styles.rankNo}>{row.rank}</Text>
                )}
              </View>
              <View style={styles.avatar}>
                <Text style={styles.initial}>{row.name.charAt(0)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>{row.you ? `${row.name} (you)` : row.name}</Text>
                <Text style={styles.level}>Level {row.level}</Text>
              </View>
              <Text style={styles.flowers}>{row.flowers}</Text>
              <Ionicons name="flower-outline" size={16} color={colors.primary} />
            </View>
          ))}
        </View>

        <Text style={styles.eyebrow}>YOUR LESSON RECORDS</Text>
        {records.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="mic-outline" size={28} color={colors.primary} />
            <Text style={styles.emptyTitle}>No records yet</Text>
            <Text style={styles.emptyText}>Finish a lesson and your result will show up here, with the words to practise.</Text>
          </View>
        ) : (
          <View style={styles.records}>
            {records.map((r) => (
              <RecordRow key={r.id} record={r} onPress={() => router.push({ pathname: '/retry', params: { id: r.id } })} />
            ))}
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label="Back to lessons" onPress={() => goHub(router, '/courses')} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.s12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.primary, marginTop: spacing.sm },
  board: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.sm, gap: 2, borderWidth: 1, borderColor: colors.line, ...shadows.card() },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, paddingVertical: spacing.sm, paddingHorizontal: spacing.s12, borderRadius: radius.md },
  rowYou: { backgroundColor: colors.selectedBg },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankTop: { backgroundColor: colors.selectedBg },
  rankNo: { ...typography.labelSm, color: colors.textMuted },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lessonCompleted, alignItems: 'center', justifyContent: 'center' },
  initial: { ...typography.label, color: colors.onPrimary },
  name: { ...typography.label, color: colors.text },
  level: { ...typography.caption, color: colors.textMuted },
  flowers: { ...typography.label, color: colors.text },
  records: { gap: spacing.s12 },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.tint, borderRadius: radius.lg },
  emptyTitle: { ...typography.title, color: colors.text },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm },
});
