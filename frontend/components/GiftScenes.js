import { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

// Twelve original illustrated scenes (6 for a planted tree, 6 for a donated meal), each drawn on a 1200 x 630 canvas.
// The people are shown with a range of skin tones, ages and hair; nothing here is a logo or a copy of someone else's artwork.

const SKIN = ['#F3CFAE', '#E4B188', '#C98B5E', '#9A6340', '#6B4430', '#4A2E20'];
const HAIR = ['#2B1B12', '#4A2C17', '#16110E', '#8A5A2B', '#D9B45A', '#3A3A3A'];

function Grad({ id, stops, vertical = true }) {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
      {stops.map(([o, c], i) => <Stop key={i} offset={o} stopColor={c} />)}
    </LinearGradient>
  );
}

// A person from the hips up, drawn around (0,0) = hip centre. `arm` lifts the right arm.
function Person({ x, y, s = 1, skin = 0, hair = 0, shirt = '#4D7CC9', style = 'short', arm = 0, child = false, flip = false }) {
  const k = child ? 0.78 : 1;
  const sk = SKIN[skin], hr = HAIR[hair];
  return (
    <G transform={`translate(${x} ${y}) scale(${flip ? -s * k : s * k} ${s * k})`}>
      <Path d="M-38 0 Q-40 -70 -22 -92 Q0 -102 22 -92 Q40 -70 38 0 Z" fill={shirt} />
      <Rect x="-8" y="-108" width="16" height="20" rx="6" fill={sk} />
      <Path d={`M-34 -78 Q-52 -48 ${-44 + arm * 6} ${-22 - arm * 10}`} stroke={shirt} strokeWidth="17" strokeLinecap="round" fill="none" />
      <Path d={`M34 -78 Q54 ${-50 - arm * 24} ${46 + arm * 4} ${-26 - arm * 56}`} stroke={shirt} strokeWidth="17" strokeLinecap="round" fill="none" />
      <Circle cx={-44 + arm * 6} cy={-20 - arm * 10} r="9" fill={sk} />
      <Circle cx={46 + arm * 4} cy={-24 - arm * 56} r="9" fill={sk} />
      <Ellipse cx="0" cy="-128" rx="25" ry="28" fill={sk} />
      {style === 'short' && <Path d="M-26 -130 Q-26 -158 0 -158 Q26 -158 26 -130 Q14 -142 0 -141 Q-14 -142 -26 -130 Z" fill={hr} />}
      {style === 'long' && <Path d="M-27 -120 Q-32 -160 0 -160 Q32 -160 27 -120 Q28 -100 20 -88 Q22 -128 0 -140 Q-22 -128 -20 -88 Q-28 -100 -27 -120 Z" fill={hr} />}
      {style === 'curly' && (
        <G fill={hr}>
          <Circle cx="-20" cy="-148" r="13" /><Circle cx="0" cy="-156" r="15" /><Circle cx="20" cy="-148" r="13" />
          <Circle cx="-27" cy="-132" r="10" /><Circle cx="27" cy="-132" r="10" />
        </G>
      )}
      {style === 'wrap' && <Path d="M-27 -128 Q-28 -166 0 -164 Q28 -166 27 -128 Q10 -144 0 -142 Q-10 -144 -27 -128 Z" fill="#E9A23B" />}
      {style === 'cap' && (
        <G>
          <Path d="M-27 -132 Q-26 -160 0 -160 Q26 -160 27 -132 Z" fill="#E2573B" />
          <Rect x="-4" y="-138" width="40" height="8" rx="4" fill="#C9432B" />
        </G>
      )}
      <Circle cx="-9" cy="-126" r="2.6" fill="#2A1A12" /><Circle cx="9" cy="-126" r="2.6" fill="#2A1A12" />
      <Path d="M-9 -114 Q0 -106 9 -114" stroke="#2A1A12" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </G>
  );
}

