import { useState } from 'react';
import { View } from 'react-native';

import Svg, { Defs, LinearGradient, Rect, Stop, Text as SvgText, TSpan } from 'react-native-svg';

import { Scene } from './GiftScenes';

// The poster for a planted tree / donated meal, drawn in code so it always shows (no picture to download).
// `variant` picks one of six illustrated scenes; `headline` and `sub` are the wording chosen by the server,
// so the picture and the words differ from one gift to the next. `bare` leaves the words out (used for link previews).
const wrap = (text, max) => {
  const lines = [];
  let line = '';
  for (const word of String(text || '').split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + word).length > max) { lines.push(line); line = word; } else line = line ? line + ' ' + word : word;
  }
  if (line) lines.push(line);
  return lines;
};

export default function GiftPoster({ unit = 'tree', variant = 0, headline = '', sub = '', style, width: fixed, bare = false }) {
  const [measured, setMeasured] = useState(0); // the poster fills the width it is given; the height follows (1200 x 630)
  const w = fixed || measured;
  const head = wrap(headline || (unit === 'tree' ? 'I helped plant a tree by practising speaking.' : 'I helped provide a meal by practising speaking.'), 44).slice(0, 2);
  const subs = wrap(sub, 76).slice(0, 1);
  return (
    <View
      style={[{ width: fixed || '100%', height: w * 0.525, borderRadius: 16, overflow: 'hidden' }, style]}
      onLayout={(e) => !fixed && setMeasured(Math.round(e.nativeEvent.layout.width))}
    >
      <Svg width={w} height={w * 0.525} viewBox="0 0 1200 630">
        <Defs>
          <LinearGradient id="gp-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#10130F" stopOpacity="0" />
            <Stop offset="1" stopColor="#10130F" stopOpacity="0.94" />
          </LinearGradient>
        </Defs>
        <Scene unit={unit} variant={variant} />
        {!bare && (
          <>
            <Rect y="360" width="1200" height="40" fill="url(#gp-fade)" />
            <Rect y="400" width="1200" height="230" fill="#10130F" />
            <SvgText x="60" y="444" fontSize="20" fontWeight="bold" fill="#FFD27A" letterSpacing="3">PRACTISE. SPEAK. GIVE.</SvgText>
            {head.map((t, i) => (
              <SvgText key={`h${i}`} x="60" y={498 + i * 52} fontSize="46" fontWeight="bold" fill="#FFFFFF">{t}</SvgText>
            ))}
            {subs.map((t, i) => (
              <SvgText key={`s${i}`} x="60" y={498 + head.length * 52 + 4 + i * 34} fontSize="26" fontWeight="600" fill="#E9E3D6">{t}</SvgText>
            ))}
          </>
        )}
        <SvgText x="1150" y={bare ? 590 : 446} fontSize={bare ? 36 : 30} fontWeight="bold" fill="#FFFFFF" textAnchor="end" stroke="#10130F" strokeOpacity="0.35" strokeWidth="1">
          Lang<TSpan fill="#FFB067">ogo</TSpan>
        </SvgText>
      </Svg>
    </View>
  );
}
