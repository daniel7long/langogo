import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { chooseLanguage, getLanguages } from '../api/app';
import AsyncState from '../components/AsyncState';
import Chip from '../components/Chip';
import FadeIn from '../components/FadeIn';
import Flag from '../components/Flag';
import IconButton from '../components/IconButton';
import Logo from '../components/Logo';
import PressableScale from '../components/PressableScale';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { ListSkeleton } from '../components/Skeleton';
import useAsync from '../hooks/useAsync';
import { notify } from '../utils/dialog';
import { goBackOr } from '../utils/nav';
import { colors, radius, shadows, spacing, typography } from '../theme';

// The very first screen: "Choose the language you want to learn", two flags per row.
// Opened again from the menu / Settings with ?change=1, it returns to the lessons after choosing.
export default function LanguageScreen() {
  const state = useAsync(getLanguages, []);
  return (
    <Screen>
      <AsyncState state={state} skeleton={<ListSkeleton rows={6} />}>
        {(languages) => <Picker languages={languages} />}
      </AsyncState>
    </Screen>
  );
}

function Picker({ languages }) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const changing = (Array.isArray(params.change) ? params.change[0] : params.change) === '1';
  const current = languages.find((l) => l.selected)?.id ?? null;
  const [selected, setSelected] = useState(current);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // French is pre-selected for a first-time learner, so the button is ready straight away.
    if (!selected && languages.length) setSelected(languages[0].id);
  }, [languages, selected]);

  const rows = [];
  for (let i = 0; i < languages.length; i += 2) rows.push(languages.slice(i, i + 2));

  const next = async () => {
    setBusy(true);
    try {
      await chooseLanguage(selected);
      if (changing) router.replace('/courses');
      else router.push('/welcome');
    } catch (e) {
      notify("Couldn't choose the language", e.message);
    } finally {
      setBusy(false);
    }
  };

  const picked = languages.find((l) => l.id === selected);

  return (
    <>
      <View style={styles.top}>
        <Logo width={118} />
        {changing && <IconButton name="close" label="Close" onPress={() => goBackOr(router, '/courses')} />}
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <FadeIn style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            {changing ? 'Change your language' : 'Choose the language you want to learn'}
          </Text>
          <Text style={styles.subtitle}>
            {changing ? 'Each language keeps its own progress.' : 'You can change it any time in Settings'}
          </Text>
        </FadeIn>

        {rows.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((lang, c) => (
              <FadeIn key={lang.id} delay={120 + (r * 2 + c) * 70} style={styles.cell}>
                <LanguageCard lang={lang} active={lang.id === selected} isCurrent={changing && lang.id === current} onPress={() => setSelected(lang.id)} />
              </FadeIn>
            ))}
          </View>
        ))}

        <Text style={styles.note}>
          {changing ? 'Your progress is saved separately for each language.' : "There's no wrong choice. Start with the language that makes you curious."}
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          label={picked ? `Continue with ${picked.name}` : 'Continue'}
          icon="arrow-forward"
          onPress={next}
          disabled={!selected}
          loading={busy}
        />
      </View>
    </>
  );
}

function LanguageCard({ lang, active, isCurrent, onPress }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${lang.name}, ${lang.native}`}
      style={[styles.card, active && styles.cardActive]}
    >
      {active && (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
        </View>
      )}
      {isCurrent && <Chip label="Current" tone="green" style={styles.current} />}
      <Flag id={lang.id} width={76} round ring />
      <Text style={styles.name}>{lang.name}</Text>
      <Text style={styles.native}>{lang.native}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, minHeight: 64 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  head: { gap: spacing.sm, marginBottom: spacing.sm },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.md },
  cell: { flex: 1 },
  card: {
    alignItems: 'center',
    gap: 2,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    ...shadows.card(),
  },
  cardActive: { borderColor: colors.primary, backgroundColor: colors.tint },
  check: {
    position: 'absolute',
    top: spacing.s12,
    right: spacing.s12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  current: { position: 'absolute', top: spacing.s12, left: spacing.s12, paddingVertical: 2, paddingHorizontal: 8 },
  name: { ...typography.label, color: colors.text, marginTop: spacing.s12 },
  native: { ...typography.body, color: colors.textMuted },
  note: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm },
});