function Sapling({ x, y, s = 1, tone = '#3FA65A', light = '#7FD494' }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Ellipse cx="0" cy="6" rx="46" ry="12" fill="#5B3B24" />
      <Ellipse cx="0" cy="2" rx="38" ry="9" fill="#7A5232" />
      <Path d="M0 0 Q-3 -34 2 -62" stroke="#6B8E3A" strokeWidth="6" strokeLinecap="round" fill="none" />
      <Path d="M1 -28 Q-26 -34 -34 -56 Q-8 -58 1 -28 Z" fill={tone} />
      <Path d="M2 -40 Q28 -44 38 -68 Q10 -70 2 -40 Z" fill={light} />
      <Path d="M2 -62 Q-14 -84 -2 -104 Q16 -86 2 -62 Z" fill={tone} />
    </G>
  );
}

function Tree({ x, y, s = 1, a = '#2F7D4A', b = '#3FA65A' }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Rect x="-6" y="-40" width="12" height="42" rx="3" fill="#6B4A2E" />
      <Circle cx="0" cy="-70" r="34" fill={a} />
      <Circle cx="-22" cy="-52" r="22" fill={b} />
      <Circle cx="24" cy="-54" r="24" fill={a} />
    </G>
  );
}

function Pine({ x, y, s = 1, c = '#24604A' }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Polygon points="0,-120 26,-70 -26,-70" fill={c} />
      <Polygon points="0,-90 34,-36 -34,-36" fill={c} />
      <Polygon points="0,-58 42,4 -42,4" fill={c} />
    </G>
  );
}

function Bokeh({ items }) {
  return (
    <G>
      {items.map(([cx, cy, r, c, o], i) => <Circle key={i} cx={cx} cy={cy} r={r} fill={c} opacity={o} />)}
    </G>
  );
}

function Bowl({ x, y, s = 1, food = '#F7F1E3', rim = '#D9622B', steam = true }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      {steam && <Path d="M-18 -34 Q-26 -52 -16 -66 M2 -36 Q-6 -56 4 -72 M22 -34 Q14 -50 24 -62" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.7" />}
      <Path d="M-46 -20 H46 Q42 26 0 30 Q-42 26 -46 -20 Z" fill={rim} />
      <Ellipse cx="0" cy="-20" rx="46" ry="11" fill={food} />
      <Circle cx="-14" cy="-22" r="5" fill="#E8472B" /><Circle cx="10" cy="-24" r="4.5" fill="#5DB36D" /><Circle cx="24" cy="-20" r="4" fill="#F4902B" />
    </G>
  );
}

// ---------- TREE SCENES ----------

function T0() { // sunrise planting
  return (
    <G>
      <Defs>
        <Grad id="t0s" stops={[[0, '#FFD9A0'], [0.55, '#FFB27A'], [1, '#F58F6B']]} />
        <RadialGradient id="t0g" cx="0.5" cy="0.5" r="0.5"><Stop offset="0" stopColor="#FFF4C2" stopOpacity="0.95" /><Stop offset="1" stopColor="#FFF4C2" stopOpacity="0" /></RadialGradient>
      </Defs>
      <Rect width="1200" height="630" fill="url(#t0s)" />
      <Circle cx="820" cy="250" r="300" fill="url(#t0g)" />
      <Circle cx="820" cy="250" r="70" fill="#FFF6D2" />
      <Path d="M0 330 Q220 270 420 320 T800 310 T1200 300 V630 H0 Z" fill="#7FB36A" />
      <Path d="M0 380 Q260 330 520 380 T1200 360 V630 H0 Z" fill="#5E9C57" />
      <Tree x="140" y="352" s={0.7} a="#3E8A52" b="#52A565" /><Tree x="240" y="360" s={0.5} a="#3E8A52" b="#52A565" />
      <Path d="M0 470 Q300 420 640 470 T1200 450 V630 H0 Z" fill="#3F8A4C" />
      <Sapling x="600" y="470" s={1.5} />
      <Person x="430" y="500" s={1.25} skin={3} hair={0} shirt="#3C7DD9" style="short" arm={1} />
      <Person x="770" y="520" s={1.15} skin={1} hair={5} shirt="#E26B4F" style="long" child />
      <Bokeh items={[[120, 120, 40, '#fff', 0.15], [300, 70, 24, '#fff', 0.18], [1050, 110, 34, '#fff', 0.14]]} />
    </G>
  );
}

