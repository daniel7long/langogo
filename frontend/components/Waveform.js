import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const NATIVE = Platform.OS !== 'web';

// Little bouncing bars. `active` animates them; otherwise they rest at a low height.
export default function Waveform({ active, color = colors.primary, bars = 12, height = 24 }) {
  const values = useRef(Array.from({ length: bars }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (!active) {
      values.forEach((v) => v.setValue(0.3));
      return undefined;
    }
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 280 + (i % 5) * 90, useNativeDriver: NATIVE }),
          Animated.timing(v, { toValue: 0.25, duration: 280 + (i % 4) * 110, useNativeDriver: NATIVE }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, values]);

  return (
    <View style={[styles.row, { height }]} accessibilityElementsHidden importantForAccessibility="no">
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{ width: 3, height, borderRadius: 2, backgroundColor: color, transform: [{ scaleY: v }] }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
