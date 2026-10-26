import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getNotes, removeNote } from '../api/app';
import AsyncState from '../components/AsyncState';
import NoteRow from '../components/NoteRow';
import PrimaryButton from '../components/PrimaryButton';
import ProgressBar from '../components/ProgressBar';
import Screen from '../components/Screen';
import SecondaryButton from '../components/SecondaryButton';
import TopBar from '../components/TopBar';
import useAsync from '../hooks/useAsync';
import { confirm, notify } from '../utils/dialog';
import { goHub } from '../utils/nav';
import { colors, radius, spacing, typography } from '../theme';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'due', label: 'Due' },
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
  { id: 'mastered', label: 'Mastered' },
];

const matches = (w, filter) => (filter === 'all' ? true : filter === 'due' ? w.due : w.status === filter);

// Vocab Notes: every word saved from the flashcards, grouped by lesson (scenario) and sorted from
// A1 to C2 inside each group, with review tools (flashcards, quiz, spaced repetition).
export default function VocabNotesScreen() {
  const router = useRouter();
  const state = useAsync(getNotes, []);

  return (
    <Screen>
      <TopBar title="Vocab Notes" profile />
      <AsyncState state={state} onBack={() => router.back()}>
        {(data) => <NotesView data={data} reload={state.reload} />}
      </AsyncState>
    </Screen>
  );
}

function NotesView({ data, reload }) {
  const router = useRouter();
  const { summary, groups } = data;
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState({});

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        words: g.words.filter(
          (w) => matches(w, filter) && (!q || w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.words.length > 0);
  }, [groups, filter, query]);

  if (summary.total === 0) {
    return (
      <>
        <View style={styles.empty}>
          <Ionicons name="bookmarks-outline" size={48} color={colors.primary} />
          <Text style={styles.emptyTitle}>No words saved yet</Text>
          <Text style={styles.emptyText}>
            Tap "Add notes" on a key-word flashcard and the word will show up here, ready to review.
          </Text>
        </View>
        <View style={styles.footer}>
          <PrimaryButton label="Liste des leçons" onPress={() => goHub(router, '/courses')} />
        </View>
      </>
    );
  }

  const scope = summary.due > 0 ? 'due' : 'all';
  const start = (mode, group, forceAll) =>
    router.push({
      pathname: '/notes-review',
      params: { mode, scope: forceAll || !summary.due ? 'all' : scope, ...(group ? { group } : {}) },
    });

  const remove = async (w) => {
    const ok = await confirm('Remove word', `Remove "${w.word}" from your notes?`, 'Remove');
    if (!ok) return;
    try {
      await removeNote(w.lesson_id, w.vocab_id);
      reload();
    } catch (e) {
      notify("Couldn't remove the word", e.message);
    }
  };

  const masteredShare = summary.total ? summary.mastered / summary.total : 0;

  return (
    <>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.summary}>
          <View style={styles.stats}>
            <Stat value={summary.total} label="Words" />
            <Stat value={summary.due} label="Due now" accent={summary.due > 0} />
            <Stat value={summary.mastered} label="Mastered" />
          </View>
          <ProgressBar progress={masteredShare} height={10} />
          <Text style={styles.summaryNote}>
            {summary.mastered} of {summary.total} mastered · answer right 4 times in a row to master a word
          </Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.flex}>
            <PrimaryButton label="Flashcards" onPress={() => start('cards')} />
          </View>
          <View style={styles.flex}>
            <SecondaryButton label="Quiz" onPress={() => start('quiz')} />
          </View>
        </View>
        <Text style={styles.hint}>
          {summary.due > 0
            ? `${summary.due} word${summary.due === 1 ? '' : 's'} due for review.`
            : 'Nothing is due right now, so these practice all your words.'}
          {summary.due > 0 && summary.total > summary.due ? (
            <Text style={styles.link} onPress={() => start('cards', null, true)}>  Practice all {summary.total}</Text>
          ) : null}
        </Text>

        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a word or meaning"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search notes"
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.chip, filter === f.id && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f.id }}
            >
              <Text style={[styles.chipText, filter === f.id && styles.chipTextOn]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {visible.length === 0 && <Text style={styles.none}>No words match.</Text>}

        {visible.map((g) => {
          const isCollapsed = !!collapsed[g.id];
          return (
            <View key={g.id} style={styles.group}>
              <View style={styles.groupHead}>
                <Pressable
                  onPress={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}
                  style={styles.groupToggle}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !isCollapsed }}
                  accessibilityLabel={`${g.title}, ${isCollapsed ? 'show' : 'hide'} words`}
                >
                  <Text style={styles.emoji}>{g.emoji}</Text>
                  <View style={styles.flex}>
                    <Text style={styles.groupTitle}>{g.title}</Text>
                    <Text style={styles.groupSub}>
                      Lv{g.level} · {g.level_title} · {g.words.length} word{g.words.length === 1 ? '' : 's'}
                      {g.due ? ` · ${g.due} due` : ''}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => start('cards', g.id, true)}
                  hitSlop={6}
                  style={styles.reviewPill}
                  accessibilityRole="button"
                  accessibilityLabel={`Review ${g.title}`}
                >
                  <Text style={styles.reviewText}>Review</Text>
                </Pressable>
                <Pressable
                  onPress={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={isCollapsed ? 'Show words' : 'Hide words'}
                >
                  <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              {!isCollapsed && (
                <View style={styles.words}>
                  {g.words.map((w) => (
                    <NoteRow key={w.id} note={w} onRemove={() => remove(w)} />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label="Liste des leçons" onPress={() => goHub(router, '/courses')} />
      </View>
    </>
  );
}

function Stat({ value, label, accent }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent && styles.statAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.s12 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  emptyTitle: { ...typography.title, color: colors.text },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  summary: { backgroundColor: colors.selectedBg, borderRadius: radius.lg, padding: spacing.md, gap: spacing.s12 },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.display, color: colors.text },
  statAccent: { color: colors.accentText },
  statLabel: { ...typography.caption, color: colors.textMuted },
  summaryNote: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.s12 },
  hint: { ...typography.labelSm, color: colors.textMuted, textAlign: 'center' },
  link: { ...typography.labelSm, color: colors.accentText },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    height: 44,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, ...typography.body, color: colors.text, paddingVertical: 0 },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.labelSm, color: colors.text },
  chipTextOn: { color: colors.onPrimary },
  none: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  group: { gap: spacing.sm, marginTop: spacing.sm },
  groupToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.s12 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, backgroundColor: colors.lessonCompleted, borderRadius: radius.lg, padding: spacing.s12 },
  emoji: { fontSize: 24 },
  groupTitle: { ...typography.label, color: colors.onPrimary },
  groupSub: { ...typography.caption, color: colors.onPrimary },
  reviewPill: { backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.s12, paddingVertical: spacing.xs },
  reviewText: { ...typography.labelSm, color: colors.accentText },
  words: { gap: spacing.sm },
});
