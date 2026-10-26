import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getReviewSession, reviewNote } from '../api/app';
import PrimaryButton from '../components/PrimaryButton';
import ProgressBar from '../components/ProgressBar';
import Screen from '../components/Screen';
import SecondaryButton from '../components/SecondaryButton';
import { confirm } from '../utils/dialog';
import { goBackOr } from '../utils/nav';
import { speakFrench } from '../utils/speech';
import { colors, radius, spacing, typography } from '../theme';

const param = (v) => (Array.isArray(v) ? v[0] : v);

// Review of the words in Vocab Notes: flashcards (flip and grade yourself) or a multiple-choice quiz
// (meaning questions and listening questions). Every answer moves the word on its review schedule.
export default function NotesReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mode = param(params.mode) === 'quiz' ? 'quiz' : 'cards';
  const group = param(params.group);
  const [scope, setScope] = useState(param(params.scope) === 'all' ? 'all' : 'due');
  const [runKey, setRunKey] = useState(0); // bump to fetch a fresh session
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setItems(null);
    setError(null);
    getReviewSession({ mode, scope, group })
      .then((r) => live && setItems(r))
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [mode, scope, group, runKey]);

  // Close the review by going back to where it was opened (Vocab Notes), never by opening Notes again.
  const leave = () => goBackOr(router, '/vocab-notes');

  let body;
  if (error) {
    body = (
      <Message
        icon="alert-circle-outline"
        title="Couldn't start the review"
        text={error.message}
        actions={<PrimaryButton label="Back to notes" onPress={leave} />}
      />
    );
  } else if (!items) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (items.length === 0) {
    body = (
      <Message
        icon="checkmark-circle-outline"
        title={scope === 'due' ? 'Nothing due right now' : 'No words to review'}
        text={scope === 'due' ? 'You are all caught up. Come back later, or practice every saved word now.' : 'Save some words from the flashcards first.'}
        actions={
          <>
            {scope === 'due' && <PrimaryButton label="Practice all words" onPress={() => setScope('all')} />}
            <SecondaryButton label="Back to notes" onPress={leave} />
          </>
        }
      />
    );
  } else {
    body = (
      <Session
        key={`${runKey}-${scope}-${items.map((i) => i.id).join(',')}`}
        items={items}
        mode={mode}
        onExit={leave}
        onAgain={() => setRunKey((k) => k + 1)}
      />
    );
  }

  return <Screen>{body}</Screen>;
}

