import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import Flag from './Flag';
import IconButton from './IconButton';
import Logo from './Logo';
import { colors, radius, shadows, spacing, typography } from '../theme';

const NATIVE = Platform.OS !== 'web';

const ITEMS = [
  { label: 'Courses', icon: 'book-outline', path: '/courses' },
  { label: 'Vocab Notes', icon: 'journal-outline', path: '/vocab-notes' },
  { label: 'My Community', icon: 'people-outline', path: '/community' },
  { label: 'Settings', icon: 'settings-outline', path: '/settings' },
];

// The drawer that slides in from the left when you tap the menu button on the Courses screen.
// Render it as the LAST child of a full-screen View. `active` is the item that is open now.
export default function NavMenu({ visible, onClose, language, active = 'Courses' }) {
  const router = useRouter();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 1 : 0, duration: visible ? 260 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [visible, slide]);

  if (!visible) return null;

  const go = (item) => {
    onClose();
    if (item.label !== active) router.push(item.path);
  };

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-360, 0] }) }] }]}>
        <View style={styles.head}>
          <Logo width={112} />
          <IconButton name="close" label="Close menu" onPress={onClose} />
        </View>

        {language && (
          <View style={styles.learning}>
            <Flag id={language.id} width={52} round ring />
            <View style={styles.learningText}>
              <Text style={styles.eyebrow}>Learning</Text>
              <Text style={styles.langName}>{language.name}</Text>
              {!!language.native && <Text style={styles.langNative}>{language.native}</Text>}
            </View>
            <Pressable
              onPress={() => {
                onClose();
                router.push({ pathname: '/language', params: { change: '1' } });
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Change language"
            >
              <Text style={styles.change}>Change</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.items}>
          {ITEMS.map((item) => {
            const on = item.label === active;
            return (
              <Pressable
                key={item.label}
                onPress={() => go(item)}
                style={[styles.item, on && styles.itemOn]}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.itemIcon, on && styles.itemIconOn]}>
                  <Ionicons name={item.icon} size={20} color={on ? colors.primary : colors.textMuted} />
                </View>
                <Text style={[styles.itemLabel, on && { color: colors.primary }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Ionicons name="flower-outline" size={18} color={colors.greenText} />
          <Text style={styles.footerText}>A little speaking every day adds up.</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '82%',
    maxWidth: 360,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    ...shadows.lift(),
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  learning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s12,
    padding: spacing.s12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card(),
  },
  learningText: { flex: 1 },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  langName: { ...typography.title, color: colors.text },
  langNative: { ...typography.caption, color: colors.textMuted },
  change: { ...typography.labelSm, color: colors.primary },
  items: { marginTop: spacing.md, gap: spacing.xs, flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, minHeight: 56, paddingHorizontal: spacing.sm, borderRadius: radius.lg },
  itemOn: { backgroundColor: colors.selectedBg },
  itemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  itemIconOn: { backgroundColor: colors.surface },
  itemLabel: { ...typography.label, color: colors.textMuted, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.s12, borderRadius: radius.lg, backgroundColor: colors.green100 },
  footerText: { ...typography.labelSm, color: colors.greenText, flex: 1 },
});
