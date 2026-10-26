import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getSharePayload } from '../api/app';
import Chip from './Chip';
import Flag from './Flag';
import IconButton from './IconButton';
import SecondaryButton from './SecondaryButton';
import { notify } from '../utils/dialog';
import { gradeColors } from '../utils/score';
import { copyCaption, shareTo } from '../utils/share';
import { SHARE_TARGETS } from '../utils/shareLinks';
import { colors, radius, shadows, spacing, typography } from '../theme';

// The "Share your result" bottom sheet. It shows the result card, loads the share text and link for
// the record, then the buttons open Facebook, Instagram, LinkedIn or X, or copy the caption.
// `record` is optional: with it the card shows the grade, lesson and flowers.
export default function ShareSheet({ visible, recordId, record, onClose }) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return undefined;
    let live = true;
    setPayload(null);
    setError(null);
    getSharePayload(recordId)
      .then((p) => live && setPayload(p))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [visible, recordId]);

  const pick = (target) => {
    if (!payload) return;
    const pending = shareTo(target, payload); // starts synchronously (needed by the browser)
    onClose();
    pending.then((r) => {
      if (r && r.message) notify('Share', r.message);
    });
  };

  const copy = async () => {
    if (!payload) return;
    const r = await copyCaption(payload);
    if (r.message) notify(r.ok ? 'Copied' : 'Share', r.message);
  };

  const g = record ? gradeColors(record.grade) : null;
  const tags = payload?.hashtags ?? [];

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close share sheet">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>Celebrate your progress</Text>
              <Text style={styles.title} accessibilityRole="header">Share your result</Text>
            </View>
            <IconButton name="close" label="Close" onPress={onClose} />
          </View>

          {record && (
            <View style={styles.card}>
              <View style={styles.brandRow}>
                <Ionicons name="flower-outline" size={18} color={colors.primary} />
                <Text style={styles.brand}>langogo</Text>
                <View style={styles.flex} />
                <Flag id={record.lang} width={30} round />
                <Text style={styles.language}>{record.language}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={[styles.grade, { backgroundColor: g.solid }]}>
                  <Text style={styles.gradeText}>{record.grade}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.eyebrowSmall}>Lesson complete</Text>
                  <Text style={styles.lesson} numberOfLines={2}>{record.title}</Text>
                  <View style={styles.flowers}>
                    <Ionicons name="flower-outline" size={14} color={colors.primary} />
                    <Text style={styles.flowersText}>+{record.flowers_earned} flowers</Text>
                  </View>
                </View>
              </View>
              {tags.length > 0 && (
                <View style={styles.tags}>
                  {tags.map((t) => (
                    <Chip key={t} label={`#${t}`} tone="grey" style={styles.tag} />
                  ))}
                </View>
              )}
            </View>
          )}

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : !payload ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : (
            <>
              <View style={styles.targets}>
                {SHARE_TARGETS.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => pick(t.id)}
                    style={styles.target}
                    accessibilityRole="button"
                    accessibilityLabel={`Share on ${t.label}`}
                  >
                    <View style={styles.targetIcon}>
                      <Ionicons name={t.icon} size={26} color={t.color} />
                    </View>
                    <Text style={styles.label}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
              <SecondaryButton label="Copy text" icon="copy-outline" onPress={copy} />
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
  card: { padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.selectedBg, gap: spacing.s12, ...shadows.card() },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { ...typography.label, color: colors.primary },
  language: { ...typography.labelSm, color: colors.text },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grade: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: 'rgba(255,255,255,0.8)' },
  gradeText: { ...typography.headline, color: colors.onPrimary },
  eyebrowSmall: { ...typography.eyebrow, color: '#9A5B2E' },
  lesson: { ...typography.title, color: colors.text },
  flowers: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  flowersText: { ...typography.labelSm, color: colors.primary },
  tags: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  tag: { backgroundColor: colors.surface },
  targets: { flexDirection: 'row', justifyContent: 'space-around' },
  target: { alignItems: 'center', gap: 6, minWidth: 68 },
  targetIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, ...shadows.card() },
  label: { ...typography.caption, color: colors.text },
  loading: { marginVertical: spacing.md },
  error: { ...typography.body, color: colors.error, textAlign: 'center' },
});