function Message({ icon, title, text, actions }) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={48} color={colors.primary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

function Session({ items, mode, onExit, onAgain }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState([]); // [{ item, correct }]
  const [saveFailed, setSaveFailed] = useState(false);
  const done = index >= items.length;
  const close = async () => {
    if (done) return onExit();
    if (await confirm('Leave this review?', 'Your answers so far are saved, but the session will end.', 'Leave')) onExit();
  };

  const answer = (item, correct) => {
    setResults((r) => [...r, { item, correct }]);
    reviewNote(item.lesson_id, item.vocab_id, correct).catch(() => setSaveFailed(true));
  };

  return (
    <>
      <View style={styles.top}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
        <ProgressBar progress={done ? 1 : index / items.length} style={styles.bar} />
        <Text style={styles.count}>{Math.min(index + 1, items.length)}/{items.length}</Text>
      </View>

      {done ? (
        <Results results={results} saveFailed={saveFailed} onAgain={onAgain} onExit={onExit} />
      ) : mode === 'quiz' ? (
        <QuizQuestion key={items[index].id} item={items[index]} last={index === items.length - 1}
          onAnswer={(correct) => answer(items[index], correct)} onNext={() => setIndex((i) => i + 1)} />
      ) : (
        <FlashCard key={items[index].id} item={items[index]}
          onAnswer={(correct) => { answer(items[index], correct); setIndex((i) => i + 1); }} />
      )}
    </>
  );
}

function FlashCard({ item, onAnswer }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <>
      <ScrollView contentContainerStyle={styles.cardWrap}>
        <Pressable onPress={() => setFlipped((f) => !f)} style={styles.card} accessibilityRole="button"
          accessibilityLabel={flipped ? 'Hide the answer' : 'Show the answer'}>
          <View style={styles.cardTop}>
            <Text style={styles.small}>{item.lesson_title}</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{item.cefr}</Text></View>
          </View>
          <Text style={styles.word}>{item.word}</Text>
          <Pressable onPress={() => speakFrench(item.word)} hitSlop={10} accessibilityLabel={`Play ${item.word}`}>
            <Ionicons name="volume-high-outline" size={24} color={colors.text} />
          </Pressable>
          {flipped ? (
            <View style={styles.back}>
              <Text style={styles.ipa}>{item.ipa}</Text>
              <Text style={styles.meaning}>({item.pos}) {item.meaning}</Text>
              {item.example && (
                <View style={styles.example}>
                  <Text style={styles.fr}>{item.example.fr}</Text>
                  <Text style={styles.en}>{item.example.en}</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.tap}>Tap the card to see the meaning</Text>
          )}
        </Pressable>
      </ScrollView>
      <View style={styles.footer}>
        {flipped ? (
          <View style={styles.pair}>
            <View style={styles.flex}><SecondaryButton label="Again" onPress={() => onAnswer(false)} /></View>
            <View style={styles.flex}><PrimaryButton label="Got it" onPress={() => onAnswer(true)} /></View>
          </View>
        ) : (
          <PrimaryButton label="Show answer" onPress={() => setFlipped(true)} />
        )}
      </View>
    </>
  );
}

function QuizQuestion({ item, last, onAnswer, onNext }) {
  const [picked, setPicked] = useState(null);
  const listen = item.kind === 'listen';
  const played = useRef(false);

  // A listening question plays the word by itself (the browser may refuse; the button always works).
  useEffect(() => {
    if (listen && !played.current) {
      played.current = true;
      speakFrench(item.word);
    }
  }, [listen, item.word]);

  const choose = (option) => {
    if (picked) return;
    setPicked(option.id);
    onAnswer(option.id === item.answer_id);
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.quiz}>
        <Text style={styles.question}>{listen ? 'Listen and choose the word' : 'What does this word mean?'}</Text>
        {listen ? (
          <Pressable onPress={() => speakFrench(item.word)} style={styles.bigSpeaker} accessibilityRole="button" accessibilityLabel="Play the word">
            <Ionicons name="volume-high" size={40} color={colors.onPrimary} />
          </Pressable>
        ) : (
          <View style={styles.promptRow}>
            <Text style={styles.word}>{item.word}</Text>
            <Pressable onPress={() => speakFrench(item.word)} hitSlop={10} accessibilityLabel={`Play ${item.word}`}>
              <Ionicons name="volume-high-outline" size={24} color={colors.text} />
            </Pressable>
          </View>
        )}

        <View style={styles.options}>
          {item.options.map((o) => {
            const isAnswer = o.id === item.answer_id;
            const state = !picked ? null : isAnswer ? 'right' : o.id === picked ? 'wrong' : 'idle';
            return (
              <Pressable
                key={o.id}
                onPress={() => choose(o)}
                disabled={!!picked}
                accessibilityRole="button"
                style={[styles.option, state === 'right' && styles.optionRight, state === 'wrong' && styles.optionWrong, state === 'idle' && styles.optionIdle]}
              >
                <Text style={styles.optionText}>{o.text}</Text>
                {state === 'right' && <Ionicons name="checkmark-circle" size={22} color={colors.lessonCompleted} />}
                {state === 'wrong' && <Ionicons name="close-circle" size={22} color={colors.error} />}
              </Pressable>
            );
          })}
        </View>

        {picked && (
          <View style={styles.feedback}>
            <Text style={[styles.feedbackTitle, picked === item.answer_id ? styles.good : styles.bad]}>
              {picked === item.answer_id ? 'Correct!' : 'Not quite'}
            </Text>
            <Text style={styles.text}>{item.word}  {item.ipa}  ({item.pos}) {item.meaning}</Text>
            {item.example && <Text style={styles.en}>{item.example.fr}  —  {item.example.en}</Text>}
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label={last ? 'See results' : 'Continue'} onPress={onNext} disabled={!picked} />
      </View>
    </>
  );
}

function Results({ results, saveFailed, onAgain, onExit }) {
  const right = results.filter((r) => r.correct).length;
  const missed = results.filter((r) => !r.correct);
  const perfect = missed.length === 0;

  return (
    <>
      <ScrollView contentContainerStyle={styles.resultWrap}>
        <Ionicons name={perfect ? 'trophy' : 'ribbon-outline'} size={56} color={colors.primary} />
        <Text style={styles.score}>{right}/{results.length}</Text>
        <Text style={styles.title}>{perfect ? 'Perfect round!' : 'Good practice'}</Text>
        <Text style={styles.text}>
          {perfect
            ? 'Every word moved one step up its review ladder.'
            : `${right} word${right === 1 ? '' : 's'} moved up. The others come back sooner.`}
        </Text>
        {saveFailed && <Text style={styles.error}>Some answers couldn't be saved. Check your connection.</Text>}
        {missed.length > 0 && (
          <View style={styles.missed}>
            <Text style={styles.missedTitle}>To look at again</Text>
            {missed.map(({ item }) => (
              <View key={item.id} style={styles.missedRow}>
                <Text style={styles.missedWord}>{item.word}</Text>
                <Text style={styles.missedMeaning}>{item.meaning}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.stack}>
          <PrimaryButton label="Review again" onPress={onAgain} />
          <SecondaryButton label="Back to notes" onPress={onExit} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 48, paddingHorizontal: spacing.md },
  bar: { flex: 1 },
  count: { ...typography.labelSm, color: colors.accentText },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm },
  pair: { flexDirection: 'row', gap: spacing.s12 },
  stack: { gap: spacing.sm },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  text: { ...typography.body, color: colors.text, textAlign: 'center' },
  error: { ...typography.body, color: colors.error, textAlign: 'center' },

  cardWrap: { flexGrow: 1, padding: spacing.md, justifyContent: 'center' },
  card: {
    minHeight: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.s12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' },
  small: { ...typography.labelSm, color: colors.textMuted, flex: 1 },
  badge: { backgroundColor: colors.selectedBg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { ...typography.labelSm, color: colors.accentText },
  word: { ...typography.display, color: colors.text, textAlign: 'center', marginTop: spacing.md },
  tap: { ...typography.labelSm, color: colors.textMuted, marginTop: spacing.lg },
  back: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  ipa: { ...typography.body, color: colors.text },
  meaning: { ...typography.label, color: colors.text, textAlign: 'center' },
  example: { gap: 2, marginTop: spacing.sm, alignItems: 'center' },
  fr: { ...typography.body, color: colors.text, textAlign: 'center' },
  en: { ...typography.labelSm, color: colors.textMuted, textAlign: 'center' },

  quiz: { padding: spacing.md, gap: spacing.md, alignItems: 'center' },
  question: { ...typography.label, color: colors.accentText, textAlign: 'center' },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12 },
  bigSpeaker: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  options: { alignSelf: 'stretch', gap: spacing.s12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  optionRight: { borderColor: colors.lessonCompleted, backgroundColor: colors.green100 },
  optionWrong: { borderColor: colors.error },
  optionIdle: { opacity: 0.5 },
  optionText: { ...typography.body, color: colors.text, flexShrink: 1 },
  feedback: { alignSelf: 'stretch', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  feedbackTitle: { ...typography.label },
  good: { color: colors.lessonCompleted },
  bad: { color: colors.error },

  resultWrap: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  score: { ...typography.score, color: colors.text },
  missed: { alignSelf: 'stretch', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginTop: spacing.md },
  missedTitle: { ...typography.label, color: colors.accentText },
  missedRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  missedWord: { ...typography.label, color: colors.text },
  missedMeaning: { ...typography.body, color: colors.textMuted, flexShrink: 1, textAlign: 'right' },
});
