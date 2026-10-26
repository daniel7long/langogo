import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import { registerDialogHost } from '../utils/dialog';
import { colors, radius, shadows, spacing, typography } from '../theme';

const NATIVE = Platform.OS !== 'web';

// The calm "Leave this lesson?" style dialog used by notify() and confirm() everywhere in the app.
// Mounted once in src/app/_layout.tsx. Requests queue up if several arrive together.
export default function DialogHost() {
  const [queue, setQueue] = useState([]);
  const pop = useRef(new Animated.Value(0)).current;
  const current = queue[0];

  useEffect(() => registerDialogHost((req) => setQueue((q) => [...q, req])), []);

  useEffect(() => {
    if (!current) return;
    pop.setValue(0);
    Animated.timing(pop, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [current, pop]);

  if (!current) return null;
  const close = (answer) => {
    current.resolve(answer);
    setQueue((q) => q.slice(1));
  };
  const hasChoice = !!current.cancelLabel;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(false)}>
      <Pressable style={styles.backdrop} onPress={() => close(false)} accessibilityLabel="Close dialog">
        <Animated.View
          style={[styles.card, { opacity: pop, transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }, { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]}
        >
          <Pressable onPress={() => {}} style={styles.inner}>
            <View style={styles.icon}>
              <Ionicons name={hasChoice ? 'leaf-outline' : 'information-circle-outline'} size={26} color={colors.primary} />
            </View>
            <Text style={styles.title} accessibilityRole="header">{current.title}</Text>
            {!!current.message && <Text style={styles.message}>{current.message}</Text>}
            <View style={styles.actions}>
              {hasChoice ? (
                <>
                  <PrimaryButton label={current.cancelLabel} onPress={() => close(false)} />
                  <SecondaryButton label={current.confirmLabel} onPress={() => close(true)} />
                </>
              ) : (
                <PrimaryButton label={current.confirmLabel} onPress={() => close(true)} />
              )}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 360, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadows.lift() },
  inner: { padding: spacing.lg, alignItems: 'center' },
  icon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.selectedBg, marginBottom: spacing.s12 },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
});
