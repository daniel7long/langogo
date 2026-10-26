import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

const NATIVE = Platform.OS !== 'web';
const COLORS = ['#F47A20', '#FFB347', '#5B9E4A', '#FFD84D', '#FF6B6B', '#4DB6FF', '#B084F5', '#F8A9C9'];
const DURATION = 3200; // ms
const STEPS = 14; // how many points of the flight path are sampled
const DRAG = 2.1;
const GRAVITY = 560;

// Position after `t` seconds for a particle launched with velocity (vx, vy), with air drag and gravity,
// so the streamers hang in the air and drift down instead of dropping like stones.
function flight(vx, vy, t) {
  const k = DRAG;
  const decay = 1 - Math.exp(-k * t);
  return {
    x: (vx * decay) / k,
    y: ((vy - GRAVITY / k) * decay) / k + (GRAVITY * t) / k, // y grows downwards
  };
}

function makeParticles(count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? 1 : -1; // 1 = the left cannon (fires to the right), -1 = the right cannon
    const angle = ((8 + Math.random() * 62) * Math.PI) / 180; // degrees below the horizontal, fanned out
    const speed = 520 + Math.random() * 620;
    const streamer = Math.random() < 0.55;
    out.push({
      side,
      vx: Math.cos(angle) * speed * side,
      vy: Math.sin(angle) * speed * 0.75 - 260,
      streamer,
      w: streamer ? 4 + Math.random() * 2 : 7 + Math.random() * 4,
      h: streamer ? 26 + Math.random() * 26 : 5 + Math.random() * 4,
      round: !streamer && Math.random() < 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 900),
      start: Math.random() * 360,
      delay: Math.random() * 0.12,
    });
  }
  return out;
}

// A party-popper burst: streamers and confetti shot from the top corners and falling across the screen.
// It plays once on mount and again every time `shots` goes up. It never blocks touches.
// Pure React Native Animated, so there is nothing to install.
export default function ConfettiCannon({ shots = 1, count = 70, height = 420 }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);
  const [round, setRound] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const particles = useMemo(() => makeParticles(count), [count, round]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shots || !width) return undefined;
    setRound((r) => r + 1);
    setActive(true);
    progress.setValue(0);
    const run = Animated.timing(progress, { toValue: 1, duration: DURATION, easing: Easing.linear, useNativeDriver: NATIVE });
    run.start(({ finished }) => finished && setActive(false));
    return () => run.stop();
  }, [shots, width]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.layer, { height }]} pointerEvents="none" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {active &&
        particles.map((p, i) => {
          const inputRange = [];
          const xs = [];
          const ys = [];
          for (let s = 0; s <= STEPS; s += 1) {
            const f = s / STEPS;
            const t = Math.max(0, (f * DURATION) / 1000 - p.delay);
            const pos = flight(p.vx, p.vy, t);
            inputRange.push(f);
            xs.push(pos.x);
            ys.push(pos.y);
          }
          const left = p.side === 1 ? -6 : width + 6;
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left,
                top: -8,
                width: p.w,
                height: p.h,
                borderRadius: p.round ? p.w / 2 : 1.5,
                backgroundColor: p.color,
                opacity: progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateX: progress.interpolate({ inputRange, outputRange: xs }) },
                  { translateY: progress.interpolate({ inputRange, outputRange: ys }) },
                  { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: [`${p.start}deg`, `${p.start + p.spin}deg`] }) },
                ],
              }}
            />
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', zIndex: 20 },
});
