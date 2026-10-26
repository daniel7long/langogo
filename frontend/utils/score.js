import { colors } from '../theme';

// Warm, never alarming: green for a strong score, orange-teal for a fair one, soft coral for a low one.
export function scoreColor(score) {
  if (score >= 75) return colors.lessonCompleted;
  if (score >= 55) return colors.amber;
  return colors.coral;
}

// Background tint that goes with scoreColor.
export function scoreTint(score) {
  if (score >= 75) return colors.green100;
  if (score >= 55) return colors.amberBg;
  return colors.coralBg;
}

// Grade -> badge colours (A+ and A green, B teal, C amber, D coral).
export function gradeColors(grade) {
  if (grade === 'A+' || grade === 'A') return { bg: colors.green100, fg: colors.greenText, solid: colors.lessonCompleted };
  if (grade === 'B+' || grade === 'B') return { bg: colors.tealBg, fg: '#146B7B', solid: colors.teal };
  if (grade === 'C') return { bg: colors.amberBg, fg: '#8A5F00', solid: colors.amber };
  return { bg: colors.coralBg, fg: '#A8392E', solid: colors.coral };
}

// Text colour that is readable on scoreTint(score).
export function scoreInk(score) {
  if (score >= 75) return colors.greenText;
  if (score >= 55) return '#8A5F00';
  return '#A8392E';
}
