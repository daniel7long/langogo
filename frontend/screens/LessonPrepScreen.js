import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { addNote, getLesson, getLessonNotes, removeNote } from '../api/app';
import AsyncState from '../components/AsyncState';
import Chip from '../components/Chip';
import FadeIn from '../components/FadeIn';
import IconButton from '../components/IconButton';
import LessonTopBar from '../components/LessonTopBar';
import PressableScale from '../components/PressableScale';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { ListSkeleton } from '../components/Skeleton';
import useAsync from '../hooks/useAsync';
import useSettings from '../hooks/useSettings';
import { notify } from '../utils/dialog';
import { lessonProgress } from '../utils/progress';
import { SLOW_RATE, speakText } from '../utils/speech';
import { goHub } from '../utils/nav';
import { colors, radius, shadows, spacing, typography } from '../theme';

// The button labels are shown in the language being learned: [next, start].
const BUTTONS = {
  fr: ['Suivant', 'Commencer'],
  es: ['Siguiente', 'Empezar'],
  zh: ['下一个', '开始'],
  ko: ['다음', '시작하기'],
  ja: ['次へ', 'はじめる'],
  de: ['Weiter', "Los geht's"],
};

// Key-word cards before the speaking practice.
export default function LessonPrepScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const state = useAsync(() => getLesson(id), [id]);

  return (
    <Screen>
      <AsyncState state={state} skeleton={<ListSkeleton rows={3} />} onBack={() => goHub(router, '/courses')}>
        {(lesson) => <PrepView lesson={lesson} />}
      </AsyncState>
    </Screen>
  );
}