function T1() { // hands cupping a sapling, soft green bokeh
  return (
    <G>
      <Defs><Grad id="t1s" stops={[[0, '#CFEFC8'], [1, '#6DB77F']]} /></Defs>
      <Rect width="1200" height="630" fill="url(#t1s)" />
      <Bokeh items={[[150, 120, 70, '#fff', 0.25], [340, 60, 40, '#F4FFD2', 0.3], [520, 150, 56, '#fff', 0.2], [880, 80, 64, '#F4FFD2', 0.3], [1060, 170, 80, '#fff', 0.2], [980, 300, 38, '#fff', 0.2], [90, 320, 44, '#F4FFD2', 0.25]]} />
      <Path d="M0 460 Q300 420 600 450 T1200 430 V630 H0 Z" fill="#3E8F5A" opacity="0.55" />
      <G transform="translate(600 360)">
        <Path d="M-210 150 Q-230 40 -150 10 Q-60 -4 0 40 Q60 -4 150 10 Q230 40 210 150 Z" fill={SKIN[2]} />
        <Path d="M-150 10 Q-90 -14 -20 24 Q-60 60 -130 50 Z" fill={SKIN[2]} />
        <Path d="M-120 12 Q-100 -6 -70 4 M-70 20 Q-48 4 -22 16 M120 12 Q100 -6 70 4 M70 20 Q48 4 22 16" stroke="#B2764C" strokeWidth="5" strokeLinecap="round" fill="none" />
        <Ellipse cx="0" cy="30" rx="120" ry="34" fill="#6A4430" />
        <Ellipse cx="0" cy="22" rx="104" ry="26" fill="#86583A" />
        <Path d="M0 20 Q-6 -60 4 -130" stroke="#6B8E3A" strokeWidth="10" strokeLinecap="round" fill="none" />
        <Path d="M2 -50 Q-60 -56 -78 -112 Q-14 -112 2 -50 Z" fill="#3FA65A" />
        <Path d="M4 -78 Q62 -86 86 -146 Q18 -146 4 -78 Z" fill="#69C27B" />
        <Path d="M4 -130 Q-34 -178 -6 -222 Q36 -178 4 -130 Z" fill="#3FA65A" />
        <Circle cx="-40" cy="-90" r="6" fill="#fff" opacity="0.7" />
      </G>
    </G>
  );
}

function T2() { // misty forest hillside with one bright sapling
  return (
    <G>
      <Defs>
        <Grad id="t2s" stops={[[0, '#BFE3E8'], [1, '#EAF6E4']]} />
        <LinearGradient id="t2b" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#FFF3B8" stopOpacity="0.0" /><Stop offset="0.5" stopColor="#FFF3B8" stopOpacity="0.55" /><Stop offset="1" stopColor="#FFF3B8" stopOpacity="0" /></LinearGradient>
      </Defs>
      <Rect width="1200" height="630" fill="url(#t2s)" />
      <Path d="M0 250 Q300 170 620 240 T1200 200 V630 H0 Z" fill="#9CC8B9" />
      {[60, 150, 250, 340, 440, 540, 700, 800, 910, 1010, 1120].map((x, i) => <Pine key={x} x={x} y={300 + (i % 3) * 10} s={0.9 + (i % 4) * 0.08} c="#7FB5A4" />)}
      <Rect y="280" width="1200" height="70" fill="#EAF6E4" opacity="0.6" />
      <Path d="M0 360 Q320 300 640 350 T1200 330 V630 H0 Z" fill="#5F9E7B" />
      {[40, 130, 230, 330, 880, 980, 1090, 1170].map((x, i) => <Pine key={x} x={x} y={400 + (i % 2) * 18} s={1.25 + (i % 3) * 0.12} c="#2F6E55" />)}
      <Path d="M0 470 Q380 430 700 470 T1200 450 V630 H0 Z" fill="#3A7F55" />
      <Polygon points="520,0 700,0 800,630 440,630" fill="url(#t2b)" />
      <Sapling x="610" y="520" s={1.6} tone="#4CB86A" light="#9BE6AE" />
      <Bokeh items={[[560, 330, 6, '#fff', 0.8], [660, 280, 5, '#fff', 0.7], [720, 380, 7, '#fff', 0.7], [500, 420, 5, '#fff', 0.7]]} />
    </G>
  );
}

