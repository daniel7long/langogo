import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import PressableScale from './PressableScale';
import { colors, shadows } from '../theme';

// A round white button with one icon: back, close, menu, speaker ... (44px, 48px tap area with hitSlop).
export default function IconButton({ name, onPress, label, size = 44, iconSize = 22, color = colors.text, style, filled }) {
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={6}
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        { width: size, height: size, borderRadius: size / 2 },
        filled && { backgroundColor: colors.primary, borderColor: colors.primary },
        style,
      ]}
    >
      <Ionicons name={name} size={iconSize} color={filled ? colors.onPrimary : color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card(),
  },
});
