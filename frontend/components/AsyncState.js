import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import PrimaryButton from './PrimaryButton';
import { colors, radius, shadows, spacing, typography } from '../theme';

// Shows a loading placeholder, a calm error card with a retry button, or the screen
// (children is a function of the data). `skeleton` is an optional element shown while loading.
export default function AsyncState({ state, children, onBack, skeleton }) {
  if (state.loading && !state.data) {
    if (skeleton) return skeleton;
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!state.data) {
    const offline = state.error && state.error.status === 0;
    return (
      <View style={styles.center}>
        <View style={styles.card}>
          <View style={[styles.icon, offline && styles.iconOffline]}>
            <Ionicons name={offline ? 'cloud-offline-outline' : 'leaf-outline'} size={24} color={offline ? colors.teal : colors.primary} />
          </View>
          <Text style={[styles.eyebrow, offline && { color: colors.teal }]}>{offline ? 'Connection' : 'Just a moment'}</Text>
          <Text style={styles.title}>{offline ? 'No internet connection' : "That didn't load"}</Text>
          <Text style={styles.text}>
            {offline
              ? "We can't reach the Langogo server. Check that the backend is running, then try again. Your progress is safe."
              : state.error ? state.error.message : 'Something went wrong. Please try again.'}
          </Text>
          <View style={styles.actions}>
            <PrimaryButton label={offline ? 'Check again' : 'Try again'} icon="refresh" onPress={state.reload} />
            {onBack && (
              <Pressable onPress={onBack} style={styles.link}>
                <Text style={styles.linkText}>Go back</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }
  return children(state.data);
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { alignSelf: 'stretch', padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, ...shadows.card() },
  icon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.selectedBg, marginBottom: spacing.s12 },
  iconOffline: { backgroundColor: colors.tealBg },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  title: { ...typography.title, color: colors.text, marginTop: 2 },
  text: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  actions: { marginTop: spacing.md, gap: spacing.sm },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
  linkText: { ...typography.label, color: colors.primary },
});