function T3() { // community planting on a hillside
  return (
    <G>
      <Defs><Grad id="t3s" stops={[[0, '#8CCBF0'], [1, '#E7F5FF']]} /></Defs>
      <Rect width="1200" height="630" fill="url(#t3s)" />
      <Ellipse cx="260" cy="110" rx="110" ry="34" fill="#fff" opacity="0.9" /><Ellipse cx="340" cy="96" rx="80" ry="30" fill="#fff" opacity="0.9" />
      <Ellipse cx="930" cy="150" rx="120" ry="32" fill="#fff" opacity="0.85" />
      <Path d="M0 300 Q300 230 600 290 T1200 270 V630 H0 Z" fill="#8FC57A" />
      <Path d="M0 380 Q360 330 720 380 T1200 360 V630 H0 Z" fill="#6DB06A" />
      <Path d="M0 460 Q300 430 600 470 T1200 450 V630 H0 Z" fill="#4B9A59" />
      <Sapling x="210" y="450" s={0.9} /><Sapling x="560" y="440" s={0.9} /><Sapling x="950" y="450" s={0.9} />
      <Person x="330" y="470" s={1} skin={4} hair={2} shirt="#F2B13C" style="curly" arm={1} />
      <Person x="700" y="480" s={1.05} skin={0} hair={3} shirt="#2FA7A0" style="long" />
      <Person x="1060" y="490" s={1} skin={2} hair={0} shirt="#C95A8D" style="wrap" arm={1} />
      <Person x="110" y="500" s={0.95} skin={1} hair={1} shirt="#6C63D9" style="cap" child />
    </G>
  );
}

function T4() { // savanna acacia sunset with watering
  return (
    <G>
      <Defs><Grad id="t4s" stops={[[0, '#7A3E7E'], [0.45, '#E8704F'], [1, '#FFC46B']]} /></Defs>
      <Rect width="1200" height="630" fill="url(#t4s)" />
      <Circle cx="300" cy="360" r="110" fill="#FFE7A0" />
      <Path d="M0 410 Q300 380 600 410 T1200 395 V630 H0 Z" fill="#B5603A" />
      <G fill="#4A2A2A">
        <Rect x="880" y="250" width="10" height="170" />
        <Path d="M760 262 Q830 214 890 240 Q960 206 1040 258 Q930 238 890 262 Q830 242 760 262 Z" />
      </G>
      <G fill="#6A3A33">
        <Rect x="1080" y="320" width="7" height="100" />
        <Path d="M1030 330 Q1080 300 1130 328 Q1085 322 1080 336 Q1060 322 1030 330 Z" />
      </G>
      <Path d="M0 480 Q400 450 800 490 T1200 470 V630 H0 Z" fill="#8F4A2F" />
      <Sapling x="560" y="500" s={1.3} tone="#6FB452" light="#A7DA79" />
      <G transform="translate(690 470)">
        <Path d="M0 0 L50 -30 L58 -10 L10 22 Z" fill="#3E7CB1" /><Path d="M50 -30 L96 -52" stroke="#3E7CB1" strokeWidth="7" strokeLinecap="round" />
        <Path d="M-6 -4 Q-30 -18 -22 -40" stroke="#3E7CB1" strokeWidth="6" fill="none" strokeLinecap="round" />
        <Path d="M-14 24 Q-60 30 -88 70 M-6 30 Q-30 52 -44 88" stroke="#A8D8F0" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.9" />
      </G>
      <Person x="790" y="540" s={1.35} skin={5} hair={2} shirt="#F2C14A" style="short" arm={1} />
    </G>
  );
}

