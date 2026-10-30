import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import PressableScale from './PressableScale';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import Waveform from './Waveform';
import { colors, radius, shadows, spacing, typography } from '../theme';

const NATIVE = Platform.OS !== 'web';
const SIZE = 84;

// Two soft rings that swell and fade behind the microphone button while recording.
function PulseRing({ delay = 0 }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] }) }] },
      ]}
    />
  );
}

function Timer() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <Text style={styles.timer}>{`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}</Text>;
}

// The dock at the bottom of the speaking screen. What it shows depends on `phase`:
//   playing / paused / waiting  "Your turn": the mic button, Hear it again and Slow
//   blocked                     "Tap to start" (the browser needs a touch before it plays sound)
//   starting                    spinner while the microphone opens
//   recording                   "Listening...": pulsing button with a waveform and a timer (tap to stop)
//   review                      Retry and Done
//   uploading / finishing       "Scoring..." / "Saving your result..."
export default function RecordingControls({ phase, onStart, onStop, onRetry, onDone, onResume, onHear, onHearSlow, hideHelpers = false, micDisabled = false, caption }) {
  let body;
  if (phase === 'review') {
    body = (
      <>
        <Text style={styles.title}>Happy with it?</Text>
        <Text style={styles.caption}>Play your take in the bubble, or record it again.</Text>
        <View style={styles.pair}>
          <View style={styles.flex}>
            <SecondaryButton label="Retry" icon="mic-outline" onPress={onRetry} />
          </View>
          <View style={styles.flex}>
            <PrimaryButton label="Done" icon="checkmark" onPress={onDone} />
          </View>
        </View>
      </>
    );
  } else if (phase === 'recording') {
    body = (
      <>
        <Text style={styles.title}>Listening…</Text>
        <Timer />
        <View style={styles.micHost}>
          <PulseRing />
          <PulseRing delay={700} />
          <PressableScale onPress={onStop} accessibilityRole="button" accessibilityLabel="Stop recording" style={styles.mic}>
            <Waveform active color={colors.onPrimary} bars={7} height={28} />
          </PressableScale>
        </View>
        <Text style={styles.caption}>Tap when you're done</Text>
      </>
    );
  } else if (phase === 'starting' || phase === 'uploading' || phase === 'finishing') {
    const title = phase === 'finishing' ? 'Saving your result…' : phase === 'uploading' ? 'Scoring…' : 'Opening the microphone…';
    body = (
      <>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.micHost}>
          <View style={[styles.mic, styles.dim]}>
            <ActivityIndicator color={colors.onPrimary} />
          </View>
        </View>
        <Text style={styles.caption}>{phase === 'uploading' ? 'Checking your pronunciation' : 'Just a moment'}</Text>
      </>
    );
  } else if (phase === 'blocked') {
    body = (
      <>
        <Text style={styles.title}>Ready when you are</Text>
        <View style={styles.micHost}>
          <PressableScale onPress={onResume} accessibilityRole="button" accessibilityLabel="Tap to start" style={styles.mic}>
            <Ionicons name="play" size={34} color={colors.onPrimary} />
          </PressableScale>
        </View>
        <Text style={styles.caption}>Tap to start the conversation</Text>
      </>
    );
  } else {
    body = (
      <>
        <Text style={styles.title}>Your turn</Text>
        <Text style={styles.caption}>{caption ?? "Tap the microphone when you're ready"}</Text>
        <View style={styles.micHost}>
          <View style={styles.halo} pointerEvents="none" />
          <PressableScale
            onPress={micDisabled ? undefined : onStart}
            accessibilityRole="button"
            accessibilityLabel="Tap to speak"
            accessibilityState={{ disabled: micDisabled }}
            style={[styles.mic, micDisabled && styles.dim]}
          >
            <Ionicons name="mic" size={36} color={colors.onPrimary} />
          </PressableScale>
        </View>
        {!hideHelpers && (
        <View style={styles.helpers}>
          <PressableScale onPress={onHear} style={styles.helper} accessibilityRole="button" accessibilityLabel="Hear it again">
            <Ionicons name="volume-high-outline" size={18} color={colors.primary} />
            <Text style={styles.helperText}>Hear it again</Text>
          </PressableScale>
          <PressableScale onPress={onHearSlow} style={styles.helper} accessibilityRole="button" accessibilityLabel="Hear it slowly">
            <Ionicons name="speedometer-outline" size={18} color={colors.primary} />
            <Text style={styles.helperText}>Slow</Text>
          </PressableScale>
        </View>
        )}
      </>
    );
  }
  return <View style={styles.dock}>{body}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dock: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadows.lift(),
  },
  title: { ...typography.title, color: colors.text },
  caption: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  timer: { ...typography.labelSm, color: colors.primary },
  micHost: { width: SIZE + 48, height: SIZE + 24, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: SIZE + 22, height: SIZE + 22, borderRadius: (SIZE + 22) / 2, backgroundColor: colors.selectedBg },
  ring: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.primary },
  mic: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.button() },
  dim: { opacity: 0.65 },
  helpers: { flexDirection: 'row', gap: spacing.s12 },
  helper: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1, borderColor: colors.orange200, backgroundColor: colors.tint },
  helperText: { ...typography.labelSm, color: colors.primary },
  pair: { flexDirection: 'row', gap: spacing.s12, alignSelf: 'stretch', marginTop: spacing.s12 },
});
