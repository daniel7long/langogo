import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '../theme';

const ITEMS = [
  { id: 'account', label: 'Account', icon: 'person-outline' },
  { id: 'billing', label: 'Billings', icon: 'card-outline' },
  { id: 'privacy', label: 'Privacy', icon: 'lock-closed-outline' },
  { id: 'logout', label: 'Log out', icon: 'log-out-outline' },
];

// The menu that drops down from the gear on the Profile screen (F3S1).
// Render it as the LAST child of a full-screen View; `top` is where the menu starts.
export default function SettingsMenu({ visible, onClose, onSelect, top = 56 }) {
  if (!visible) return null;

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[styles.menu, { top }]}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              onClose();
              onSelect(item.id);
            }}
            style={styles.item}
            accessibilityRole="menuitem"
          >
            <Ionicons name={item.icon} size={18} color={item.id === 'logout' ? colors.error : colors.accentText} />
            <Text style={[styles.label, item.id === 'logout' && styles.logout]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 9 },
  menu: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 10,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 140,
    paddingVertical: spacing.s12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.card,
  },
  label: { ...typography.label, color: colors.text },
  logout: { color: colors.error },
});
