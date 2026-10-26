import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import PressableScale from './PressableScale';
import { colors, radius, sizes, spacing, typography } from '../theme';

// Outlined orange button, for the second action next to a PrimaryButton.
export default function SecondaryButton({ label, onPress, disabled, style, icon }) {
  const [pressed, setPressed] = useState(false);
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.button, pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={colors.secondaryText} /> : null}
      <Text style={styles.label}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: sizes.buttonHeight,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.secondaryBg,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.selectedBg },
  disabled: { opacity: 0.5 },
  label: { ...typography.button, color: colors.secondaryText },
});