function T5() { // rain-fresh sapling with a rainbow
  return (
    <G>
      <Defs><Grad id="t5s" stops={[[0, '#7FA2B5'], [1, '#CFE4E6']]} /></Defs>
      <Rect width="1200" height="630" fill="url(#t5s)" />
      <G fill="none" strokeWidth="14" opacity="0.5">
        <Path d="M240 470 A360 360 0 0 1 960 470" stroke="#E9605A" /><Path d="M254 470 A346 346 0 0 1 946 470" stroke="#F4A94E" />
        <Path d="M268 470 A332 332 0 0 1 932 470" stroke="#F7DA5B" /><Path d="M282 470 A318 318 0 0 1 918 470" stroke="#6CC27A" />
        <Path d="M296 470 A304 304 0 0 1 904 470" stroke="#5AA7E0" />
      </G>
      <Ellipse cx="260" cy="110" rx="190" ry="48" fill="#8EA6B3" /><Ellipse cx="900" cy="90" rx="230" ry="54" fill="#8EA6B3" />
      <G stroke="#EAF6FF" strokeWidth="3" strokeLinecap="round" opacity="0.7">
        {Array.from({ length: 46 }).map((_, i) => { const x = (i * 137) % 1200, y = 120 + ((i * 71) % 330); return <Path key={i} d={`M${x} ${y} l-10 30`} />; })}
      </G>
      <Path d="M0 470 Q300 440 600 470 T1200 455 V630 H0 Z" fill="#4C8F5E" />
      <Ellipse cx="600" cy="560" rx="260" ry="38" fill="#9CC4D2" opacity="0.8" />
      <Ellipse cx="560" cy="558" rx="120" ry="12" fill="#fff" opacity="0.35" />
      <Sapling x="600" y="510" s={1.7} tone="#3FB063" light="#8EE2A4" />
      <Circle cx="560" cy="360" r="7" fill="#fff" opacity="0.85" /><Circle cx="650" cy="330" r="6" fill="#fff" opacity="0.85" /><Circle cx="622" cy="410" r="5" fill="#fff" opacity="0.85" />
    </G>
  );
}

// ---------- MEAL SCENES ----------

function M0() { // school canteen
  return (
    <G>
      <Defs><Grad id="m0w" stops={[[0, '#FFE2B8'], [1, '#FFC98A']]} /></Defs>
      <Rect width="1200" height="630" fill="url(#m0w)" />
      <Rect x="70" y="70" width="300" height="230" rx="10" fill="#BDE3F5" /><Path d="M220 70 V300 M70 185 H370" stroke="#fff" strokeWidth="10" />
      <Polygon points="70,300 370,300 520,630 -60,630" fill="#fff" opacity="0.18" />
      <Rect x="800" y="90" width="300" height="150" rx="8" fill="#2F5D50" /><Path d="M830 130 H960 M830 165 H1030 M830 200 H900" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
      <Rect y="400" width="1200" height="230" fill="#A8683A" />
      <Rect y="400" width="1200" height="18" fill="#C98B55" />
      <Person x="250" y="410" s={1.15} skin={2} hair={0} shirt="#E2573B" style="short" child />
      <Person x="520" y="410" s={1.15} skin={0} hair={4} shirt="#3C8DD9" style="long" child />
      <Person x="790" y="410" s={1.15} skin={4} hair={2} shirt="#F2B13C" style="curly" child />
      <Person x="1040" y="410" s={1.15} skin={1} hair={1} shirt="#5CB06A" style="cap" child />
      <Bowl x="250" y="500" s={1.1} /><Bowl x="520" y="500" s={1.1} rim="#3E8F8A" /><Bowl x="790" y="500" s={1.1} rim="#C94F6B" /><Bowl x="1040" y="500" s={1.1} rim="#D9A32B" />
    </G>
  );
}

