import { useRef } from 'react';
import { Animated, Platform, Pressable } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const NATIVE = Platform.OS !== 'web';

// A Pressable that shrinks a little while it is held down and springs back, so every tap
// gives immediate feedback. `style` must be an object or array (not a function).
export default function PressableScale({ style, scaleTo = 0.97, onPressIn, onPressOut, children, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: NATIVE, speed: 40, bounciness: 6 }).start();

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
