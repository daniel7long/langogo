import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import FadeIn from './FadeIn';
import IconButton from './IconButton';
import PrimaryButton from './PrimaryButton';
import { goHub } from '../utils/nav';
import { askMicrophone, microphoneAllowed } from '../utils/microphone';
import { colors, radius, shadows, spacing, typography } from '../theme';

// Shows "Let's hear your French" once, before the first speaking practice, until the microphone is allowed.
// The tap also lets the browser start playing sound, so the conversation can begin right away.
export default function MicGate({ language, children }) {
  const router = useRouter();
  const [state, setState] = useState('checking'); // checking | ask | open
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    microphoneAllowed().then((ok) => live && setState(ok ? 'open' : 'ask'));
    return () => {
      live = false;
    };
  }, []);

  if (state === 'open') return children;
  if (state === 'checking') return <View style={styles.flex} />;

  const allow = async () => {
    setBusy(true);
    await askMicrophone(); // if it is refused, the speaking screen explains how to allow it when you tap the mic
    setState('open');
  };

  return (
    <>
      <View style={styles.top}>
        <IconButton name="close" label="Close" onPress={() => goHub(router, '/courses')} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <FadeIn style={styles.hero}>
          <View style={styles.illustration}>
            <View style={[styles.ringOuter, { opacity: 0.5 }]} />
            <View style={styles.ringInner} />
            <View style={styles.mic}>
              <Ionicons name="mic" size={44} color={colors.onPrimary} />
            </View>
          </View>
          <Text style={styles.eyebrow}>One small permission</Text>
          <Text style={styles.title}>Let's hear your {language}</Text>
          <Text style={styles.text}>Langogo listens while you practise, so it can give you gentle feedback on your sounds.</Text>
        </FadeIn>
        <FadeIn delay={150} style={styles.points}>
          <View style={styles.point}>
            <Ionicons name="mic-outline" size={22} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.pointTitle}>Listens only while you speak</Text>
              <Text style={styles.pointSub}>The microphone is on only when you tap the mic button.</Text>
            </View>
          </View>
          <View style={styles.point}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.pointTitle}>Your voice stays private</Text>
              <Text style={styles.pointSub}>Used to score your pronunciation. You can delete recordings in Settings.</Text>
            </View>
          </View>
        </FadeIn>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label="Allow microphone" icon="mic" onPress={allow} loading={busy} />
        <Text style={styles.note}>You can change this any time in your browser or phone settings.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: spacing.md, height: 64, justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  hero: { alignItems: 'center' },
  illustration: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  ringOuter: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 2, borderColor: colors.orange200 },
  ringInner: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: colors.orange200 },
  mic: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.button() },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  title: { ...typography.display, color: colors.text, textAlign: 'center', marginTop: spacing.xs },
  text: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  points: { gap: spacing.sm },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  pointTitle: { ...typography.bodyStrong, color: colors.text },
  pointSub: { ...typography.caption, color: colors.textMuted },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  note: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
