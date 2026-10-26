import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';

const NATIVE = Platform.OS !== 'web';

// Fades its content in while sliding it up a little. Use `delay` to stagger a list.
export default function FadeIn({ delay = 0, distance = 14, duration = 380, style, children }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
  }, [v, duration, delay]);

  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}
