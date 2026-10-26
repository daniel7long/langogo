import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Chip from './Chip';
import TopicArt from './TopicArt';
import { gradeColors } from '../utils/score';
import { colors, radius, shadows, spacing, typography } from '../theme';

// One speaking record (Community and Lesson Records): lesson, grade, and a way to retry the words.
export default function RecordRow({ record, onPress }) {
  const g = gradeColors(record.grade);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${record.title}, grade ${record.grade}. Open to retry`} style={styles.row}>
      <TopicArt emoji={record.emoji} width={48} height={48} />
      <View style={styles.text}>
        <Text style={styles.label}>Level {record.level} · Lesson {record.lesson_no}</Text>
        <Text style={styles.title} numberOfLines={1}>{record.title}</Text>
        <View style={styles.chips}>
          <View style={[styles.grade, { backgroundColor: g.bg }]}>
            <Text style={[styles.gradeText, { color: g.fg }]}>{record.grade}</Text>
          </View>
          <Chip label="Retry" icon="refresh" tone="orange" />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.s12, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.s12, borderWidth: 1, borderColor: colors.line, ...shadows.card(),
  },
  text: { flex: 1, gap: 2 },
  label: { ...typography.caption, color: colors.textMuted },
  title: { ...typography.title, color: colors.text },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  grade: { paddingHorizontal: spacing.s12, paddingVertical: 4, borderRadius: radius.full },
  gradeText: { ...typography.labelSm },
});