function M1() { // a bowl handed from one pair of hands to another
  return (
    <G>
      <Defs>
        <RadialGradient id="m1g" cx="0.5" cy="0.45" r="0.7"><Stop offset="0" stopColor="#FFE9B8" /><Stop offset="1" stopColor="#F29A5B" /></RadialGradient>
      </Defs>
      <Rect width="1200" height="630" fill="url(#m1g)" />
      <Bokeh items={[[140, 130, 60, '#fff', 0.2], [330, 80, 34, '#fff', 0.2], [1040, 120, 70, '#fff', 0.2], [900, 60, 30, '#fff', 0.22]]} />
      <G>
        <Path d="M-20 470 Q120 360 330 400 L520 430 L520 530 Q300 560 120 630 L-20 630 Z" fill={SKIN[4]} />
        <Path d="M300 400 Q400 410 470 440 L440 470 Q370 440 300 450 Z" fill={SKIN[4]} />
        <Path d="M1220 480 Q1080 380 880 410 L690 440 L690 540 Q900 560 1080 630 L1220 630 Z" fill={SKIN[1]} />
        <Path d="M900 410 Q800 420 730 450 L760 480 Q830 450 900 460 Z" fill={SKIN[1]} />
      </G>
      <G transform="translate(600 400)">
        <Path d="M-14 -36 Q-26 -66 -12 -92 M10 -38 Q-2 -72 12 -102 M34 -36 Q22 -62 34 -86" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.7" />
        <Path d="M-110 -30 H110 Q104 70 0 80 Q-104 70 -110 -30 Z" fill="#CF5A2B" />
        <Ellipse cx="0" cy="-30" rx="110" ry="24" fill="#F7EEDC" />
        <Circle cx="-40" cy="-34" r="11" fill="#E8472B" /><Circle cx="10" cy="-38" r="10" fill="#5DB36D" /><Circle cx="52" cy="-30" r="9" fill="#F4902B" /><Circle cx="-6" cy="-24" r="8" fill="#F6D45C" />
      </G>
      <Path d="M330 420 Q380 400 440 420 M780 430 Q840 410 900 430" stroke="#fff" strokeWidth="5" opacity="0.25" fill="none" />
    </G>
  );
}

function M2() { // shared table seen from above
  return (
    <G>
      <Rect width="1200" height="630" fill="#B87B47" />
      <G stroke="#A56A38" strokeWidth="3" opacity="0.7">{[60, 150, 240, 330, 420, 510, 600].map((y) => <Path key={y} d={`M0 ${y} H1200`} />)}</G>
      <Rect x="40" y="40" width="1120" height="550" rx="30" fill="#FFF3E0" opacity="0.18" />
      {[[240, 220, '#D9622B', '#F7EEDC'], [600, 190, '#3E8F8A', '#F2C14A'], [960, 230, '#C94F6B', '#F7EEDC'], [420, 430, '#D9A32B', '#E8472B'], [800, 440, '#5C7DD9', '#F7EEDC']].map(([x, y, r, f], i) => (
        <G key={i}>
          <Circle cx={x} cy={y} r="92" fill={r} /><Circle cx={x} cy={y} r="74" fill="#fff" opacity="0.92" /><Circle cx={x} cy={y} r="62" fill={f} />
          <Circle cx={x - 20} cy={y - 10} r="12" fill="#5DB36D" /><Circle cx={x + 18} cy={y + 14} r="11" fill="#E8472B" /><Circle cx={x + 24} cy={y - 18} r="9" fill="#F4902B" />
        </G>
      ))}
      <Ellipse cx="110" cy="420" rx="60" ry="42" fill="#E6B36B" /><Path d="M70 410 Q110 380 150 410" stroke="#C98B3E" strokeWidth="5" fill="none" />
      <Circle cx="1090" cy="420" r="28" fill="#E2573B" /><Circle cx="1130" cy="480" r="26" fill="#F2B13C" /><Circle cx="1070" cy="490" r="24" fill="#6CC27A" />
      <G>
        <Path d="M-20 80 Q120 80 220 150 L200 190 Q110 140 -20 150 Z" fill={SKIN[3]} />
        <Path d="M1220 560 Q1080 540 980 470 L1000 430 Q1090 480 1220 490 Z" fill={SKIN[0]} />
        <Path d="M580 630 Q590 560 640 520 L670 548 Q640 580 650 630 Z" fill={SKIN[5]} />
      </G>
    </G>
  );
}

