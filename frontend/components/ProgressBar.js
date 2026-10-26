import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius } from '../theme';

// The progress bar used for a whole lesson (key words AND speaking), so it never resets, and for the level bar.
// The fill is an orange gradient laid across the full track and grows smoothly.
const GRADIENT = ['#F59A3C', '#F28C28', '#E8730F', '#D95F0E'];

export default function ProgressBar({ progress = 0, height = 10, style }) {
  const p = Math.min(Math.max(progress, 0), 1);
  const anim = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    Animated.timing(anim, { toValue: p, duration: 600, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [p, anim]);

  const fillWidth = anim.interpolate({ inputRange: [0, 1], outputRange: [0, trackWidth] });

  return (
    <View
      style={[styles.track, { height, borderRadius: radius.full }, style]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Progress ${Math.round(p * 100)} percent`}
    >
      <Animated.View style={[styles.fill, { width: fillWidth, borderRadius: radius.full }]}>
        <LinearGradient
          colors={GRADIENT}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: Math.max(trackWidth, 1), height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', backgroundColor: '#F3E6D9' },
  fill: { height: '100%', overflow: 'hidden' },
});
