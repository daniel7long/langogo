import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  cancelSubscription,
  deleteAccount,
  deleteRecordings,
  getMe,
  getPlans,
  resetDemo,
  resetLanguage,
  saveConsent,
  saveName,
  subscribe,
} from '../api/app';
import { signOut } from '../api/auth';
import AsyncState from '../components/AsyncState';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import SecondaryButton from '../components/SecondaryButton';
import TopBar from '../components/TopBar';
import useAsync from '../hooks/useAsync';
import useSettings from '../hooks/useSettings';
import { confirm, notify } from '../utils/dialog';
import { colors, radius, spacing, typography } from '../theme';

const TITLES = { learning: 'Settings', account: 'Account', billing: 'Billings', privacy: 'Privacy' };

// F3S1 settings menu: Account, Billings and Privacy. (Log out is handled on the Profile screen.)
export default function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const raw = Array.isArray(params.section) ? params.section[0] : params.section;
  const section = TITLES[raw] ? raw : 'learning';

  const state = useAsync(async () => {
    const [me, plans] = await Promise.all([getMe(), getPlans()]);
    return { me, plans };
  }, []);

  return (
    <Screen>
      <TopBar title={TITLES[section]} />
      <AsyncState state={state} onBack={() => router.back()}>
        {({ me, plans }) => (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {section === 'learning' && <Learning me={me} reload={state.reload} />}
            {section === 'account' && <Account me={me} reload={state.reload} />}
            {section === 'billing' && <Billing me={me} plans={plans} reload={state.reload} />}
            {section === 'privacy' && <Privacy me={me} reload={state.reload} />}
          </ScrollView>
        )}
      </AsyncState>
    </Screen>
  );
}

