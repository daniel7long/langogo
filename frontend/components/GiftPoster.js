import { useState } from 'react';
import { View } from 'react-native';

import Svg, { Circle, Ellipse, G, LinearGradient, Defs, Path, Rect, Stop, Text as SvgText, TSpan } from 'react-native-svg';

// The poster for a planted tree / donated meal, drawn in code so it always shows (no picture to download).
// It matches the 1200 x 630 pictures the backend uses for link previews (backend/static/share-tree.png, share-meal.png).
export default function GiftPoster({ unit = 'tree', style, width: fixed }) {
  const [measured, setMeasured] = useState(0); // the poster fills the width it is given; the height follows (1200 x 630)
  const w = fixed || measured;
  const tree = unit === 'tree';
  const accent = tree ? '#2F9250' : '#D95F0E';
  const lines = tree ? ['I planted a tree by', 'practising speaking.'] : ['I donated a meal by', 'practising speaking.'];
  const sub = tree
    ? ['Every flower I earned became a real tree.', 'About 20 kg of CO₂ absorbed every year.']
    : ['Every flower I earned became a meal', 'for a person facing hunger.'];
  return (
    <View
      style={[{ width: fixed || '100%', height: w * 0.525, borderRadius: 16, overflow: 'hidden' }, style]}
      onLayout={(e) => !fixed && setMeasured(Math.round(e.nativeEvent.layout.width))}
    >
      <Svg width={w} height={w * 0.525} viewBox="0 0 1200 630">
        <Defs>
          <LinearGradient id={`gp-${unit}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={tree ? '#DFF3E3' : '#FFE9D3'} />
            <Stop offset="1" stopColor={tree ? '#F5FBEF' : '#FFF7EC'} />
          </LinearGradient>
        </Defs>
        <Rect width="1200" height="630" fill={`url(#gp-${unit})`} />
        <G transform="translate(60 105) scale(3.5)">
          {tree ? (
            <G>
              <Ellipse cx="60" cy="112" rx="40" ry="6" fill="#000" opacity="0.09" />
              <Rect x="54" y="74" width="12" height="36" rx="3" fill="#8A5A33" />
              <Circle cx="60" cy="48" r="36" fill="#3FA65A" />
              <Circle cx="38" cy="60" r="23" fill="#4CB868" />
              <Circle cx="82" cy="58" r="25" fill="#2F9250" />
              <Circle cx="50" cy="36" r="7" fill="#7FD494" opacity="0.75" />
            </G>
          ) : (
            <G>
              <Ellipse cx="60" cy="112" rx="44" ry="6" fill="#000" opacity="0.09" />
              <Path d="M14 60 H106 Q102 102 60 106 Q18 102 14 60 Z" fill="#E8472B" />
              <Rect x="38" y="106" width="44" height="7" rx="3.5" fill="#B93A22" />
              <Ellipse cx="60" cy="60" rx="46" ry="11" fill="#F7D22E" />
              <Circle cx="44" cy="58" r="6.5" fill="#E8472B" />
              <Circle cx="66" cy="55" r="5.5" fill="#4CAF63" />
              <Circle cx="80" cy="60" r="5.5" fill="#F4902B" />
              <Path d="M42 40 Q38 30 44 22 M60 38 Q56 26 62 16 M80 40 Q76 30 82 22" stroke="#C9BBAA" strokeWidth="4" strokeLinecap="round" fill="none" />
            </G>
          )}
        </G>
        <SvgText x="520" y="150" fontSize="26" fontWeight="bold" fill={accent} letterSpacing="3">PRACTISE. SPEAK. GIVE.</SvgText>
        {lines.map((t, i) => (
          <SvgText key={t} x="520" y={250 + i * 70} fontSize="62" fontWeight="bold" fill="#1F1B16">{t}</SvgText>
        ))}
        {sub.map((t, i) => (
          <SvgText key={t} x="520" y={385 + i * 42} fontSize="30" fontWeight="600" fill="#4A433B">{t}</SvgText>
        ))}
        <SvgText x="1144" y="585" fontSize="44" fontWeight="bold" fill="#4BA35B" textAnchor="end">
          Lang<TSpan fill="#F47A20">ogo</TSpan>
        </SvgText>
      </Svg>
    </View>
  );
}
