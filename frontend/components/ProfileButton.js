import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { goHub } from '../utils/nav';
import { colors } from '../theme';

// Person icon that jumps to the Profile screen. If Profile is already in the history, the screens above
// it are closed instead of stacking another copy.
export default function ProfileButton({ color = colors.text }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => goHub(router, '/profile')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Profile">
      <Ionicons name="person-circle-outline" size={28} color={color} />
    </Pressable>
  );
}
