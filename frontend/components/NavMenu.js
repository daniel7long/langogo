import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';

import Text from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getMe } from '../api/app';
import Avatar from './Avatar';
import Flag from './Flag';
import { WallpaperArt, wallTone } from './GiftArt';
import IconButton from './IconButton';
import Logo from './Logo';
import { colors, radius, shadows, spacing, typography } from '../theme';

const NATIVE = Platform.OS !== 'web';

const ITEMS = [
  { label: 'Courses', icon: 'book-outline', path: '/courses' },
  { label: 'Find My Level', icon: 'compass-outline', path: '/level-test', params: { purpose: 'match' }, only: 'fr' },
  { label: 'Free Talk', icon: 'chatbubbles-outline', path: '/free-talk' },
  { label: 'Vocab Notes', icon: 'journal-outline', path: '/vocab-notes' },
  { label: 'My Community', icon: 'people-outline', path: '/community' },
  { label: 'Gift Menu', icon: 'gift-outline', path: '/gifts' },
  { label: 'Settings', icon: 'settings-outline', path: '/settings' },
];

// The drawer that slides in from the left when you tap the menu button on the Courses screen.
// Render it as the LAST child of a full-screen View. `active` is the item that is open now.
export default function NavMenu({ visible, onClose, language, active = 'Courses' }) {
  const router = useRouter();
  const slide = useRef(new Animated.Value(0)).current;
  const [me, setMe] = useState(null); // name, picture, flowers and what the learner wears (Gift Menu)

  useEffect(() => {
    if (!visible) return undefined;
    let live = true;
    getMe().then((m) => live && setMe(m)).catch(() => {});
    return () => {
      live = false;
    };
  }, [visible]);

  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 1 : 0, duration: visible ? 260 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [visible, slide]);

  if (!visible) return null;

  // What the learner wears in the Gift Menu: the picture gets its outfit and frame, the wallpaper fills the header, and the
  // text switches between light and dark so it stays readable on it.
  const wall = me?.equipped?.wallpaper;
  const dressed = !!(me?.equipped?.outfit || me?.equipped?.frame);
  const onDark = wall ? wallTone(wall) === 'dark' : false;
  const ink = wall ? (onDark ? '#FFFFFF' : colors.text) : colors.text;
  const accent = wall ? (onDark ? '#FFFFFF' : colors.primary) : colors.primary;
  const shadow = wall && onDark ? { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 } : null;

  const go = (item) => {
    onClose();
    if (item.label !== active) router.push(item.params ? { pathname: item.path, params: item.params } : item.path);
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
            {wall ? (
              <>
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <WallpaperArt id={wall} width={360} height={120} />
                </View>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: onDark ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.55)' }]} pointerEvents="none" />
              </>
            ) : null}
            <Avatar name={me?.name} photoUrl={me?.photo_url} size={dressed ? 60 : 50} equipped={me?.equipped} />
            <View style={styles.nameCol}>
              <Text style={[styles.userName, { color: ink }, shadow]} numberOfLines={1}>{me?.name || 'You'}</Text>
              <Text style={[styles.eyebrow, { color: accent }, shadow]}>{me?.level ? `Level ${me.level}` : 'Learning'}</Text>
            </View>
            <View style={styles.rightBlock}>
              <View style={styles.rightRow}>
                <Flag id={language.id} width={26} round />
                <View style={styles.flowerRow}>
                  <Ionicons name="flower" size={16} color={accent} />
                  <Text style={[styles.flowerNum, { color: ink }, shadow]}>{me ? me.flowers : '–'}</Text>
                </View>
              </View>
              <View style={styles.rightRow}>
                <Text style={[styles.langName, { color: ink }, shadow]} numberOfLines={1}>{language.name}</Text>
                <Pressable
                  onPress={() => {
                    onClose();
                    router.push({ pathname: '/language', params: { change: '1' } });
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Change language"
                >
                  <Text style={[styles.change, { color: accent }, shadow]}>Change</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <View style={styles.items}>
          {ITEMS.filter((item) => !item.only || language?.id === item.only).map((item) => {
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
    gap: spacing.sm,
    overflow: 'hidden',
    padding: spacing.s12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card(),
  },
  nameCol: { flex: 1, minWidth: 0 },
  rightBlock: { gap: 6, alignItems: 'flex-end' },
  rightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.s12 },
  userName: { ...typography.label },
  flowerRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  flowerNum: { ...typography.label },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  langName: { ...typography.caption, color: colors.text },
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
