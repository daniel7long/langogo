import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, typography } from '../theme';

// A circular gauge with the score in the middle. The ring and the number count up together.
export default function ScoreRing({ value, color, size = 68, stroke = 7, delay = 350 }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: x }) => setShown(x));
    Animated.timing(v, { toValue: value, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [value, delay]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const half = size / 2;
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`${value} out of 100`}>
      <Svg width={size} height={size}>
        <Circle cx={half} cy={half} r={r} stroke="#F3E6D9" strokeWidth={stroke} fill="none" />
        <Circle
          cx={half}
          cy={half}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - Math.min(shown, 100) / 100)}
          rotation="-90"
          origin={`${half}, ${half}`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.number}>{Math.round(shown)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  number: { ...typography.label, color: colors.text },
});
