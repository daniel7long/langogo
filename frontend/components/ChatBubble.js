import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import SpeakerButton from './SpeakerButton';
import Waveform from './Waveform';
import { splitByGlosses } from '../utils/glosses';
import { scoreInk, scoreTint } from '../utils/score';
import { colors, radius, shadows, spacing, typography } from '../theme';

// Splits a line into its words and tints each by how well it was pronounced (only when the number of
// words matches what the scorer heard; otherwise null and the plain text is shown).
function tintParts(text, words) {
  if (!words || !words.length) return null;
  const re = /[\w'’\-]+/gu;
  const found = [...text.matchAll(re)];
  if (found.length !== words.length) return null;
  const parts = [];
  let last = 0;
  found.forEach((m, i) => {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[0], score: words[i].score });
    last = m.index + m[0].length;
  });
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// One line of the dialogue.
//  - highlighted: this line is being played or recorded (orange border)
//  - hasRecording / replaying: the user's own take can be played back from the bubble
//  - after scoring, each word is tinted by its score and the line gets a score chip
//  - dashed-underlined words are tappable and show their meaning
export default function ChatBubble({
  turn, highlighted, playing, yourTurn, hasRecording, replaying, score, wordScores, showTranslation, waiting, onPlayLine, onPlayRecording,
}) {
  const mine = turn.role === 'you';
  const [openGloss, setOpenGloss] = useState(null);
  const gloss = useMemo(() => splitByGlosses(turn.text, turn.glosses), [turn]);
  const tint = useMemo(() => (score != null ? tintParts(turn.text, wordScores) : null), [turn, score, wordScores]);

  const body = (
    <Text style={styles.text}>
      {tint
        ? tint.map((p, i) =>
            p.score != null ? (
              <Text key={i} style={{ backgroundColor: scoreTint(p.score), color: colors.text }}>
                {p.text}
              </Text>
            ) : (
              p.text
            )
          )
        : gloss.map((p, i) =>
            p.gloss ? (
              <Text
                key={i}
                style={styles.gloss}
                onPress={() => setOpenGloss((g) => (g === p.gloss ? null : p.gloss))}
                accessibilityRole="button"
                accessibilityLabel={`${p.text}: ${p.gloss.meaning}`}
              >
                {p.text}
              </Text>
            ) : (
              p.text
            )
          )}
    </Text>
  );

  // Your turn: a calm, steady orange border (no animation).
  const turnStyle = yourTurn && mine ? { borderColor: colors.primary } : null;
  const Bubble = View;

  const bubble = (
    <Bubble
      style={[
        styles.bubble,
        mine ? styles.bubbleMine : styles.bubbleNpc,
        highlighted && mine && styles.bubbleActive,
        playing && !mine && styles.bubblePlaying,
        turnStyle,
      ]}
    >
      <View style={styles.bubbleHead}>
        <Text style={[styles.who, mine && { color: colors.primary }]}>{mine ? 'You' : turn.speaker}</Text>
        <SpeakerButton playing={!!playing} onPress={onPlayLine} label={mine ? 'Hear this line' : 'Play audio'} />
      </View>
      {body}
      {showTranslation && !!turn.en && <Text style={styles.en}>{turn.en}</Text>}

      {openGloss && (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{openGloss.pos} {openGloss.meaning}</Text>
        </View>
      )}

      {mine && !hasRecording && waiting && <Text style={styles.hint}>Say it in your own rhythm</Text>}

      {mine && hasRecording && (
        <View style={styles.replayRow}>
          <Pressable
            onPress={onPlayRecording}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={replaying ? 'Stop your recording' : 'Play your recording'}
            style={styles.replayCircle}
          >
            <Ionicons name={replaying ? 'pause' : 'play'} size={16} color={colors.primary} />
          </Pressable>
          {replaying && <Waveform active bars={14} height={18} />}
          {score != null && !replaying && (
            <View style={[styles.score, { backgroundColor: scoreTint(score) }]} accessibilityLabel={`Score ${score}`}>
              <Text style={[styles.scoreText, { color: scoreInk(score) }]}>{score}</Text>
            </View>
          )}
        </View>
      )}
    </Bubble>
  );

  const avatar = (
    <View style={[styles.avatar, mine ? styles.avatarYou : styles.avatarNpc]}>
      <Text style={[styles.initial, mine && { color: colors.onPrimary }]}>{(mine ? 'Y' : turn.speaker.charAt(0)).toUpperCase()}</Text>
    </View>
  );

  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      {!mine && avatar}
      <View style={styles.bubbleWrap}>{bubble}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  rowMine: { justifyContent: 'flex-end', paddingLeft: spacing.xl },
  bubbleWrap: { flexShrink: 1, flexGrow: 0, maxWidth: '88%' },
  avatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarNpc: { backgroundColor: '#EAE4DD' },
  avatarYou: { backgroundColor: colors.primary },
  initial: { ...typography.label, color: colors.textMuted },
  bubble: { padding: spacing.md, gap: 4, minWidth: 160 },
  bubbleNpc: { backgroundColor: '#EFEAE4', borderRadius: 22, borderBottomLeftRadius: 6 },
  bubbleMine: { backgroundColor: colors.surface, borderRadius: 22, borderBottomRightRadius: 6, borderWidth: 1.5, borderColor: colors.line, ...shadows.card() },
  bubbleActive: { borderColor: colors.primary },
  bubblePlaying: { backgroundColor: colors.selectedBg, borderWidth: 1.5, borderColor: colors.primary },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  who: { ...typography.eyebrow, color: colors.textMuted },
  text: { ...typography.bodyStrong, fontSize: 18, lineHeight: 26, color: colors.text },
  en: { ...typography.body, color: colors.textMuted },
  gloss: { textDecorationLine: 'underline', textDecorationStyle: 'dashed', textDecorationColor: colors.textFaint },
  chip: { alignSelf: 'flex-start', marginTop: spacing.xs, backgroundColor: colors.highlight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  chipText: { ...typography.caption, color: colors.text },
  hint: { ...typography.labelSm, color: colors.primary, marginTop: 2 },
  score: { minWidth: 36, height: 28, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scoreText: { ...typography.labelSm },
  replayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, marginTop: spacing.xs },
  replayCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.orange200, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
});
