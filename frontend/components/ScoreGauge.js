import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '../theme';

// 270-degree gauge from the F1S4 frame: dark gray on the left, through light gray and
// yellow, to orange and red on the right. The gauge colors are decorative, so they
// are not part of the Figma tokens.
const SEGMENT_COLORS = ['#4A4B50', '#77787D', '#B1B1B5', '#F7D98C', '#FB7A1E', '#F5150F'];

const SIZE = 260;
const STROKE = 24;
const CENTER = SIZE / 2;
const RADIUS = (SIZE - STROKE) / 2 - 2;
const START_DEG = 135; // clockwise from 3 o'clock, so 135 is bottom-left
const SWEEP_DEG = 270;
const HEIGHT = CENTER + RADIUS * Math.sin(Math.PI / 4) + STROKE / 2 + 2;

function polar(deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) };
}

function arcPath(fromDeg, toDeg) {
  const s = polar(fromDeg);
  const e = polar(toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${e.x} ${e.y}`;
}

export default function ScoreGauge({ score, level, maxScore = 100 }) {
  const step = SWEEP_DEG / SEGMENT_COLORS.length;

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`Score ${score} out of ${maxScore}, level ${level}`}
    >
      <Svg width={SIZE} height={HEIGHT} viewBox={`0 0 ${SIZE} ${HEIGHT}`}>
        {SEGMENT_COLORS.map((color, i) => (
          <Path
            key={color}
            d={arcPath(START_DEG + i * step, START_DEG + (i + 1) * step)}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.level}>{level}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: HEIGHT },
  center: { position: 'absolute', left: 0, right: 0, top: CENTER - 52, alignItems: 'center' },
  score: { ...typography.score, color: colors.text },
  level: { ...typography.level, color: colors.textMuted },
});
