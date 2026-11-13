import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';

import Text from './AppText';
import { Ionicons } from '@expo/vector-icons';

import { getGiftShare } from '../api/app';
import IconButton from './IconButton';
import SecondaryButton from './SecondaryButton';
import { notify } from '../utils/dialog';
import { copyCaption, shareTo } from '../utils/share';
import { SHARE_TARGETS } from '../utils/shareLinks';
import { colors, radius, shadows, spacing, typography } from '../theme';

// Shown right after a learner plants a tree or donates a meal: a thank-you, the poster, and buttons to share it on
// Facebook, Instagram, LinkedIn or X (the same buttons as "Share my result"). `gift` = { id, unit, message }.
export default function GiftShareSheet({ gift, onClose }) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const visible = !!gift;

  useEffect(() => {
    if (!gift) return undefined;
    let live = true;
    setPayload(null);
    setError(null);
    getGiftShare(gift.id)
      .then((p) => live && setPayload(p))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [gift]);

  const pick = (target) => {
    if (!payload) return;
    const pending = shareTo(target, payload); // starts synchronously (needed by the browser)
    pending.then((r) => {
      if (r && r.message) notify('Share', r.message);
    });
  };

  const copy = async () => {
    if (!payload) return;
    const r = await copyCaption(payload);
    if (r.message) notify(r.ok ? 'Copied' : 'Share', r.message);
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>Thank you!</Text>
              <Text style={styles.title} accessibilityRole="header">Share your good news</Text>
            </View>
            <IconButton name="close" label="Close" onPress={onClose} />
          </View>
          {!!gift?.message && <Text style={styles.message}>{gift.message}</Text>}

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : !payload ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : (
            <>
              <Image source={{ uri: payload.image }} style={styles.poster} resizeMode="cover" accessibilityLabel="Your sharing poster" />
              <View style={styles.targets}>
                {SHARE_TARGETS.map((t) => (
                  <Pressable key={t.id} onPress={() => pick(t.id)} style={styles.target} accessibilityRole="button" accessibilityLabel={`Share on ${t.label}`}>
                    <View style={styles.targetIcon}>
                      <Ionicons name={t.icon} size={26} color={t.color} />
                    </View>
                    <Text style={styles.label}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
              <SecondaryButton label="Copy text" icon="copy-outline" onPress={copy} />
              <Pressable onPress={() => Linking.openURL(payload.image).catch(() => {})} accessibilityRole="link" hitSlop={8}>
                <Text style={styles.link}>Open the poster to save it (for Instagram stories and posts)</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 480,
    padding: spacing.lg,
    paddingTop: spacing.s12,
    gap: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.bg,
    ...shadows.lift(),
  },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#DED4CB' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12 },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  title: { ...typography.headline, color: colors.text },
  message: { ...typography.body, color: colors.textMuted },
  poster: { width: '100%', aspectRatio: 1200 / 630, borderRadius: radius.lg, backgroundColor: colors.card },
  targets: { flexDirection: 'row', justifyContent: 'space-around' },
  target: { alignItems: 'center', gap: 6, minWidth: 68 },
  targetIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, ...shadows.card() },
  label: { ...typography.caption, color: colors.text },
  link: { ...typography.caption, color: colors.primary, textAlign: 'center' },
  loading: { marginVertical: spacing.lg },
  error: { ...typography.body, color: colors.error, textAlign: 'center' },
});
