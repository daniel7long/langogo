import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

// Green banner with the lesson title (F2S2 to F2S4).
export default function LessonBanner({ title, subtitle }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.lessonCompleted,
    borderRadius: radius.md,
    paddingVertical: spacing.s12,
    paddingHorizontal: spacing.md,
  },
  title: { ...typography.label, color: colors.onPrimary },
  subtitle: { ...typography.labelSm, color: colors.onPrimary, marginTop: 2 },
});
