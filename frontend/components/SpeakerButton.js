import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme';

const NATIVE = Platform.OS !== 'web';
const WAVES = ['volume-low', 'volume-medium', 'volume-high', 'volume-medium'];

// The little speaker on a bubble. While its line is playing, the button turns orange, the sound
// waves grow and shrink, and a soft ring pulses around it. At rest it is a quiet white circle.
export default function SpeakerButton({ playing, onPress, label = 'Play audio', size = 36 }) {
  const [frame, setFrame] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!playing) {
      setFrame(0);
      pulse.setValue(0);
      return undefined;
    }
    const tick = setInterval(() => setFrame((f) => (f + 1) % WAVES.length), 260);
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: NATIVE }));
    loop.start();
    return () => {
      clearInterval(tick);
      loop.stop();
    };
  }, [playing, pulse]);

  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={playing ? `${label} (playing)` : label}>
      <View style={{ width: size, height: size }}>
        {playing && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
              },
            ]}
          />
        )}
        <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, playing && styles.circleOn]}>
          <Ionicons name={playing ? WAVES[frame] : 'volume-high-outline'} size={size * 0.52} color={playing ? colors.onPrimary : colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', backgroundColor: colors.primary },
  circle: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  circleOn: { backgroundColor: colors.primary },
});
