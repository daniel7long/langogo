import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TopicArt from './TopicArt';
import { colors, radius, spacing, typography } from '../theme';

// Small card with the topic, its CEFR level and an Unlock chip (Profile and Unlock Topics).
export default function TopicCard({ topic, onPress, onUnlock, width }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.card, width != null && { width }]}>
      <View style={styles.top}>
        <TopicArt topicId={topic.id} width={44} height={44} />
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>{topic.name}</Text>
          <Text style={styles.level}>{topic.cefr}</Text>
        </View>
      </View>
      {topic.unlocked ? (
        <View style={[styles.chip, styles.chipDone]}>
          <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
          <Text style={styles.chipText}>Unlocked</Text>
        </View>
      ) : (
        <Pressable
          onPress={onUnlock}
          accessibilityRole="button"
          accessibilityLabel={`Unlock ${topic.name} for ${topic.cost} flowers`}
          style={styles.chip}
        >
          <Ionicons name="flower-outline" size={14} color={colors.onPrimary} />
          <Text style={styles.chipText}>{topic.cost}  Unlock</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.s12, gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { flex: 1 },
  name: { ...typography.label, color: colors.text },
  level: { ...typography.labelSm, color: colors.textMuted },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.xs + 2,
  },
  chipDone: { backgroundColor: colors.lessonCompleted },
  chipText: { ...typography.labelSm, color: colors.onPrimary },
});
