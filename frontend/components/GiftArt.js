import { View } from 'react-native';

import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

// Pictures for the Gift Menu. Everything here is drawn in code: original designs in the spirit of the genres young learners
// like (sea adventure, basketball, ninja, superheroes, space). They are not any existing character or logo.
//   OutfitArt     worn on top of the avatar            (viewBox 100 x 100, the head is the circle at 50,50 r 38)
//   FrameArt      a ring around the avatar             (viewBox 100 x 100, the ring lives between r 40 and r 50)
//   WallpaperArt  the picture behind the profile       (viewBox 160 x 90, scaled to fill)
// GiftThumb shows any item in the shop on a plain stand-in head.

const POLAR = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
const ABS = { position: 'absolute', left: 0, top: 0 };
const range = (n) => Array.from({ length: n }, (_, i) => i);

// ---- Outfits ----------------------------------------------------------------------------------------------
function Outfit({ id }) {
  switch (id) {
    case 'outfit_bandana': // a red bandana with dots, knotted on the side
      return (
        <G>
          <Path d="M13 36 Q50 12 87 36 L88 47 Q50 25 12 47 Z" fill="#D63B2F" />
          {[22, 34, 46, 58, 70, 80].map((x, i) => <Circle key={i} cx={x} cy={34 - Math.abs(x - 50) * 0.18 + (i % 2) * 3} r="1.8" fill="#FFF" />)}
          <Path d="M84 40 L98 32 L96 46 Z" fill="#B82E24" />
          <Path d="M85 44 L97 54 L91 38 Z" fill="#D63B2F" />
        </G>
      );
    case 'outfit_headband': // a sports sweatband
      return (
        <G>
          <Path d="M12 38 Q50 22 88 38 L88 49 Q50 33 12 49 Z" fill="#12B3A5" />
          <Path d="M12 42 Q50 26 88 42 L88 44.5 Q50 28.5 12 44.5 Z" fill="#FFF" opacity="0.9" />
          <Path d="M86 40 L97 50 L92 52 L84 46 Z" fill="#0E8E83" />
        </G>
      );
    case 'outfit_ninja': // a dark scarf over the chin with a flowing tail
      return (
        <G>
          <Path d="M15 60 Q50 84 85 60 L86 74 Q50 98 14 74 Z" fill="#1F2A44" />
          <Path d="M20 66 Q50 88 80 66" stroke="#D63B2F" strokeWidth="2.5" fill="none" />
          <Path d="M82 68 Q94 66 99 80 Q90 76 84 78 Z" fill="#1F2A44" />
          <Path d="M80 74 Q90 78 96 92 Q86 86 80 84 Z" fill="#D63B2F" />
        </G>
      );
    case 'outfit_mask': // a hero's eye mask
      return (
        <G>
          <Path d="M16 42 Q32 33 50 41 Q68 33 84 42 Q82 60 66 58 Q56 56 50 50 Q44 56 34 58 Q18 60 16 42 Z" fill="#241B3B" />
          <Ellipse cx="35" cy="47" rx="7.5" ry="5" fill="#FFF" />
          <Ellipse cx="65" cy="47" rx="7.5" ry="5" fill="#FFF" />
          <Path d="M10 38 L19 42 L12 46 Z" fill="#241B3B" />
          <Path d="M90 38 L81 42 L88 46 Z" fill="#241B3B" />
        </G>
      );
    case 'outfit_cape': // a red cape with a golden clasp
      return (
        <G>
          <Path d="M4 100 L8 80 Q50 98 92 80 L96 100 Z" fill="#C92C3A" />
          <Path d="M8 80 Q50 98 92 80 L90 86 Q50 104 10 86 Z" fill="#E2495A" />
          <Circle cx="50" cy="91" r="5.5" fill="#F4B63B" stroke="#C98A10" strokeWidth="1.5" />
          <Path d="M50 86.5 L51.5 90 L55 90.5 L52.4 93 L53 96.5 L50 94.7 L47 96.5 L47.6 93 L45 90.5 L48.5 90 Z" fill="#FFF3C7" />
        </G>
      );
    case 'outfit_wizard': // a starry purple hat
      return (
        <G>
          <Path d="M30 34 Q50 28 70 34 L58 4 Q52 -2 46 4 Z" fill="#5B3FA8" />
          <Path d="M30 34 Q28 36 25 36 Q50 44 75 36 Q72 36 70 34 Q50 28 30 34 Z" fill="#432E86" />
          <Path d="M32 31 Q50 25 68 31 L66 27 Q50 21 34 27 Z" fill="#F4B63B" />
          <Circle cx="49" cy="16" r="2.2" fill="#FFE27A" />
          <Circle cx="56" cy="25" r="1.6" fill="#FFE27A" />
          <Circle cx="43" cy="24" r="1.4" fill="#FFF" />
        </G>
      );
    case 'outfit_visor': // a neon visor
      return (
        <G>
          <Defs>
            <LinearGradient id="visor" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#21D4FD" />
              <Stop offset="1" stopColor="#B721FF" />
            </LinearGradient>
          </Defs>
          <Rect x="14" y="39" width="72" height="19" rx="9.5" fill="url(#visor)" opacity="0.88" />
          <Rect x="14" y="39" width="72" height="19" rx="9.5" fill="none" stroke="#FFF" strokeWidth="1.6" opacity="0.9" />
          <Path d="M24 44 L40 44" stroke="#FFF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <Path d="M8 47 L14 47 M86 47 L92 47" stroke="#21D4FD" strokeWidth="3" strokeLinecap="round" />
        </G>
      );
    case 'outfit_crown': // a golden laurel crown
      return (
        <G>
          <Path d="M24 30 L28 10 L40 24 L50 6 L60 24 L72 10 L76 30 Q50 22 24 30 Z" fill="#F4B63B" stroke="#C98A10" strokeWidth="1.6" strokeLinejoin="round" />
          <Circle cx="50" cy="19" r="3" fill="#E2495A" />
          <Circle cx="35" cy="23" r="2" fill="#3DB8D6" />
          <Circle cx="65" cy="23" r="2" fill="#3DB8D6" />
          {[0, 1, 2, 3].map((i) => (
            <G key={i}>
              <Ellipse cx={14 + i * 3} cy={48 + i * 9} rx="3.2" ry="6" fill="#4CAF63" transform={`rotate(${-30 - i * 8} ${14 + i * 3} ${48 + i * 9})`} />
              <Ellipse cx={86 - i * 3} cy={48 + i * 9} rx="3.2" ry="6" fill="#4CAF63" transform={`rotate(${30 + i * 8} ${86 - i * 3} ${48 + i * 9})`} />
            </G>
          ))}
        </G>
      );
    default:
      return null;
  }
}

