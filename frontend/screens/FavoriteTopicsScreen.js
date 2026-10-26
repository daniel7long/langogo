import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getFavoriteChoices, saveFavorites } from '../api/app';
import AsyncState from '../components/AsyncState';
import Logo from '../components/Logo';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TopicArt from '../components/TopicArt';
import useAsync from '../hooks/useAsync';
import { notify } from '../utils/dialog';
import { colors, radius, spacing, typography } from '../theme';

// F1S5: pick favorite topics.
export default function FavoriteTopicsScreen() {
  const state = useAsync(getFavoriteChoices, []);
  return (
    <Screen>
      <AsyncState state={state}>{(topics) => <Picker topics={topics} />}</AsyncState>
    </Screen>
  );
}

function Picker({ topics }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => topics.filter((t) => t.selected).map((t) => t.id));
  const [saving, setSaving] = useState(false);

  const toggle = (id) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async () => {
    setSaving(true);
    try {
      await saveFavorites(selected);
      router.replace('/courses');
    } catch (e) {
      notify("Couldn't save your topics", e.message);
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.header}>
        <Logo width={160} />
        <Text style={styles.title} accessibilityRole="header">My Favorite Topics</Text>
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {topics.map((t) => {
          const on = selected.includes(t.id);
          return (
            <Pressable
              key={t.id}
              onPress={() => toggle(t.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t.name}
              style={[styles.tile, on && styles.tileOn]}
            >
              <TopicArt topicId={t.id} width="100%" height={110} rounded={radius.md - 2} />
              <Text style={styles.name}>{t.name}</Text>
              {on && (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label="Liste des leçons" onPress={submit} disabled={selected.length === 0} loading={saving} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
  title: { ...typography.display, color: colors.text, marginTop: spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.s12,
    padding: spacing.lg,
  },
  tile: {
    flexBasis: '48%',
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: 'transparent',
    padding: 2,
  },
  tileOn: { borderColor: colors.primary },
  name: { ...typography.label, color: colors.text, textAlign: 'center', marginTop: spacing.xs },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