function M3() { // child holding a bowl, close portrait
  return (
    <G>
      <Defs><Grad id="m3w" stops={[[0, '#FFD99A'], [1, '#F6A96B']]} /></Defs>
      <Rect width="1200" height="630" fill="url(#m3w)" />
      <Circle cx="860" cy="220" r="230" fill="#FFF0C4" opacity="0.55" />
      <Bokeh items={[[200, 140, 50, '#fff', 0.2], [360, 380, 36, '#fff', 0.18], [1020, 90, 40, '#fff', 0.25]]} />
      <G transform="translate(600 478) scale(0.6)">
        <Path d="M-250 0 Q-260 -200 -140 -250 Q0 -290 140 -250 Q260 -200 250 0 Z" fill="#4C8CD9" />
        <Rect x="-34" y="-300" width="68" height="70" rx="26" fill={SKIN[3]} />
        <Ellipse cx="0" cy="-390" rx="110" ry="124" fill={SKIN[3]} />
        <Circle cx="-70" cy="-476" r="36" fill={HAIR[2]} /><Circle cx="-20" cy="-504" r="42" fill={HAIR[2]} /><Circle cx="40" cy="-500" r="42" fill={HAIR[2]} /><Circle cx="86" cy="-466" r="36" fill={HAIR[2]} />
        <Ellipse cx="-114" cy="-388" rx="16" ry="26" fill={SKIN[3]} /><Ellipse cx="114" cy="-388" rx="16" ry="26" fill={SKIN[3]} />
        <Circle cx="-40" cy="-396" r="9" fill="#2A1A12" /><Circle cx="40" cy="-396" r="9" fill="#2A1A12" />
        <Circle cx="-37" cy="-399" r="3" fill="#fff" /><Circle cx="43" cy="-399" r="3" fill="#fff" />
        <Path d="M-46 -352 Q0 -308 46 -352 Q0 -334 -46 -352 Z" fill="#fff" stroke="#7A3B2A" strokeWidth="5" strokeLinejoin="round" />
        <Circle cx="-70" cy="-360" r="14" fill="#E07A5F" opacity="0.35" /><Circle cx="70" cy="-360" r="14" fill="#E07A5F" opacity="0.35" />
      </G>
      <Bowl x="600" y="372" s={1.1} />
      <Path d="M540 352 Q566 336 580 356 L580 376 H540 Z" fill={SKIN[3]} /><Path d="M660 352 Q634 336 620 356 L620 376 H660 Z" fill={SKIN[3]} />
    </G>
  );
}

