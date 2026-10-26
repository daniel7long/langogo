import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { speakFrench } from '../utils/speech';
import { colors, radius, spacing, typography } from '../theme';

const STATUS_LABEL = { new: 'New', learning: 'Learning', mastered: 'Mastered' };

// One saved word in Vocab Notes. Tap the row to see its example sentences.
// The five dots show how far the word has climbed the review ladder (all filled = mastered).
export default function NoteRow({ note, onRemove }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.row}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.main}>
        <View style={styles.head}>
          <Text style={styles.word}>{note.word}</Text>
          <Pressable onPress={() => speakFrench(note.word)} hitSlop={8} accessibilityLabel={`Play ${note.word}`}>
            <Ionicons name="volume-high-outline" size={18} color={colors.text} />
          </Pressable>
          <View style={styles.flex} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{note.cefr}</Text>
          </View>
        </View>
        <Text style={styles.meaning}>
          {note.ipa}  ·  ({note.pos}) {note.meaning}
        </Text>
        <View style={styles.statusRow}>
          <View style={styles.dots} accessibilityLabel={`${STATUS_LABEL[note.status]}, step ${note.box} of 4`}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.dot, note.box >= i && styles.dotOn]} />
            ))}
          </View>
          <Text style={[styles.status, note.status === 'mastered' && styles.statusMastered]}>
            {STATUS_LABEL[note.status]}
            {note.due && note.status !== 'new' ? ' · due' : ''}
          </Text>
        </View>
      </Pressable>

      {open && (
        <View style={styles.more}>
          {note.examples.map((ex, i) => (
            <View key={i} style={styles.example}>
              <Text style={styles.fr}>{ex.fr}</Text>
              <Text style={styles.en}>{ex.en}</Text>
            </View>
          ))}
          <Pressable onPress={onRemove} style={styles.remove} accessibilityRole="button">
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={styles.removeText}>Remove from notes</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider },
  main: { padding: spacing.s12, gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  word: { ...typography.label, color: colors.text },
  badge: { backgroundColor: colors.selectedBg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { ...typography.labelSm, color: colors.accentText },
  meaning: { ...typography.body, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.divider },
  dotOn: { backgroundColor: colors.primary },
  status: { ...typography.caption, color: colors.textMuted },
  statusMastered: { color: colors.lessonCompleted },
  more: { borderTopWidth: 1, borderTopColor: colors.divider, padding: spacing.s12, gap: spacing.sm },
  example: { gap: 2 },
  fr: { ...typography.body, color: colors.text },
  en: { ...typography.labelSm, color: colors.textMuted },
  remove: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', marginTop: spacing.xs },
  removeText: { ...typography.labelSm, color: colors.error },
});
