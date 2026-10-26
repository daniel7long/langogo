// One progress value for the whole lesson: every key word card and every dialogue line is one step.
//   section 'prep'  -> position is the card index (0-based); the bar is full for that card
//   section 'speak' -> position is the dialogue line in focus (0-based); lines before it are done
// The last key word card and the first dialogue line meet at the same value, so the bar only moves forward.
export function lessonProgress(lesson, section, position) {
  const total = lesson.vocab.length + lesson.dialogue.length;
  if (!total) return 0;
  const done = section === 'prep' ? position + 1 : lesson.vocab.length + position;
  return Math.min(Math.max(done / total, 0), 1);
}
