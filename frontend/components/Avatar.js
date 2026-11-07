import { Image, StyleSheet, Text, View } from 'react-native';

import { photoUri } from '../api/app';
import { colors, typography } from '../theme';

// A round profile picture, or the first letter of the name when there is no picture.
export default function Avatar({ name = '', photoUrl, size = 72 }) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (photoUrl) {
    return <Image source={{ uri: photoUri(photoUrl) }} style={[styles.img, box]} accessibilityLabel="Profile picture" />;
  }
  return (
    <View style={[styles.fallback, box]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.card },
  fallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  letter: { ...typography.display, color: colors.onPrimary },
});
