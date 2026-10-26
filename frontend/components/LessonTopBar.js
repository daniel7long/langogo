import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import IconButton from './IconButton';
import ProgressBar from './ProgressBar';
import { confirm } from '../utils/dialog';
import { colors, radius, spacing, typography } from '../theme';

// Close button, lesson progress bar and the flowers you can earn (the lesson screens).
// Without `reward` it shows only the close button and the optional `right` element (the result screen).
export default function LessonTopBar({ progress = 0, reward, onClose, right, confirmClose }) {
  // Leaving in the middle of a lesson (the screens with a progress bar) asks first;
  // the result screen (no bar) closes directly.
  const ask = confirmClose ?? reward != null;
  const handleClose = async () => {
    if (!ask) return onClose?.();
    const leave = await confirm('Leave this lesson?', "Your progress in this lesson won't be saved.", 'Leave', 'Stay');
    if (leave) onClose?.();
  };
  return (
    <View style={styles.bar}>
      <IconButton name="close" label="Close" onPress={handleClose} />
      {reward != null ? (
        <>
          <ProgressBar progress={progress} style={styles.progress} />
          <View style={styles.reward} accessibilityLabel={`${reward} flowers to earn`}>
            <Ionicons name="flower-outline" size={16} color={colors.primary} />
            <Text style={styles.rewardText}>{reward}</Text>
          </View>
        </>
      ) : (
        <View style={styles.spacer} />
      )}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, height: 64, paddingHorizontal: spacing.md },
  progress: { flex: 1 },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.s12,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.selectedBg,
  },
  rewardText: { ...typography.labelSm, color: colors.primary },
  spacer: { flex: 1 },
});