// Learning preferences (saved on the server) and the places the old menu led to.
function Learning({ me, reload }) {
  const router = useRouter();
  const { settings, update } = useSettings();

  const reset = async () => {
    const ok = await confirm(
      `Reset ${me.language_name} progress`,
      `This clears your ${me.language_name} lessons, records and level, and starts you at Level 1. Your flowers and other languages stay.`,
      'Reset'
    );
    if (!ok) return;
    try {
      await resetLanguage();
      notify('Done', `${me.language_name} was reset to Level 1.`);
      reload();
    } catch (e) {
      notify("Couldn't reset", e.message);
    }
  };

  return (
    <>
      <Text style={styles.eyebrow}>LEARNING</Text>
      <View style={styles.card}>
        <Row label="Language" value={`${me.language_name} · ${me.native}`} />
        <SecondaryButton label="Change language" onPress={() => router.push({ pathname: '/language', params: { change: '1' } })} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Speech speed</Text>
        <Text style={styles.note}>How fast the other person in a dialogue speaks.</Text>
        <View style={styles.segment}>
          {[['slow', 'Slow'], ['normal', 'Normal']].map(([id, label]) => {
            const on = settings.speech_speed === id;
            return (
              <Pressable
                key={id}
                onPress={() => update({ speech_speed: id })}
                style={[styles.seg, on && styles.segOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <ToggleRow
          label="Show translations by default"
          note="Show the English line under each message."
          value={settings.show_translation}
          onChange={(v) => update({ show_translation: v })}
        />
        <ToggleRow
          label="Celebration effects"
          note="Confetti when you get an A or A+."
          value={settings.effects}
          onChange={(v) => update({ effects: v })}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Start this language over</Text>
        <Text style={styles.note}>Clear your {me.language_name} progress and records.</Text>
        <SecondaryButton label={`Reset ${me.language_name} progress`} onPress={reset} />
      </View>

      <Text style={styles.eyebrow}>ACCOUNT</Text>
      <View style={styles.card}>
        {[['account', 'Account', 'person-outline'], ['billing', 'Billings', 'card-outline'], ['privacy', 'Privacy', 'lock-closed-outline']].map(([id, label, icon]) => (
          <Pressable key={id} onPress={() => router.push({ pathname: '/settings', params: { section: id } })} style={styles.link} accessibilityRole="button">
            <Ionicons name={icon} size={20} color={colors.primary} />
            <Text style={styles.linkText}>{label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.eyebrow}>ABOUT</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Langogo</Text>
        <Text style={styles.note}>A low-anxiety place to practise speaking. Take your time, and retry as often as you like.</Text>
      </View>
    </>
  );
}

function ToggleRow({ label, note, value, onChange }) {
  return (
    <View style={styles.toggle}>
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
      <Switch
        value={!!value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Account({ me, reload }) {
  const router = useRouter();
  const [name, setName] = useState(me.name);
  const [busy, setBusy] = useState(false);
  const changed = name.trim() !== '' && name.trim() !== me.name;

  const save = async () => {
    setBusy(true);
    try {
      await saveName(name.trim());
      notify('Saved', 'Your name was updated.');
      reload();
    } catch (e) {
      notify("Couldn't save", e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    const ok = await confirm(
      'Delete your account?',
      'Your progress, records, notes and voice recordings will be deleted for good. This cannot be undone.',
      'Delete account'
    );
    if (!ok) return;
    try {
      await deleteAccount();
      await signOut();
    } catch (e) {
      notify("Couldn't delete your account", e.message);
    }
  };

  const reset = async () => {
    const ok = await confirm(
      'Reset demo data',
      'This sets your flowers, progress, records and Vocab Notes back to the starting demo values.',
      'Reset'
    );
    if (!ok) return;
    try {
      await resetDemo();
      notify('Done', 'The demo data was reset.');
      reload();
    } catch (e) {
      notify("Couldn't reset", e.message);
    }
  };

  return (
    <>
      {me.accounts && (
        <View style={styles.card}>
          <Row label="Signed in as" value={me.email ?? ''} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.note}>This is the name other learners see on the leaderboard.</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={30}
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Name"
        />
        <PrimaryButton label="Save" onPress={save} disabled={!changed} loading={busy} />
      </View>

      <View style={styles.card}>
        <Row label="Language" value={me.language_name} />
        <SecondaryButton label="Change language" onPress={() => router.push({ pathname: '/language', params: { change: '1' } })} />
      </View>

      <View style={styles.card}>
        <Row label="Level" value={`L${me.level}`} />
        <Row label="Streak" value={`${me.streak} days`} />
        <Row label="Flowers" value={me.flowers} />
      </View>

      {me.accounts ? (
        <View style={styles.card}>
          <SecondaryButton label="Sign out" icon="log-out-outline" onPress={() => signOut()} />
          <SecondaryButton label="Delete my account" icon="trash-outline" onPress={removeAccount} />
          <Text style={styles.note}>Deleting removes your progress, records and voice recordings for good.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Demo data</Text>
          <Text style={styles.note}>While Langogo runs without accounts, you can start over at any time.</Text>
          <SecondaryButton label="Reset demo data" onPress={reset} />
        </View>
      )}
    </>
  );
}

function Billing({ me, plans, reload }) {
  const [plan, setPlan] = useState('yearly');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    const chosen = plans.find((p) => p.id === plan);
    const ok = await confirm('Go Unlimited', `Demo only: no payment is taken. Switch to the ${chosen.label} plan?`, 'Continue');
    if (!ok) return;
    setBusy(true);
    try {
      await subscribe(plan);
      reload();
    } catch (e) {
      notify("Couldn't update your plan", e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const ok = await confirm('Cancel plan', 'Switch back to the free plan?', 'Cancel plan');
    if (!ok) return;
    try {
      await cancelSubscription();
      reload();
    } catch (e) {
      notify("Couldn't cancel", e.message);
    }
  };

  const current = plans.find((p) => p.id === me.plan);

  if (me.unlimited) {
    return (
      <View style={styles.card}>
        <Ionicons name="infinite-outline" size={32} color={colors.primary} />
        <Text style={styles.big}>Langogo Unlimited</Text>
        <Text style={styles.note}>
          {current ? `${current.label} plan` : 'Active'} · every topic is unlocked.
        </Text>
        <SecondaryButton label="Cancel plan" onPress={cancel} />
        <Text style={styles.note}>Demo only: nothing is billed.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.big}>Free plan</Text>
      <Text style={styles.note}>Go Unlimited to unlock 5000+ topics.</Text>
      <View style={styles.plans}>
        {plans.map((p) => {
          const on = plan === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPlan(p.id)}
              style={[styles.plan, on && styles.planOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={colors.primary} />
              <Text style={styles.planLabel}>{p.label}</Text>
              {p.note ? <Text style={styles.planNote}>({p.note})</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <PrimaryButton label="Go Unlimited" onPress={go} loading={busy} />
      <Text style={styles.note}>Demo only: no payment is taken.</Text>
    </View>
  );
}

function Privacy({ me, reload }) {
  const [busy, setBusy] = useState(false);
  const [research, setResearch] = useState(!!me.research_consent);

  const toggleResearch = async (value) => {
    setResearch(value);
    try {
      await saveConsent(value);
      reload();
    } catch (e) {
      setResearch(!value);
      notify("Couldn't save", e.message);
    }
  };

  const wipe = async () => {
    const ok = await confirm('Delete recordings', 'Delete every voice recording Langogo has saved? This cannot be undone.', 'Delete');
    if (!ok) return;
    setBusy(true);
    try {
      const r = await deleteRecordings();
      notify('Done', r.deleted === 0 ? 'There were no recordings to delete.' : `${r.deleted} recording${r.deleted === 1 ? '' : 's'} deleted.`);
    } catch (e) {
      notify("Couldn't delete", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.label}>What Langogo keeps</Text>
        <Text style={styles.note}>
          Your progress, scores and saved words, and the voice recordings you make while practicing speaking.
          Recordings are used to score your pronunciation.
        </Text>
      </View>
      <View style={styles.card}>
        <ToggleRow
          label="Help research"
          note="Let researchers use how you speak (speed, pauses, scores), stored without your name or email, to study how people learn to speak. Turning this off stops new data and removes what is stored with your account."
          value={research}
          onChange={toggleResearch}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Your voice recordings</Text>
        <Text style={styles.note}>Delete all the recordings saved so far. Your scores and records stay.</Text>
        <SecondaryButton label="Delete my recordings" onPress={wipe} disabled={busy} />
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Microphone</Text>
        <Text style={styles.note}>
          To turn microphone access off or on, use your browser's site settings (the lock icon next to the address)
          or your phone's app settings.
        </Text>
      </View>
    </>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.full, padding: 4, borderWidth: 1, borderColor: colors.line },
  seg: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.full },
  segOn: { backgroundColor: colors.primary },
  segText: { ...typography.label, color: colors.textMuted },
  segTextOn: { color: colors.onPrimary },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, paddingVertical: spacing.sm },
  linkText: { ...typography.label, color: colors.text, flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md, gap: spacing.s12 },
  label: { ...typography.label, color: colors.text },
  big: { ...typography.title, color: colors.text },
  note: { ...typography.body, color: colors.textMuted },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { ...typography.body, color: colors.textMuted },
  rowValue: { ...typography.label, color: colors.text },
  plans: { gap: spacing.sm },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.s12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planOn: { borderColor: colors.primary, backgroundColor: colors.selectedBg },
  planLabel: { ...typography.label, color: colors.text },
  planNote: { ...typography.labelSm, color: colors.accentText },
});
