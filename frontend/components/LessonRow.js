import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Chip from './Chip';
import PressableScale from './PressableScale';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { gradeColors } from '../utils/score';

const NATIVE = Platform.OS !== 'web';

// The "Start" pill breathes gently so the next lesson is easy to find.
function StartPill() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View style={[styles.start, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }]}>
      <Text style={styles.startText}>Start</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.onPrimary} />
    </Animated.View>
  );
}

// One lesson card: done (green check and grade), current (orange outline and Start) or locked (soft grey).
export default function LessonRow({ no, title, subtitle, status, grade, onPress, height }) {
  const done = status === 'completed';
  const current = status === 'current' || status === 'available';
  const locked = status === 'locked';
  const g = grade ? gradeColors(grade) : null;
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Lesson ${no}, ${title}, ${locked ? 'locked' : done ? `completed${grade ? `, grade ${grade}` : ''}` : 'start'}`}
      style={[styles.row, current && styles.rowCurrent, locked && styles.rowLocked, height ? { minHeight: height } : null]}
    >
      <View style={[styles.badge, done && styles.badgeDone, current && styles.badgeCurrent, locked && styles.badgeLocked]}>
        <Text style={[styles.badgeText, done && { color: colors.greenText }, current && { color: colors.onPrimary }, locked && { color: colors.textFaint }]}>
          {no}
        </Text>
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, locked && styles.titleLocked]} numberOfLines={2}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, locked && styles.subtitleLocked]}>{subtitle}</Text>}
      </View>
      {done && (
        <View style={styles.right}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
          </View>
          {g && <Chip label={grade} style={{ backgroundColor: g.bg }} textStyle={{ color: g.fg }} />}
        </View>
      )}
      {current && <StartPill />}
      {locked && <Ionicons name="lock-closed-outline" size={20} color={colors.textFaint} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: spacing.s12,
    paddingHorizontal: spacing.md,
    ...shadows.card(),
  },
  rowCurrent: { borderColor: colors.primary, backgroundColor: colors.tint },
  rowLocked: { backgroundColor: '#FAF6F1', borderColor: '#EFE7DE' },
  badge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeDone: { backgroundColor: colors.green100 },
  badgeCurrent: { backgroundColor: colors.primary },
  badgeLocked: { backgroundColor: '#EFE8E0' },
  badgeText: { ...typography.title },
  text: { flex: 1, gap: 2 },
  title: { ...typography.label, color: colors.text },
  titleLocked: { color: colors.textFaint },
  subtitle: { ...typography.caption, color: colors.textMuted },
  subtitleLocked: { color: colors.textFaint },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lessonCompleted, alignItems: 'center', justifyContent: 'center' },
  start: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: spacing.md, paddingRight: spacing.s12, height: 36, borderRadius: radius.full, backgroundColor: colors.primary, ...shadows.button() },
  startText: { ...typography.labelSm, color: colors.onPrimary },
});