export function OutfitArt({ id, size = 100, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <Outfit id={id} />
    </Svg>
  );
}

// ---- Frames -----------------------------------------------------------------------------------------------
function Frame({ id }) {
  const c = 50;
  switch (id) {
    case 'frame_halftone':
      return (
        <G>
          <Circle cx={c} cy={c} r="44" stroke="#FFC400" strokeWidth="9" fill="none" />
          {range(36).map((i) => {
            const [x, y] = POLAR(c, c, 44, i * 10);
            return <Circle key={i} cx={x} cy={y} r={1 + (i % 3) * 0.7} fill="#1F1B16" />;
          })}
          <Circle cx={c} cy={c} r="48.5" stroke="#1F1B16" strokeWidth="1.5" fill="none" />
        </G>
      );
    case 'frame_speed':
      return (
        <G>
          <Circle cx={c} cy={c} r="40.5" stroke="#1F1B16" strokeWidth="2" fill="none" />
          {range(40).map((i) => {
            const [x1, y1] = POLAR(c, c, 41, i * 9);
            const [x2, y2] = POLAR(c, c, 46 + (i % 4) * 1.6, i * 9);
            return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 2 ? '#1F1B16' : '#E8472B'} strokeWidth={i % 3 ? 1.6 : 2.4} strokeLinecap="round" />;
          })}
        </G>
      );
    case 'frame_sakura':
      return (
        <G>
          <Circle cx={c} cy={c} r="44" stroke="#F6A9C2" strokeWidth="4" fill="none" />
          {range(10).map((i) => {
            const [x, y] = POLAR(c, c, 44, i * 36);
            return (
              <G key={i}>
                {range(5).map((p) => {
                  const [px, py] = POLAR(x, y, 3.4, p * 72 + i * 36);
                  return <Circle key={p} cx={px} cy={py} r="2.5" fill={i % 2 ? '#FFD3E2' : '#FF8FB4'} />;
                })}
                <Circle cx={x} cy={y} r="1.3" fill="#FFF3A0" />
              </G>
            );
          })}
        </G>
      );
    case 'frame_flame':
      return (
        <G>
          <Defs>
            <LinearGradient id="flameRing" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#FF3D2E" />
              <Stop offset="1" stopColor="#FFC83D" />
            </LinearGradient>
          </Defs>
          <Circle cx={c} cy={c} r="43" stroke="url(#flameRing)" strokeWidth="6" fill="none" />
          {range(12).map((i) => {
            const a = i * 30;
            const [x1, y1] = POLAR(c, c, 44, a - 9);
            const [x2, y2] = POLAR(c, c, 44, a + 9);
            const [tx, ty] = POLAR(c, c, 53 + (i % 3) * 2, a + 4);
            return <Path key={i} d={`M${x1} ${y1} Q${(x1 + tx) / 2 + 2} ${(y1 + ty) / 2} ${tx} ${ty} Q${(x2 + tx) / 2 - 1} ${(y2 + ty) / 2 + 2} ${x2} ${y2} Z`} fill={i % 2 ? '#FF7A1A' : '#FF3D2E'} />;
          })}
        </G>
      );
    case 'frame_bolt':
      return (
        <G>
          <Circle cx={c} cy={c} r="43" stroke="#2D6BFF" strokeWidth="5" fill="none" />
          <Circle cx={c} cy={c} r="43" stroke="#9CC2FF" strokeWidth="1.5" fill="none" />
          {range(8).map((i) => {
            const a = i * 45;
            const p = [POLAR(c, c, 47, a - 7), POLAR(c, c, 43, a - 1), POLAR(c, c, 48, a + 2), POLAR(c, c, 40, a + 9), POLAR(c, c, 45, a + 3), POLAR(c, c, 39, a - 3)];
            return <Polygon key={i} points={p.map((q) => q.join(',')).join(' ')} fill="#FFD928" stroke="#B8860B" strokeWidth="0.6" />;
          })}
        </G>
      );
    case 'frame_neon':
      return (
        <G>
          <Circle cx={c} cy={c} r="45" stroke="#FF2BD6" strokeWidth="7" fill="none" opacity="0.25" />
          <Circle cx={c} cy={c} r="45" stroke="#FF2BD6" strokeWidth="3" fill="none" />
          <Circle cx={c} cy={c} r="40.5" stroke="#22E6FF" strokeWidth="5" fill="none" opacity="0.25" />
          <Circle cx={c} cy={c} r="40.5" stroke="#22E6FF" strokeWidth="2" fill="none" />
          <Circle cx={c} cy={c} r="45" stroke="#FFF" strokeWidth="0.8" fill="none" opacity="0.9" />
        </G>
      );
    case 'frame_gold':
      return (
        <G>
          <Defs>
            <LinearGradient id="goldRing" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFF0A8" />
              <Stop offset="0.5" stopColor="#F2B01E" />
              <Stop offset="1" stopColor="#B87A08" />
            </LinearGradient>
          </Defs>
          <Circle cx={c} cy={c} r="44" stroke="url(#goldRing)" strokeWidth="9" fill="none" />
          <Circle cx={c} cy={c} r="48.4" stroke="#8A5B00" strokeWidth="1" fill="none" />
          <Circle cx={c} cy={c} r="39.6" stroke="#8A5B00" strokeWidth="1" fill="none" />
          {[0, 90, 180, 270].map((a, i) => {
            const [x, y] = POLAR(c, c, 44, a);
            return <Circle key={a} cx={x} cy={y} r="4" fill={['#E2495A', '#3DB8D6', '#4CAF63', '#B06AE0'][i]} stroke="#FFF" strokeWidth="1.2" />;
          })}
        </G>
      );
    case 'frame_galaxy':
      return (
        <G>
          <Defs>
            <LinearGradient id="galaxyRing" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#3B1E8F" />
              <Stop offset="1" stopColor="#B721FF" />
            </LinearGradient>
          </Defs>
          <Circle cx={c} cy={c} r="44" stroke="url(#galaxyRing)" strokeWidth="8" fill="none" />
          {range(26).map((i) => {
            const [x, y] = POLAR(c, c, 44 + ((i * 7) % 5) - 2, i * 13.9);
            return <Circle key={i} cx={x} cy={y} r={0.6 + (i % 3) * 0.4} fill="#FFF" />;
          })}
          <Circle cx="86" cy="22" r="6.2" fill="#FFB347" />
          <Ellipse cx="86" cy="22" rx="10" ry="2.6" stroke="#FFE6B0" strokeWidth="1.2" fill="none" transform="rotate(-25 86 22)" />
        </G>
      );
    default:
      return null;
  }
}

