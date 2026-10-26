import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '../theme';

const TONES = {
  orange: { bg: colors.selectedBg, fg: colors.primary },
  green: { bg: colors.green100, fg: colors.greenText },
  teal: { bg: colors.tealBg, fg: '#146B7B' },
  amber: { bg: colors.amberBg, fg: '#8A5F00' },
  coral: { bg: colors.coralBg, fg: '#A8392E' },
  grey: { bg: colors.card, fg: colors.textMuted },
};

// A small rounded label, optionally with an icon: "3-day streak", "A+", "Current".
export default function Chip({ label, icon, tone = 'orange', style, textStyle }) {
  const t = TONES[tone] ?? TONES.orange;
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }, style]}>
      {icon ? <Ionicons name={icon} size={14} color={t.fg} /> : null}
      <Text style={[styles.text, { color: t.fg }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: spacing.s12,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  text: { ...typography.labelSm },
});
