import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

// National flags drawn as vector graphics. (Flag emoji do not show up on Windows, so they can't be used.)
// All flags share a 90 x 60 box; `width` scales them, the height is two thirds of it.
// The colors are the official ones and are not part of the Figma tokens.

function star(cx, cy, r, tipAngleDeg) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.382;
    const a = ((tipAngleDeg + i * 36) * Math.PI) / 180;
    pts.push(`${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function ChinaStars() {
  const big = { x: 15, y: 15 };
  const small = [[30, 6], [36, 12], [36, 21], [30, 27]];
  return (
    <>
      <Polygon points={star(big.x, big.y, 9, -90)} fill="#FFDE00" />
      {small.map(([x, y]) => {
        const toBig = (Math.atan2(big.y - y, big.x - x) * 180) / Math.PI;
        return <Polygon key={`${x}-${y}`} points={star(x, y, 3, toBig)} fill="#FFDE00" />;
      })}
    </>
  );
}

// One trigram of the Korean flag: three bars, each solid (1) or broken (0).
function Trigram({ x, y, angle, bars }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${angle})`}>
      {bars.map((solid, i) => {
        const top = (i - 1) * 4 - 1.2;
        return solid ? (
          <Rect key={i} x={-9} y={top} width={18} height={2.4} fill="#000000" />
        ) : (
          <G key={i}>
            <Rect x={-9} y={top} width={7.8} height={2.4} fill="#000000" />
            <Rect x={1.2} y={top} width={7.8} height={2.4} fill="#000000" />
          </G>
        );
      })}
    </G>
  );
}

function Korea() {
  return (
    <>
      <Rect width="90" height="60" fill="#FFFFFF" />
      {/* the taegeuk: red above, blue below, with the S-shaped curve, turned like on the real flag */}
      <G transform="rotate(-33.69 45 30)">
        <Path d="M30 30 A15 15 0 0 1 60 30 Z" fill="#CD2E3A" />
        <Path d="M30 30 A15 15 0 0 0 60 30 Z" fill="#0047A0" />
        <Circle cx="37.5" cy="30" r="7.5" fill="#0047A0" />
        <Circle cx="52.5" cy="30" r="7.5" fill="#CD2E3A" />
      </G>
      <Trigram x={14} y={12} angle={-56.31} bars={[1, 1, 1]} />
      <Trigram x={76} y={48} angle={-56.31} bars={[0, 0, 0]} />
      <Trigram x={76} y={12} angle={56.31} bars={[0, 1, 0]} />
      <Trigram x={14} y={48} angle={56.31} bars={[1, 0, 1]} />
    </>
  );
}

const DRAW = {
  fr: () => (
    <>
      <Rect x="0" width="30" height="60" fill="#0055A4" />
      <Rect x="30" width="30" height="60" fill="#FFFFFF" />
      <Rect x="60" width="30" height="60" fill="#EF4135" />
    </>
  ),
  es: () => (
    <>
      <Rect width="90" height="60" fill="#AA151B" />
      <Rect y="15" width="90" height="30" fill="#F1BF00" />
    </>
  ),
  de: () => (
    <>
      <Rect y="0" width="90" height="20" fill="#000000" />
      <Rect y="20" width="90" height="20" fill="#DD0000" />
      <Rect y="40" width="90" height="20" fill="#FFCE00" />
    </>
  ),
  zh: () => (
    <>
      <Rect width="90" height="60" fill="#DE2910" />
      <ChinaStars />
    </>
  ),
  ja: () => (
    <>
      <Rect width="90" height="60" fill="#FFFFFF" />
      <Circle cx="45" cy="30" r="18" fill="#BC002D" />
    </>
  ),
  ko: Korea,
  it: () => (
    <>
      <Rect x="0" width="30" height="60" fill="#009246" />
      <Rect x="30" width="30" height="60" fill="#FFFFFF" />
      <Rect x="60" width="30" height="60" fill="#CE2B37" />
    </>
  ),
  // Arabic is spoken in over twenty countries, so it gets no national flag: a calm green tile with the letter ع.
  ar: () => (
    <>
      <Rect width="90" height="60" fill="#0F766E" />
      <SvgText x="45" y="45" fontSize="44" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">ع</SvgText>
    </>
  ),
};

// `round` crops the flag into a circle (the language cards); `ring` adds the soft warm halo around it.
export default function Flag({ id, width = 72, style, round = false, ring = false }) {
  const draw = DRAW[id];
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' };
  if (round) {
    const flag = (
      <View
        {...hidden}
        style={[styles.frame, { width, height: width, borderRadius: width / 2 }, !ring && style]}
      >
        <Svg width={width * 1.5} height={width} viewBox="0 0 90 60" style={{ marginLeft: -width * 0.25 }}>
          {draw ? draw() : <Rect width="90" height="60" fill="#E3E3E3" />}
        </Svg>
      </View>
    );
    if (!ring) return flag;
    const pad = Math.round(width * 0.09);
    return (
      <View style={[{ padding: pad, borderRadius: (width + pad * 2) / 2, backgroundColor: '#FFF1E4' }, style]}>{flag}</View>
    );
  }
  const height = (width * 2) / 3;
  return (
    <View {...hidden} style={[styles.frame, { width, height, borderRadius: Math.max(4, width / 12) }, style]}>
      <Svg width={width} height={height} viewBox="0 0 90 60">
        {draw ? draw() : <Rect width="90" height="60" fill="#E3E3E3" />}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.14)', backgroundColor: '#FFFFFF' },
});
