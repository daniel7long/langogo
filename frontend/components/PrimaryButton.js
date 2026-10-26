import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import PressableScale from './PressableScale';
import { colors, radius, shadows, sizes, spacing, typography } from '../theme';

// The main orange button. `icon` puts an Ionicons arrow or similar after the label.
export default function PrimaryButton({ label, onPress, disabled = false, loading = false, icon, style }) {
  const inactive = disabled || loading;
  const [pressed, setPressed] = useState(false);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={inactive}
      style={[styles.button, pressed && !inactive && styles.pressed, inactive && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <>
          <Text style={styles.label}>{label}</Text>
          {icon ? <Ionicons name={icon} size={20} color={colors.onPrimary} /> : null}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: sizes.buttonHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    ...shadows.button(),
  },
  pressed: { backgroundColor: colors.primaryPressed },
  disabled: { backgroundColor: colors.primaryDisabled, opacity: 0.9 },
  label: { ...typography.button, color: colors.onPrimary },
});
