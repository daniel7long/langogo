// Langogo design tokens. Source: the Figma Make design system (warm orange, Nunito, soft shadows).
// The key names (colors.primary, spacing.md, typography.body, ...) are kept from the earlier theme,
// so every screen keeps working; new keys are added for the new design.
import { Platform } from 'react-native';

// ---- Palette ----------------------------------------------------------------------
const palette = {
  orange50: '#FFF8F1',
  orange100: '#FFF1E4',
  orange200: '#FBDCC0',
  orange500: '#F28C28',
  orange600: '#D95F0E',
  orange700: '#B84A08',
  ink: '#1F1B16',
  inkSoft: '#6B6259',
  inkFaint: '#9A9087',
  line: '#EADFD3',
  surface: '#FFFFFF',
  bg: '#FFFCF8',
  green: '#2E9E6B',
  greenBg: '#E6F4EC',
  greenText: '#18764D',
  teal: '#1F8FA3',
  tealBg: '#E5F6F8',
  amber: '#E8A317',
  amberBg: '#FDF1D3',
  coral: '#E5675A',
  coralBg: '#FCE9E6',
};

// ---- Semantic colors -----------------------------------------------------------------
export const colors = {
  // actions
  primary: palette.orange600,
  primaryPressed: '#BF520A',
  primarySoft: palette.orange500,
  onPrimary: palette.surface,
  accentText: palette.orange600,
  secondaryBg: palette.surface,
  secondaryText: palette.orange600,
  primaryDisabled: '#F2B98F',

  // text and surfaces
  text: palette.ink,
  textMuted: palette.inkSoft,
  textFaint: palette.inkFaint,
  surface: palette.surface,
  bg: palette.bg,
  page: '#F7F0E9', // behind the phone-width column on wide screens
  card: '#F7F1EA', // quiet grey-beige panel
  tint: palette.orange50,
  selectedBg: palette.orange100,
  orange200: palette.orange200,
  highlight: palette.amberBg,
  border: '#E3D8CC',
  divider: palette.line,
  line: palette.line,

  // states
  lessonCompleted: palette.green,
  lessonCurrent: palette.orange600,
  lessonLocked: '#A39A91',
  brandGreen: palette.green,
  green100: palette.greenBg,
  greenText: palette.greenText,
  teal: palette.teal,
  tealBg: palette.tealBg,
  amber: palette.amber,
  amberBg: palette.amberBg,
  coral: palette.coral,
  coralBg: palette.coralBg,
  error: '#C8473C',
  overlay: 'rgba(31,27,22,0.32)',
};

// ---- Spacing (4px grid) ----------------------------------------------------------------
export const spacing = {
  xs: 4,
  sm: 8,
  s12: 12,
  md: 16,
  s20: 20,
  lg: 24,
  xl: 32,
  s36: 36,
  xxl: 48,
  xxxl: 56,
};

// ---- Radius ----------------------------------------------------------------------------
export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  full: 999,
  pill: 999,
};

// ---- Sizes -----------------------------------------------------------------------------
export const sizes = {
  buttonHeight: 54,
  icon: 20,
  avatar: 40,
  tap: 48,
};

// ---- Fonts: Nunito, one file per weight (loaded in src/app/_layout.tsx) ---------------------
export const fontFamily = {
  regular: 'Nunito_400Regular',
  semiBold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
};

const text = (family, fontSize, lineHeight, extra) => ({ fontFamily: family, fontSize, lineHeight, ...extra });

export const typography = {
  display: text(fontFamily.extraBold, 28, 34),
  headline: text(fontFamily.extraBold, 24, 30),
  title: text(fontFamily.bold, 20, 26),
  body: text(fontFamily.regular, 15, 22),
  bodyStrong: text(fontFamily.bold, 15, 22),
  label: text(fontFamily.bold, 16, 20),
  labelSm: text(fontFamily.bold, 13, 18),
  caption: text(fontFamily.semiBold, 12, 16),
  button: text(fontFamily.extraBold, 16, 22),
  eyebrow: text(fontFamily.extraBold, 11, 14, { letterSpacing: 0.9, textTransform: 'uppercase' }),
  foreign: text(fontFamily.bold, 22, 30), // words and sentences in the language being learned
  score: text(fontFamily.extraBold, 64, 68),
  level: text(fontFamily.regular, 32, 36),
};

// ---- Soft shadows (warm tint) -------------------------------------------------------------
export function shadow(y = 4, blur = 16, opacity = 0.08, rgb = '217, 95, 14') {
  if (Platform.OS === 'web') return { boxShadow: `0 ${y}px ${blur}px rgba(${rgb}, ${opacity})` };
  return {
    shadowColor: `rgb(${rgb})`,
    shadowOpacity: opacity,
    shadowRadius: blur / 2,
    shadowOffset: { width: 0, height: y },
    elevation: Math.max(1, Math.round(blur / 5)),
  };
}
export const shadows = {
  card: () => shadow(4, 16, 0.08),
  lift: () => shadow(8, 28, 0.14),
  button: () => shadow(4, 14, 0.2),
};
