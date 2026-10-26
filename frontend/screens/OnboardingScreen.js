import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getMe } from '../api/app';
import AsyncState from '../components/AsyncState';
import FadeIn from '../components/FadeIn';
import Flag from '../components/Flag';
import IconButton from '../components/IconButton';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import SecondaryButton from '../components/SecondaryButton';
import useAsync from '../hooks/useAsync';
import { goBackOr } from '../utils/nav';
import { colors, radius, shadows, spacing, typography } from '../theme';

const POINTS = [
  { icon: 'headset-outline', text: 'Listen and learn the words' },
  { icon: 'chatbubbles-outline', text: 'Speak with a friendly partner' },
  { icon: 'sparkles-outline', text: 'Get gentle feedback on your sounds' },
];

// Welcome screen, shown after choosing a language.
// French learners can also take the level test (the test is French only for now); everyone else starts at Level 1.
export default function OnboardingScreen() {
  const state = useAsync(getMe, []);
  return (
    <Screen>
      <AsyncState state={state}>{(me) => <Welcome me={me} />}</AsyncState>
    </Screen>
  );
}

function Welcome({ me }) {
  const router = useRouter();
  const lang = me.language ?? 'fr';
  const hasTest = lang === 'fr';
  return (
    <>
      <View style={styles.top}>
        <IconButton name="arrow-back" label="Back" onPress={() => goBackOr(router, '/')} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <FadeIn style={styles.hero}>
          <Flag id={lang} width={112} round ring />
          <Text style={[styles.eyebrow, styles.gap]}>Welcome to Langogo</Text>
          <Text style={styles.title} accessibilityRole="header">Let's start speaking {me.language_name}</Text>
          <Text style={styles.sub}>No pressure. Practise at your own pace.</Text>
        </FadeIn>
        <View style={styles.points}>
          {POINTS.map((p, i) => (
            <FadeIn key={p.text} delay={200 + i * 90}>
              <View style={styles.point}>
                <View style={styles.pointIcon}>
                  <Ionicons name={p.icon} size={20} color={colors.primary} />
                </View>
                <Text style={styles.pointText}>{p.text}</Text>
              </View>
            </FadeIn>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label="Start from Level 1" icon="arrow-forward" onPress={() => router.replace('/courses')} />
        {hasTest && <SecondaryButton label="Take the level test" onPress={() => router.push('/level-test')} />}
        <Pressable onPress={() => goBackOr(router, '/')} style={styles.link} accessibilityRole="button">
          <Text style={styles.linkText}>Choose another language</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.md, paddingTop: spacing.md, height: 64 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.lg },
  hero: { alignItems: 'center' },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  gap: { marginTop: spacing.lg },
  title: { ...typography.display, color: colors.text, textAlign: 'center', marginTop: spacing.xs },
  sub: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  points: { gap: spacing.s12 },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s12,
    minHeight: 64,
    padding: spacing.s12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    ...shadows.card(),
  },
  pointIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.selectedBg },
  pointText: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
  linkText: { ...typography.label, color: colors.primary },
});