function PrepView({ lesson }) {
  const router = useRouter();
  const { settings } = useSettings();
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState({}); // which English translations the learner opened
  const [saved, setSaved] = useState({}); // vocab id -> true when the word is in Vocab Notes
  const [saving, setSaving] = useState(false);
  const total = lesson.vocab.length;
  const card = lesson.vocab[index];
  const isLast = index === total - 1;

  // Which words of this lesson are already in the notes.
  useEffect(() => {
    let live = true;
    getLessonNotes(lesson.id)
      .then((r) => live && setSaved(Object.fromEntries(r.vocab_ids.map((id) => [id, true]))))
      .catch(() => {}); // the button just starts as "Add notes"
    return () => {
      live = false;
    };
  }, [lesson.id]);

  // Tap once to add the word to Vocab Notes, tap again to take it out.
  const toggleNote = async () => {
    if (saving) return;
    const id = card.id;
    const adding = !saved[id];
    setSaving(true);
    setSaved((s) => ({ ...s, [id]: adding })); // show the change straight away
    try {
      await (adding ? addNote(lesson.id, id) : removeNote(lesson.id, id));
    } catch (e) {
      setSaved((s) => ({ ...s, [id]: !adding })); // undo
      notify("Couldn't update your notes", e.message);
    } finally {
      setSaving(false);
    }
  };

  const next = () => setIndex((i) => Math.min(i + 1, total - 1));
  const previous = () => setIndex((i) => Math.max(i - 1, 0));
  const labels = BUTTONS[lesson.lang] ?? BUTTONS.fr;

  return (
    <>
      <LessonTopBar
        progress={lessonProgress(lesson, 'prep', index)}
        reward={lesson.max_flowers}
        onClose={() => goHub(router, '/courses')}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{lesson.title}</Text>
        <FadeIn key={index} distance={18} duration={260}>
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Chip label={`Card ${index + 1} of ${total}`} />
              <Pressable
                onPress={toggleNote}
                style={[styles.notes, saved[card.id] && styles.notesOn]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected: !!saved[card.id] }}
                accessibilityLabel={saved[card.id] ? 'Remove from notes' : 'Add to notes'}
              >
                <Ionicons
                  name={saved[card.id] ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={saved[card.id] ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.notesText, saved[card.id] && styles.notesTextOn]}>
                  {saved[card.id] ? 'Added' : 'Add notes'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.word}>{card.word}</Text>
            {!!card.ipa && <Text style={styles.ipa}>{card.ipa}</Text>}
            <Text style={styles.meaning}>{card.meaning}</Text>

            <View style={styles.listen}>
              <PressableScale onPress={() => speakText(card.word)} style={styles.listenBtn} accessibilityRole="button" accessibilityLabel={`Listen to ${card.word}`}>
                <Ionicons name="volume-high" size={18} color={colors.onPrimary} />
                <Text style={styles.listenText}>Listen</Text>
              </PressableScale>
              <PressableScale onPress={() => speakText(card.word, { rate: SLOW_RATE })} style={styles.slowBtn} accessibilityRole="button" accessibilityLabel={`Listen to ${card.word} slowly`}>
                <Ionicons name="speedometer-outline" size={18} color={colors.primary} />
                <Text style={styles.slowText}>Slow</Text>
              </PressableScale>
            </View>

            {card.examples.map((ex, i) => {
              const key = `${index}-${i}`;
              const open = settings.show_translation || shown[key];
              return (
                <View key={key} style={styles.example}>
                  <Text style={styles.exampleEyebrow}>{card.examples.length > 1 ? `In a sentence ${i + 1}` : 'In a sentence'}</Text>
                  <View style={styles.exampleRow}>
                    <Text style={styles.exampleText}>{ex.target ?? ex.fr}</Text>
                    <Pressable onPress={() => speakText(ex.target ?? ex.fr)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Play sentence">
                      <Ionicons name="volume-high-outline" size={20} color={colors.primary} />
                    </Pressable>
                  </View>
                  {open ? (
                    <Text style={styles.translation}>{ex.en}</Text>
                  ) : (
                    <Pressable onPress={() => setShown((s) => ({ ...s, [key]: true }))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Show translation">
                      <Text style={styles.reveal}>Show translation</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </FadeIn>
      </ScrollView>

      <View style={styles.footer}>
        {index > 0 && <IconButton name="chevron-back" label="Previous card" onPress={previous} size={54} />}
        <View style={styles.flex}>
          <PrimaryButton
            label={labels[isLast ? 1 : 0]}
            icon="chevron-forward"
            onPress={() => (isLast ? router.push({ pathname: '/lesson-speak', params: { id: lesson.id } }) : next())}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.md, paddingTop: spacing.sm, gap: spacing.s12 },
  eyebrow: { ...typography.eyebrow, color: colors.textMuted, textAlign: 'center' },
  card: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.s12,
    alignItems: 'center',
    ...shadows.lift(),
  },
  cardTop: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notes: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.s12, height: 34, borderRadius: radius.full, backgroundColor: colors.card },
  notesOn: { backgroundColor: colors.selectedBg },
  notesText: { ...typography.labelSm, color: colors.textMuted },
  notesTextOn: { color: colors.primary },
  word: { ...typography.display, fontSize: 36, lineHeight: 44, color: colors.text, textAlign: 'center', marginTop: spacing.s12 },
  ipa: { ...typography.label, color: '#9A5B2E', textAlign: 'center' },
  meaning: { ...typography.title, color: colors.textMuted, textAlign: 'center' },
  listen: { flexDirection: 'row', gap: spacing.s12, marginTop: spacing.sm },
  listenBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: colors.primary, ...shadows.button() },
  listenText: { ...typography.label, color: colors.onPrimary },
  slowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.orange200, backgroundColor: colors.tint },
  slowText: { ...typography.label, color: colors.primary },
  example: { alignSelf: 'stretch', padding: spacing.md, borderRadius: radius.lg, backgroundColor: '#FAF4EE', gap: 4, marginTop: spacing.sm },
  exampleEyebrow: { ...typography.eyebrow, color: '#9A5B2E' },
  exampleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  exampleText: { ...typography.bodyStrong, fontSize: 17, lineHeight: 24, color: colors.text, flex: 1 },
  translation: { ...typography.body, color: colors.textMuted },
  reveal: { ...typography.labelSm, color: colors.primary },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, paddingHorizontal: spacing.md, paddingBottom: spacing.lg, paddingTop: spacing.sm },
});
