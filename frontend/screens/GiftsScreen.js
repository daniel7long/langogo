import { useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import Text from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';

import { enterFriendCode, equipGift, getGifts, redeemGift } from '../api/app';
import AsyncState from '../components/AsyncState';
import Avatar from '../components/Avatar';
import Chip from '../components/Chip';
import { GiftThumb, WallpaperArt } from '../components/GiftArt';
import PrimaryButton from '../components/PrimaryButton';
import ProgressBar from '../components/ProgressBar';
import Screen from '../components/Screen';
import SecondaryButton from '../components/SecondaryButton';
import TopBar from '../components/TopBar';
import useAsync from '../hooks/useAsync';
import { confirm, notify } from '../utils/dialog';
import { colors, radius, shadows, spacing, typography } from '../theme';

const TABS = [
  { id: 'impact', label: 'Impact' },
  { id: 'style', label: 'Style' },
  { id: 'earn', label: 'Earn' },
];
const SLOTS = [
  { id: 'outfit', label: 'Outfits' },
  { id: 'frame', label: 'Frames' },
  { id: 'wallpaper', label: 'Wallpapers' },
];
const PER = { day: 'today', week: 'this week' };

// The Gift Menu: spend flowers on real-world impact (a tree, a meal) or on avatar outfits, profile frames and wallpapers,
// and see how flowers are earned.
export default function GiftsScreen() {
  const state = useAsync(getGifts, []);
  return (
    <Screen>
      <TopBar title="Gift Menu" />
      <AsyncState state={state}>{(data) => <GiftsView data={data} reload={state.reload} />}</AsyncState>
    </Screen>
  );
}

function Flowers({ n, color = colors.primary }) {
  return (
    <View style={styles.flowerRow}>
      <Ionicons name="flower-outline" size={15} color={color} />
      <Text style={[styles.flowerText, { color }]}>{n}</Text>
    </View>
  );
}

function GiftsView({ data: first, reload }) {
  const [data, setData] = useState(first);
  const [tab, setTab] = useState('impact');
  const [slot, setSlot] = useState('outfit');
  const [pick, setPick] = useState(null); // the style item being tried on
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setData(await getGifts());
    } catch {
      reload();
    }
  };
  const run = async (work) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      notify("That didn't work", e.message);
    } finally {
      setBusy(false);
    }
  };

  const items = data.shop;
  const impact = items.filter((i) => i.kind === 'impact');
  const style = items.filter((i) => i.kind === 'style' && i.slot === slot);

  const redeem = (item) =>
    run(async () => {
      const ok = await confirm(
        item.kind === 'impact' ? `${item.name}?` : `Get ${item.name}?`,
        `This costs ${item.price} flowers. You have ${data.flowers}.`,
        'Redeem',
        'Not now'
      );
      if (!ok) return;
      const res = await redeemGift(item.id);
      notify(item.kind === 'impact' ? 'Thank you!' : 'It is yours!', res.message);
      await refresh();
    });

  const wear = (item, on) =>
    run(async () => {
      await equipGift(item.slot, on ? item.id : null);
      await refresh();
    });

  // What the preview shows: what you wear now, with the picked item tried on.
  const shown = { ...data.equipped, ...(pick ? { [pick.slot]: pick.id } : {}) };
  const need = pick ? Math.max(0, pick.price - data.flowers) : 0;

  const shareCode = async () => {
    const message = `Join me on Langogo, the low-pressure speaking practice app! When you sign up, enter my friend code: ${data.invite.code}`;
    try {
      await Share.share({ message });
    } catch {
      notify('Your friend code', data.invite.code);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.balance}>
        <View style={styles.balanceTop}>
          <Ionicons name="flower" size={26} color={colors.primary} />
          <Text style={styles.balanceNumber}>{data.flowers}</Text>
          <Text style={styles.balanceLabel}>flowers</Text>
        </View>
        <ProgressBar progress={data.earned_today / data.daily_cap} height={8} />
        <Text style={styles.capText}>
          Earned today: {data.earned_today} of {data.daily_cap}
        </Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'impact' && (
        <View style={styles.gap}>
          <Text style={styles.lead}>Turn your practice into something real.</Text>
          {impact.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.impactRow}>
                <Text style={styles.impactEmoji}>{item.emoji}</Text>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardText}>{item.effect}</Text>
                </View>
              </View>
              {!!item.partner && (
                <Pressable
                  onPress={() => item.partner_url && Linking.openURL(item.partner_url).catch(() => {})}
                  disabled={!item.partner_url}
                  accessibilityRole={item.partner_url ? 'link' : 'text'}
                >
                  <Text style={styles.partner}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={colors.greenText} /> Given through {item.partner}
                    {item.partner_url ? ' · learn more' : ''}
                  </Text>
                </Pressable>
              )}
              {item.community_total > 0 && (
                <Text style={styles.community}>
                  {item.unit === 'tree' ? '🌳' : '🍲'} Langogo learners have given {item.community_total} {item.unit}
                  {item.community_total === 1 ? '' : 's'} so far.
                </Text>
              )}
              <PrimaryButton
                label={
                  item.available === false
                    ? 'Back soon. More are on the way'
                    : data.flowers >= item.price
                      ? `Redeem · ${item.price} flowers`
                      : `${item.price - data.flowers} more flowers to go`
                }
                disabled={busy || item.available === false || data.flowers < item.price}
                onPress={() => redeem(item)}
              />
            </View>
          ))}
          <View style={styles.impactTotals}>
            <Ionicons name="heart" size={18} color={colors.coral} />
            <Text style={styles.cardText}>
              {data.impact.trees || data.impact.meals
                ? `So far you gave ${data.impact.trees} tree${data.impact.trees === 1 ? '' : 's'} (about ${data.impact.co2_kg_per_year} kg of CO₂ a year) and ${data.impact.meals} meal${data.impact.meals === 1 ? '' : 's'}.`
                : 'Your first gift is only 100 flowers away.'}
            </Text>
          </View>
        </View>
      )}

      {tab === 'style' && (
        <View style={styles.gap}>
          <View style={styles.preview}>
            <View style={StyleSheet.absoluteFill}>
              {shown.wallpaper ? <WallpaperArt id={shown.wallpaper} width={600} height={220} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.selectedBg }]} />}
            </View>
            <Avatar name={data.name} photoUrl={data.photo_url} size={132} equipped={shown} />
          </View>

          <View style={styles.slotRow}>
            {SLOTS.map((s) => (
              <Pressable key={s.id} onPress={() => { setSlot(s.id); setPick(null); }} accessibilityRole="button">
                <Chip label={s.label} tone={slot === s.id ? 'orange' : 'grey'} style={styles.slotChip} />
              </Pressable>
            ))}
          </View>

          {pick && (
            <View style={styles.pickBar}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{pick.name}</Text>
                <Text style={styles.cardText}>{pick.blurb}</Text>
              </View>
              {pick.owned ? (
                <SecondaryButton label={pick.equipped ? 'Take off' : 'Wear'} onPress={() => wear(pick, !pick.equipped).then(() => setPick(null))} disabled={busy} style={styles.pickBtn} />
              ) : (
                <PrimaryButton label={need ? `${need} more` : `Redeem · ${pick.price}`} disabled={busy || need > 0} onPress={() => redeem(pick).then(() => setPick(null))} style={styles.pickBtn} />
              )}
            </View>
          )}

          <View style={styles.grid}>
            {style.map((item) => {
              const on = pick?.id === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setPick(on ? null : item)}
                  style={[styles.item, on && styles.itemOn]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.owned ? 'owned' : `${item.price} flowers`}`}
                >
                  <GiftThumb item={item} size={slot === 'wallpaper' ? 92 : 84} />
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  {item.equipped ? <Chip label="Wearing" tone="green" icon="checkmark" /> : item.owned ? <Chip label="Owned" tone="teal" /> : <Flowers n={item.price} />}
                  <Text style={styles.rarity}>{item.rarity}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {tab === 'earn' && (
        <View style={styles.gap}>
          <Text style={styles.lead}>How to earn flowers</Text>
          <View style={styles.card}>
            {data.rules.map((r, i) => (
              <View key={r.kind} style={[styles.ruleRow, i > 0 && styles.ruleBorder]}>
                <View style={styles.flex}>
                  <Text style={styles.ruleLabel}>{r.label}</Text>
                  <Text style={styles.ruleSub}>
                    {r.per === 'language' ? 'One time per language' : r.per === 'total' ? `${r.used} of ${r.limit} friends` : `${r.used} of ${r.limit} ${PER[r.per]}`}
                  </Text>
                </View>
                <Flowers n={`+${r.flowers}`} />
              </View>
            ))}
          </View>
          <Text style={styles.fine}>You can earn up to {data.daily_cap} flowers a day. Friend bonuses don't count toward that limit.</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Invite a friend</Text>
            <Text style={styles.cardText}>
              Share your code. When your friend enters it and finishes lesson 1, you get 100 flowers (up to {data.invite.max} friends).
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.code} selectable>{data.invite.code}</Text>
            </View>
            <PrimaryButton label="Share my code" icon="share-outline" onPress={shareCode} />
            <Text style={styles.fine}>
              {data.invite.joined} joined · {data.invite.finished_lesson_1} finished lesson 1 · {data.invite.paid} of {data.invite.max} bonuses received
            </Text>
            {!data.invite.referred_by && <FriendCode onDone={refresh} />}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// "A friend invited me": only shown before the first lesson.
function FriendCode({ onDone }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await enterFriendCode(code);
      notify('Thank you!', 'Your friend will get their flowers when you finish lesson 1.');
      onDone();
    } catch (e) {
      notify("That code didn't work", e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.friend}>
      <Text style={styles.ruleLabel}>Did a friend invite you?</Text>
      <TextInput value={code} onChangeText={setCode} placeholder="Friend's code" autoCapitalize="none" autoCorrect={false} style={styles.input} placeholderTextColor={colors.textFaint} />
      <SecondaryButton label="Use this code" onPress={send} disabled={busy || !code.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  gap: { gap: spacing.md },
  balance: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.line, ...shadows.card() },
  balanceTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  balanceNumber: { ...typography.display, color: colors.text },
  balanceLabel: { ...typography.body, color: colors.textMuted },
  capText: { ...typography.caption, color: colors.textMuted },
  tabs: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.full, padding: 4 },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  tabOn: { backgroundColor: colors.surface, ...shadows.card() },
  tabText: { ...typography.label, color: colors.textMuted },
  tabTextOn: { color: colors.primary },
  lead: { ...typography.headline, color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.s12, borderWidth: 1, borderColor: colors.line, ...shadows.card() },
  cardTitle: { ...typography.title, color: colors.text },
  cardText: { ...typography.body, color: colors.textMuted },
  partner: { ...typography.caption, color: colors.greenText },
  community: { ...typography.caption, color: colors.textMuted },
  impactRow: { flexDirection: 'row', gap: spacing.s12, alignItems: 'flex-start' },
  impactEmoji: { fontSize: 40 },
  impactTotals: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.coralBg, borderRadius: radius.md, padding: spacing.s12 },
  preview: { height: 190, borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  slotRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  slotChip: { paddingVertical: 8, paddingHorizontal: spacing.md },
  pickBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, backgroundColor: colors.selectedBg, borderRadius: radius.lg, padding: spacing.s12 },
  pickBtn: { minWidth: 120 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 },
  item: { width: '47.5%', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.s12, borderWidth: 2, borderColor: colors.line },
  itemOn: { borderColor: colors.primary },
  itemName: { ...typography.labelSm, color: colors.text, textAlign: 'center', minHeight: 32 },
  rarity: { ...typography.caption, color: colors.textFaint },
  flowerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flowerText: { ...typography.label },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s12, paddingVertical: spacing.sm },
  ruleBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  ruleLabel: { ...typography.label, color: colors.text },
  ruleSub: { ...typography.caption, color: colors.textMuted },
  fine: { ...typography.caption, color: colors.textMuted },
  codeBox: { alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.s12 },
  code: { ...typography.headline, color: colors.text, letterSpacing: 2 },
  friend: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.s12 },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, ...typography.body, color: colors.text, backgroundColor: colors.surface },
});
