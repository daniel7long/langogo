// One progress value for the whole lesson: every key word card, every key conjugation card and every dialogue line is one step.
//   section 'prep'  -> position is the card index (0-based, words first, then conjugations); the bar is full for that card
//   section 'speak' -> position is the dialogue line in focus (0-based); lines before it are done
// The last key word card and the first dialogue line meet at the same value, so the bar only moves forward.
export function lessonProgress(lesson, section, position) {
  const cards = lesson.vocab.length + (lesson.conjugations ? lesson.conjugations.length : 0);
  const total = cards + lesson.dialogue.length;
  if (!total) return 0;
  const done = section === 'prep' ? position + 1 : cards + position;
  return Math.min(Math.max(done / total, 0), 1);
}