export function FrameArt({ id, size = 100, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <Frame id={id} />
    </Svg>
  );
}

// ---- Wallpapers -------------------------------------------------------------------------------------------
function Wall({ id }) {
  const stars = (n, seed = 3) =>
    range(n).map((i) => <Circle key={i} cx={(i * 37 * seed) % 160} cy={(i * 23 * seed) % 55} r={0.5 + (i % 3) * 0.35} fill="#FFF" opacity={0.5 + (i % 4) * 0.12} />);
  switch (id) {
    case 'wall_sea':
      return (
        <G>
          <Defs>
            <LinearGradient id="seaSky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FF9A6B" />
              <Stop offset="0.6" stopColor="#FFD08A" />
              <Stop offset="1" stopColor="#FFF1C9" />
            </LinearGradient>
          </Defs>
          <Rect width="160" height="90" fill="url(#seaSky)" />
          <Circle cx="112" cy="52" r="17" fill="#FFF4D1" opacity="0.95" />
          <Path d="M0 56 Q20 52 40 56 T80 56 T120 56 T160 56 L160 90 L0 90 Z" fill="#2A6F97" />
          <Path d="M0 66 Q20 62 40 66 T80 66 T120 66 T160 66 L160 90 L0 90 Z" fill="#1F5A7E" />
          <Path d="M0 78 Q20 74 40 78 T80 78 T120 78 T160 78 L160 90 L0 90 Z" fill="#184A69" />
          <Path d="M36 58 L68 58 L62 66 L42 66 Z" fill="#3B2A24" />
          <Path d="M52 56 L52 30" stroke="#3B2A24" strokeWidth="1.5" />
          <Path d="M52 32 L52 54 L36 54 Z" fill="#FFF8E8" />
          <Path d="M54 36 L54 54 L67 54 Z" fill="#FFE9C2" />
          <Path d="M52 30 L60 33 L52 35 Z" fill="#D63B2F" />
        </G>
      );
    case 'wall_court':
      return (
        <G>
          <Defs>
            <LinearGradient id="courtSky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#6C3FA0" />
              <Stop offset="0.55" stopColor="#FF6F61" />
              <Stop offset="1" stopColor="#FFB84D" />
            </LinearGradient>
          </Defs>
          <Rect width="160" height="90" fill="url(#courtSky)" />
          <Circle cx="40" cy="50" r="16" fill="#FFE3A3" opacity="0.9" />
          <Path d="M0 62 L160 62 L160 90 L0 90 Z" fill="#B5651D" />
          <Path d="M0 62 L160 62" stroke="#FFF" strokeWidth="1" opacity="0.7" />
          <Path d="M20 90 L60 62 M80 90 L90 62 M140 90 L120 62" stroke="#FFF" strokeWidth="0.8" opacity="0.5" />
          <Path d="M112 62 L112 24" stroke="#2B2B2B" strokeWidth="3" />
          <Rect x="102" y="12" width="26" height="18" rx="1.5" fill="#FFF" stroke="#2B2B2B" strokeWidth="1.6" />
          <Rect x="109" y="19" width="12" height="8" fill="none" stroke="#E8472B" strokeWidth="1.3" />
          <Ellipse cx="115" cy="32" rx="8" ry="2.2" fill="none" stroke="#E8472B" strokeWidth="1.8" />
          <Path d="M107 33 L110 44 M112 34 L113 45 M118 34 L116 45 M123 33 L120 44" stroke="#FFF" strokeWidth="0.8" />
          <Circle cx="88" cy="46" r="5" fill="#E8651A" stroke="#7A3300" strokeWidth="0.8" />
          <Path d="M83 46 L93 46 M88 41 L88 51" stroke="#7A3300" strokeWidth="0.7" />
        </G>
      );
    case 'wall_pop':
      return (
        <G>
          <Rect width="160" height="90" fill="#FFD83D" />
          {range(11).flatMap((r) => range(20).map((c2) => <Circle key={`${r}-${c2}`} cx={c2 * 8 + (r % 2) * 4} cy={r * 8.4} r={2.1 - (c2 / 20) * 1.2} fill="#F08A00" opacity="0.55" />))}
          <Polygon points={range(24).map((i) => POLAR(80, 45, i % 2 ? 22 : 38, i * 15).join(',')).join(' ')} fill="#E8472B" stroke="#1F1B16" strokeWidth="2.5" />
          <SvgText x="80" y="52" fontSize="22" fontWeight="bold" fill="#FFF" stroke="#1F1B16" strokeWidth="1.2" textAnchor="middle">BAM!</SvgText>
          <Rect x="3" y="3" width="154" height="84" fill="none" stroke="#1F1B16" strokeWidth="2.4" />
        </G>
      );
    case 'wall_city':
      return (
        <G>
          <Defs>
            <LinearGradient id="citySky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0B1030" />
              <Stop offset="1" stopColor="#324A8C" />
            </LinearGradient>
          </Defs>
          <Rect width="160" height="90" fill="url(#citySky)" />
          {stars(20, 5)}
          <Polygon points="124,20 96,90 152,90" fill="#FFF6C2" opacity="0.18" />
          <Circle cx="124" cy="20" r="11" fill="#FFF6C2" opacity="0.95" />
          <Path d="M124 13 L126 19 L132 19 L127 23 L129 29 L124 25 L119 29 L121 23 L116 19 L122 19 Z" fill="#E8A400" />
          {[[0, 52, 16], [14, 40, 14], [28, 58, 18], [46, 44, 12], [58, 62, 16], [74, 36, 14], [88, 56, 14], [102, 48, 16], [118, 60, 14], [132, 42, 16], [148, 54, 12]].map(([x, y, w], i) => (
            <G key={i}>
              <Rect x={x} y={y + 8} width={w} height={90 - y} fill={i % 2 ? '#10163C' : '#171F4D'} />
              {range(6).map((k) => <Rect key={k} x={x + 2 + (k % 2) * (w / 2 - 1)} y={y + 12 + Math.floor(k / 2) * 9} width="3" height="4" fill={(i + k) % 3 ? '#FFD966' : '#1F2A5E'} />)}
            </G>
          ))}
        </G>
      );
    case 'wall_dojo':
      return (
        <G>
          <Defs>
            <LinearGradient id="dojoSky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1E2A5A" />
              <Stop offset="1" stopColor="#8A6FB0" />
            </LinearGradient>
          </Defs>
          <Rect width="160" height="90" fill="url(#dojoSky)" />
          {stars(14, 7)}
          <Circle cx="112" cy="30" r="17" fill="#FFF4D6" />
          <Circle cx="106" cy="26" r="3" fill="#EADFC0" opacity="0.7" />
          <Path d="M0 70 L30 40 L52 62 L80 34 L110 66 L136 46 L160 68 L160 90 L0 90 Z" fill="#3A3A6E" />
          <Path d="M0 80 L26 62 L48 76 L74 58 L104 78 L132 64 L160 80 L160 90 L0 90 Z" fill="#26264F" />
          <G>
            <Rect x="30" y="52" width="4" height="30" fill="#C92C3A" />
            <Rect x="58" y="52" width="4" height="30" fill="#C92C3A" />
            <Path d="M24 50 Q46 44 68 50 L66 55 Q46 50 26 55 Z" fill="#C92C3A" />
            <Rect x="33" y="58" width="26" height="3" fill="#C92C3A" />
          </G>
          {range(9).map((i) => <Ellipse key={i} cx={(i * 19) % 150 + 6} cy={(i * 11) % 60 + 12} rx="1.8" ry="1" fill="#FFB7D0" transform={`rotate(${i * 30} ${(i * 19) % 150 + 6} ${(i * 11) % 60 + 12})`} />)}
        </G>
      );
    case 'wall_burst':
      return (
        <G>
          <Defs>
            <RadialGradient id="burstBg" cx="0.5" cy="0.5" r="0.7">
              <Stop offset="0" stopColor="#FFF6A8" />
              <Stop offset="0.5" stopColor="#FF8A2B" />
              <Stop offset="1" stopColor="#B3122D" />
            </RadialGradient>
          </Defs>
          <Rect width="160" height="90" fill="url(#burstBg)" />
          {range(48).map((i) => {
            const [x, y] = POLAR(80, 45, 120, i * 7.5);
            const [x2, y2] = POLAR(80, 45, 120, i * 7.5 + 3.2);
            return <Polygon key={i} points={`80,45 ${x},${y} ${x2},${y2}`} fill="#FFF" opacity={i % 2 ? 0.28 : 0.1} />;
          })}
          <Circle cx="80" cy="45" r="11" fill="#FFF" opacity="0.9" />
        </G>
      );
    case 'wall_aurora':
      return (
        <G>
          <Defs>
            <LinearGradient id="aurSky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#04112B" />
              <Stop offset="1" stopColor="#0E3B4F" />
            </LinearGradient>
            <LinearGradient id="aurA" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#3DFFB0" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#3DFFB0" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="aurB" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#B27CFF" stopOpacity="0.8" />
              <Stop offset="1" stopColor="#B27CFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="160" height="90" fill="url(#aurSky)" />
          {stars(30, 11)}
          <Path d="M0 30 Q30 4 60 24 T120 18 T160 30 L160 70 Q120 52 90 66 T0 60 Z" fill="url(#aurA)" />
          <Path d="M0 44 Q36 18 70 38 T130 30 T160 40 L160 76 Q124 62 94 74 T0 72 Z" fill="url(#aurB)" opacity="0.8" />
          <Path d="M0 90 L0 74 Q40 66 80 78 T160 72 L160 90 Z" fill="#E9F3FA" />
          <Path d="M0 90 L0 82 Q50 76 100 84 T160 80 L160 90 Z" fill="#C9DDEB" />
        </G>
      );
    case 'wall_cosmos':
      return (
        <G>
          <Defs>
            <LinearGradient id="cosSky" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#0A0420" />
              <Stop offset="1" stopColor="#3A1466" />
            </LinearGradient>
          </Defs>
          <Rect width="160" height="90" fill="url(#cosSky)" />
          {range(46).map((i) => <Circle key={i} cx={(i * 53) % 160} cy={(i * 31) % 90} r={0.4 + (i % 4) * 0.35} fill="#FFF" opacity={0.4 + (i % 5) * 0.12} />)}
          <Circle cx="38" cy="50" r="22" fill="#F29E4C" />
          <Path d="M20 42 Q38 36 56 44 M17 52 Q38 46 59 54 M22 62 Q38 58 54 62" stroke="#C86F2A" strokeWidth="3" fill="none" opacity="0.7" />
          <Ellipse cx="38" cy="52" rx="36" ry="7" stroke="#FFE2B8" strokeWidth="2" fill="none" transform="rotate(-18 38 52)" opacity="0.9" />
          <Circle cx="118" cy="22" r="8" fill="#6EC6E8" />
          <Circle cx="116" cy="20" r="2.2" fill="#A9E4F7" />
          <Path d="M150 66 L118 80" stroke="#FFF" strokeWidth="1.4" opacity="0.8" />
          <Path d="M150 66 L124 78" stroke="#9AD7FF" strokeWidth="3" opacity="0.35" />
          <Circle cx="150" cy="66" r="3" fill="#FFF" />
        </G>
      );
    default:
      return <Rect width="160" height="90" fill="#EEE" />;
  }
}

export function WallpaperArt({ id, width = 160, height = 90 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice">
      <Wall id={id} />
    </Svg>
  );
}

// A shop item on a plain stand-in: a grey head for outfits, a grey disc for frames, the picture itself for wallpapers.
export function GiftThumb({ item, size = 84 }) {
  if (item.slot === 'wallpaper') {
    return (
      <View style={{ width: size * 1.4, height: size * 0.8, borderRadius: 10, overflow: 'hidden' }}>
        <WallpaperArt id={item.id} width={size * 1.4} height={size * 0.8} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={ABS}>
        <Circle cx="50" cy="50" r="38" fill="#E9DFD3" />
        <Circle cx="50" cy="44" r="12" fill="#CDBFAF" />
        <Path d="M26 78 Q50 52 74 78 Q50 94 26 78 Z" fill="#CDBFAF" />
      </Svg>
      {item.slot === 'frame' ? (
        <FrameArt id={item.id} size={size} style={ABS} />
      ) : (
        <OutfitArt id={item.id} size={size} style={ABS} />
      )}
    </View>
  );
}