function M4() { // community kitchen
  return (
    <G>
      <Defs><Grad id="m4w" stops={[[0, '#FFE9C9'], [1, '#FFD39A']]} /></Defs>
      <Rect width="1200" height="630" fill="url(#m4w)" />
      <Path d="M0 90 H1200" stroke="#E9B877" strokeWidth="6" />
      <G fill="#6BA7A0"><Path d="M80 60 L110 160 L50 160 Z" /><Path d="M300 40 L330 140 L270 140 Z" /><Path d="M900 40 L930 140 L870 140 Z" /><Path d="M1110 60 L1140 160 L1080 160 Z" /></G>
      <Rect y="430" width="1200" height="200" fill="#8E5A36" /><Rect y="430" width="1200" height="14" fill="#B67B4B" />
      <G transform="translate(600 440)">
        <Path d="M-48 -150 Q-64 -190 -44 -230 M0 -156 Q-18 -206 4 -250 M50 -150 Q34 -190 54 -226" stroke="#fff" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.75" />
        <Path d="M-170 -120 H170 Q176 20 100 30 H-100 Q-176 20 -170 -120 Z" fill="#8C8C94" />
        <Ellipse cx="0" cy="-120" rx="170" ry="26" fill="#6F6F78" /><Ellipse cx="0" cy="-122" rx="152" ry="18" fill="#E58A3C" />
        <Path d="M-176 -90 Q-210 -90 -210 -60 M176 -90 Q210 -90 210 -60" stroke="#6F6F78" strokeWidth="10" fill="none" strokeLinecap="round" />
      </G>
      <Person x="330" y="450" s={1.4} skin={3} hair={5} shirt="#E26B4F" style="wrap" arm={1} />
      <Person x="900" y="450" s={1.4} skin={0} hair={3} shirt="#3C8DD9" style="short" arm={1} />
      <Bowl x="120" y="520" s={0.8} steam={false} rim="#3E8F8A" /><Bowl x="210" y="535" s={0.8} steam={false} rim="#D9622B" />
      <Bowl x="1000" y="540" s={0.8} steam={false} rim="#C94F6B" /><Bowl x="1090" y="525" s={0.8} steam={false} rim="#D9A32B" />
    </G>
  );
}

function M5() { // lunch at a classroom desk
  return (
    <G>
      <Defs><Grad id="m5w" stops={[[0, '#D8ECD9'], [1, '#F2F7E6']]} /></Defs>
      <Rect width="1200" height="630" fill="url(#m5w)" />
      <Rect x="60" y="60" width="520" height="260" rx="10" fill="#2F5D50" stroke="#B88A55" strokeWidth="12" />
      <Path d="M100 120 H300 M100 170 H420 M100 220 H260" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity="0.75" />
      <Circle cx="470" cy="210" r="28" stroke="#F7DA5B" strokeWidth="6" fill="none" />
      <Rect x="800" y="70" width="280" height="190" rx="8" fill="#BDE3F5" /><Path d="M940 70 V260 M800 165 H1080" stroke="#fff" strokeWidth="9" />
      <Rect y="470" width="1200" height="160" fill="#B98A5A" />
      <Rect x="180" y="400" width="840" height="30" rx="8" fill="#D2A06A" /><Rect x="220" y="430" width="14" height="200" fill="#A57A4B" /><Rect x="966" y="430" width="14" height="200" fill="#A57A4B" />
      <Person x="480" y="430" s={1.45} skin={1} hair={0} shirt="#E2573B" style="long" arm={0} child />
      <Rect x="570" y="360" width="250" height="44" rx="10" fill="#fff" /><Rect x="580" y="368" width="230" height="30" rx="6" fill="#F6D9A8" />
      <Bowl x="660" y="370" s={0.8} rim="#3E8F8A" /><Circle cx="770" cy="378" r="22" fill="#E2573B" /><Circle cx="800" cy="384" r="18" fill="#F2B13C" />
    </G>
  );
}

export const TREE_SCENES = [T0, T1, T2, T3, T4, T5];
export const MEAL_SCENES = [M0, M1, M2, M3, M4, M5];
export const SCENE_COUNT = 6;

// How far each scene is lifted so its subject sits in the picture area above the text panel.
const LIFT = { tree: [-120, -90, -110, -110, -120, -110], meal: [-120, -110, -60, 0, -120, -120] };

export function Scene({ unit, variant = 0 }) {
  const list = unit === 'meal' ? MEAL_SCENES : TREE_SCENES;
  const i = ((variant % SCENE_COUNT) + SCENE_COUNT) % SCENE_COUNT;
  const C = list[i];
  return (
    <G transform={`translate(0 ${LIFT[unit === 'meal' ? 'meal' : 'tree'][i]})`}>
      <C />
    </G>
  );
}
