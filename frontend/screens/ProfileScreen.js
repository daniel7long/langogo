import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import Text from '../components/AppText';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getMe, getNotes, getRecords, getTopics, removePhoto, uploadPhoto } from '../api/app';
import Avatar from '../components/Avatar';
import AsyncState from '../components/AsyncState';
import PrimaryButton from '../components/PrimaryButton';
import RecordRow from '../components/RecordRow';
import Screen from '../components/Screen';
import SettingsMenu from '../components/SettingsMenu';
import TopBar from '../components/TopBar';
import TopicCard from '../components/TopicCard';
import useAsync from '../hooks/useAsync';
import { confirm, notify } from '../utils/dialog';
import { goHub } from '../utils/nav';
import { colors, radius, spacing, typography } from '../theme';

// F3S1: profile, topics to unlock, recent speaking records.
export default function ProfileScreen() {
  const state = useAsync(async () => {
    const [me, topics, records, notes] = await Promise.all([getMe(), getTopics(), getRecords(2), getNotes()]);
    return { me, topics, records, notes: notes.summary };
  }, []);

  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const onSelect = async (id) => {
    if (id === 'logout') {
      const ok = await confirm('Log out', 'Log out of Langogo on this device?', 'Log out');
      if (ok) router.replace('/');
      return;
    }
    router.push({ pathname: '/settings', params: { section: id } });
  };

  return (
    <Screen>
      <TopBar
        title="Profile"
        right={
          <Pressable onPress={() => setMenuOpen((o) => !o)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Settings" accessibilityState={{ expanded: menuOpen }}>
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        }
      />
      <AsyncState state={state}>{(data) => <ProfileView {...data} />}</AsyncState>
      <SettingsMenu visible={menuOpen} onClose={() => setMenuOpen(false)} onSelect={onSelect} top={56} />
    </Screen>
  );
}

function Stat({ icon, label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Ionicons name={icon} size={28} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ProfileView({ me, topics, records, notes }) {
  const router = useRouter();
  const toUnlock = topics.filter((t) => t.cost > 0 && !t.unlocked);
  const [photoUrl, setPhotoUrl] = useState(me.photo_url || null);
  const [busy, setBusy] = useState(false);

  const send = async (result) => {
    if (result.canceled || !result.assets?.length) return;
    setBusy(true);
    try {
      const res = await uploadPhoto(result.assets[0]);
      setPhotoUrl(res.photo_url);
    } catch (e) {
      notify('Could not save the picture', e.message);
    } finally {
      setBusy(false);
    }
  };
  const options = { allowsEditing: true, aspect: [1, 1], quality: 0.5 };
  const choosePhoto = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return notify('Photos are off', 'Allow Langogo to use your photos in your phone settings to choose a picture.');
    }
    send(await ImagePicker.launchImageLibraryAsync(options));
  };
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return notify('Camera is off', 'Allow Langogo to use the camera in your phone settings to take a picture.');
    send(await ImagePicker.launchCameraAsync(options));
  };
  const clearPhoto = async () => {
    if (!(await confirm('Remove picture', 'Remove your profile picture?', 'Remove'))) return;
    setBusy(true);
    try {
      await removePhoto();
      setPhotoUrl(null);
    } catch (e) {
      notify('Could not remove the picture', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <View style={styles.identity}>
        <Pressable onPress={choosePhoto} disabled={busy} accessibilityRole="button" accessibilityLabel="Change profile picture" style={styles.avatarWrap}>
          <Avatar name={me.name} photoUrl={photoUrl} size={88} />
          <View style={styles.camera}>
            <Ionicons name="camera" size={14} color={colors.onPrimary} />
          </View>
        </Pressable>
        <Text style={styles.name}>{me.name}</Text>
        <View style={styles.photoLinks}>
          <Pressable onPress={choosePhoto} disabled={busy} accessibilityRole="button">
            <Text style={styles.link}>{busy ? 'Saving…' : photoUrl ? 'Change photo' : 'Add photo'}</Text>
          </Pressable>
          {Platform.OS !== 'web' && (
            <Pressable onPress={takePhoto} disabled={busy} accessibilityRole="button">
              <Text style={styles.link}>Take photo</Text>
            </Pressable>
          )}
          {photoUrl && (
            <Pressable onPress={clearPhoto} disabled={busy} accessibilityRole="button">
              <Text style={styles.link}>Remove</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.stats}>
        <Stat icon="flame" label="Streak" value={me.streak} />
        <Stat icon="ribbon-outline" label="Level" value={`L${me.level}`} />
        <Stat icon="flower-outline" label="Flowers" value={me.flowers} />
      </View>

      <Pressable onPress={() => router.push('/vocab-notes')} style={styles.notesRow} accessibilityRole="button">
        <Ionicons name="bookmarks-outline" size={22} color={colors.accentText} />
        <View style={styles.notesText}>
          <Text style={styles.section}>Vocab Notes</Text>
          <Text style={styles.notesSub}>
            {notes.total === 0
              ? 'Save words from the flashcards'
              : `${notes.total} word${notes.total === 1 ? '' : 's'}${notes.due ? ` · ${notes.due} due for review` : ''}`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <View style={styles.sectionHead}>
        <Text style={styles.section}>Unlock topics</Text>
        <Pressable onPress={() => router.push('/unlock-topics')} accessibilityRole="button">
          <Text style={styles.link}>Explore all ›</Text>
        </Pressable>
      </View>
      {toUnlock.length === 0 ? (
        <Text style={styles.empty}>All topics unlocked.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics}>
          {toUnlock.map((t) => (
            <TopicCard
              key={t.id}
              topic={t}
              width={150}
              onPress={() => router.push({ pathname: '/topic', params: { id: t.id } })}
              onUnlock={() => router.push('/unlock-topics')}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.section}>Speaking Records</Text>
        <Pressable onPress={() => router.push('/lesson-records')} accessibilityRole="button">
          <Text style={styles.link}>All ›</Text>
        </Pressable>
      </View>
      <View style={styles.records}>
        {records.map((r) => (
          <RecordRow key={r.id} record={r} onPress={() => router.push({ pathname: '/retry', params: { id: r.id } })} />
        ))}
      </View>
    </ScrollView>
    <View style={styles.footer}>
      <PrimaryButton label="Liste des leçons" onPress={() => goHub(router, '/courses')} />
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  flex: { flex: 1 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm },
  notesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, backgroundColor: colors.selectedBg, borderRadius: radius.lg, padding: spacing.md },
  notesText: { flex: 1 },
  notesSub: { ...typography.caption, color: colors.textMuted },
  scroll: { padding: spacing.md, gap: spacing.md },
  identity: { alignItems: 'center', gap: spacing.sm },
  avatarWrap: { width: 88, height: 88 },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card },
  photoLinks: { flexDirection: 'row', gap: spacing.md },
  name: { ...typography.title, color: colors.text },
  stats: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: spacing.s12 },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xs },
  statLabel: { ...typography.caption, color: colors.textMuted },
  statValue: { ...typography.label, color: colors.text },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  section: { ...typography.label, color: colors.text },
  link: { ...typography.labelSm, color: colors.accentText },
  topics: { gap: spacing.s12 },
  empty: { ...typography.body, color: colors.textMuted },
  records: { gap: spacing.s12 },
});
