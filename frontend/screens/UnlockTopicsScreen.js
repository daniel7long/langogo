import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getPlans, getTopics, subscribe, unlockTopic } from '../api/app';
import AsyncState from '../components/AsyncState';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TopBar from '../components/TopBar';
import TopicCard from '../components/TopicCard';
import useAsync from '../hooks/useAsync';
import { confirm, notify } from '../utils/dialog';
import { colors, radius, spacing, typography } from '../theme';

// F3S2: spend flowers on a topic, or go unlimited.
export default function UnlockTopicsScreen() {
  const state = useAsync(async () => {
    const [topics, plans] = await Promise.all([getTopics(), getPlans()]);
    return { topics: topics.filter((t) => t.cost > 0), plans };
  }, []);

  return (
    <Screen>
      <TopBar title="Unlock Topics" profile />
      <AsyncState state={state}>
        {({ topics, plans }) => <UnlockView topics={topics} plans={plans} reload={state.reload} />}
      </AsyncState>
    </Screen>
  );
}

function UnlockView({ topics, plans, reload }) {
  const router = useRouter();
  const [plan, setPlan] = useState('yearly');
  const [busy, setBusy] = useState(false);

  const unlock = async (topic) => {
    const ok = await confirm('Unlock topic', `Spend ${topic.cost} flowers to unlock ${topic.name}?`, 'Unlock');
    if (!ok) return;
    try {
      await unlockTopic(topic.id);
      reload();
    } catch (e) {
      notify("Couldn't unlock", e.message);
    }
  };

  const goUnlimited = async () => {
    const chosen = plans.find((p) => p.id === plan);
    const ok = await confirm(
      'Go Unlimited',
      `Demo only: no payment is taken. Switch to the ${chosen.label} plan?`,
      'Continue'
    );
    if (!ok) return;
    setBusy(true);
    try {
      await subscribe(plan);
      notify('You are unlimited', 'Every topic is now unlocked.');
      reload();
    } catch (e) {
      notify("Couldn't subscribe", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.grid}>
        {topics.map((t) => (
          <View key={t.id} style={styles.cell}>
            <TopicCard
              topic={t}
              onPress={() => router.push({ pathname: '/topic', params: { id: t.id } })}
              onUnlock={() => unlock(t)}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.panel}>
        <Text style={styles.pitch}>Unlock 5000+ topics</Text>
        <View style={styles.plans}>
          {plans.map((p) => {
            const on = plan === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlan(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={styles.plan}
              >
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={colors.primary} />
                <Text style={styles.planLabel}>{p.label}</Text>
                {p.note ? <Text style={styles.planNote}>({p.note})</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <PrimaryButton label="Go Unlimited" onPress={goUnlimited} loading={busy} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.s12,
    padding: spacing.md,
  },
  cell: { flexBasis: '48%' },
  panel: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    padding: spacing.lg,
    gap: spacing.s12,
  },
  pitch: { ...typography.title, color: colors.text, textAlign: 'center' },
  plans: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.md },
  plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  planLabel: { ...typography.label, color: colors.text },
  planNote: { ...typography.labelSm, color: colors.accentText },
});
