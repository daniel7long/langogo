import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

const NATIVE = Platform.OS !== 'web';

// A soft pulsing placeholder block shown while a screen loads.
export function SkeletonBlock({ width = '100%', height = 14, round = false, style }) {
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0.55, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: round ? height / 2 : radius.sm, backgroundColor: '#EDE5DC', opacity: v }, style]}
    />
  );
}

// The loading layout of the Courses screen (top bar, level card, five lesson rows).
export function CoursesSkeleton() {
  return (
    <View style={styles.page} accessibilityLabel="Loading your lessons">
      <View style={styles.top}>
        <SkeletonBlock width={24} height={14} />
        <SkeletonBlock width="auto" height={10} round style={{ flex: 1 }} />
        <SkeletonBlock width={24} height={14} />
        <SkeletonBlock width={64} height={36} round />
        <SkeletonBlock width={44} height={44} round />
      </View>
      <View style={styles.level}>
        <SkeletonBlock width={90} height={10} />
        <SkeletonBlock width="70%" height={22} style={{ marginTop: 10 }} />
        <SkeletonBlock width="45%" height={12} style={{ marginTop: 10 }} />
      </View>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.row}>
          <SkeletonBlock width={46} height={46} round />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBlock width="60%" height={14} />
            <SkeletonBlock width="38%" height={10} />
          </View>
          <SkeletonBlock width={34} height={26} round />
        </View>
      ))}
    </View>
  );
}

// A generic list placeholder for other screens.
export function ListSkeleton({ rows = 4 }) {
  return (
    <View style={styles.page} accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <SkeletonBlock width={46} height={46} round />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBlock width="65%" height={14} />
            <SkeletonBlock width="40%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.s12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 56 },
  level: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, padding: spacing.s12, minHeight: 78, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
});
