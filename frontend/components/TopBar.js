import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import IconButton from './IconButton';
import { colors, spacing, typography } from '../theme';

// Round back button + centered title + optional right-hand element.
// (`profile` is kept for old screens; it now shows nothing: the menu on Courses leads everywhere.)
export default function TopBar({ title, right, showBack = true, onBack }) {
  const router = useRouter();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/courses')));

  return (
    <View style={styles.bar}>
      <View style={styles.side}>{showBack && <IconButton name="arrow-back" label="Back" onPress={goBack} />}</View>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: spacing.md },
  side: { width: 56 },
  right: { alignItems: 'flex-end' },
  title: { ...typography.title, color: colors.text, flex: 1, textAlign: 'center' },
});
