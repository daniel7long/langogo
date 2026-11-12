import { Image, StyleSheet, View } from 'react-native';

import Text from './AppText';

import { photoUri } from '../api/app';
import { FrameArt, OutfitArt } from './GiftArt';
import { colors, typography } from '../theme';

const ABS = { position: 'absolute', left: 0, top: 0 };

// A round profile picture, or the first letter of the name when there is no picture.
// `equipped` = { outfit, frame } from the Gift Menu: the picture is drawn a little smaller so the frame and outfit fit around it.
export default function Avatar({ name = '', photoUrl, size = 72, equipped }) {
  const dress = equipped?.outfit || equipped?.frame;
  const inner = dress ? size * 0.76 : size;
  const box = { width: inner, height: inner, borderRadius: inner / 2 };
  const picture = photoUrl ? (
    <Image source={{ uri: photoUri(photoUrl) }} style={[styles.img, box]} accessibilityLabel="Profile picture" />
  ) : (
    <View style={[styles.fallback, box]}>
      <Text style={[styles.letter, { fontSize: inner * 0.42 }]}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
  if (!dress) return picture;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {picture}
      {equipped.frame ? <FrameArt id={equipped.frame} size={size} style={ABS} /> : null}
      {equipped.outfit ? <OutfitArt id={equipped.outfit} size={size} style={ABS} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.card },
  fallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  letter: { ...typography.display, color: colors.onPrimary },
});
