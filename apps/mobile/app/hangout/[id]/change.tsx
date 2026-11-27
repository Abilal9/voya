import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Text, TextField } from '@/components/ui';
import { useHangout } from '@/features/hangout/useHangout';
import { SLOT_CATEGORIES, slotsFor } from '@/services/hangoutRules';
import { SafeAreaView } from 'react-native-safe-area-context';
import { board, colors, icon } from '@/theme';

const SEG = board.segment;

/**
 * H07 Suggest a change — a sheet over the final plan. Sends a proposal to the
 * organizer (another place and/or a note); the final timeline stays as it is.
 */
export default function SuggestChange() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useHangout(id);
  const hangout = h.hangout;
  const slots = hangout ? slotsFor(hangout.template) : [];
  const [slot, setSlot] = React.useState<string | undefined>();
  const active = slot ?? slots[0];
  const [picking, setPicking] = React.useState(false);
  const [placeId, setPlaceId] = React.useState<string | undefined>();
  const [note, setNote] = React.useState('');
  const options = useQuery({
    queryKey: ['change-options', id, active],
    queryFn: () => h.services.places.discover({ city: hangout!.city, categories: SLOT_CATEGORIES[active!] }),
    enabled: !!hangout && !!active && picking,
  });

  if (h.isPending) return <SafeAreaView style={styles.root}><LoadingState /></SafeAreaView>;
  if (!hangout || !active) return <SafeAreaView style={styles.root}><EmptyState title="This hangout isn’t available" /></SafeAreaView>;
  const current = hangout.timeline.find((t) => t.title === active)?.placeId;
  const chosen = options.data?.find((p) => p.id === placeId);

  const send = async () => {
    const ok = await h.run(() => h.services.hangouts.proposeChange(hangout.id, { slot: active, placeId, note }));
    if (ok) router.back();
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.handle} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Suggest a change</Text>
        <Text style={styles.label}>What would you like to change?</Text>
        <View style={styles.seg}>
          {slots.map((s) => (
            <Pressable key={s} accessibilityRole="tab" accessibilityState={{ selected: s === active }} onPress={() => { setSlot(s); setPlaceId(undefined); }} style={[styles.segItem, s === active && styles.segOn]}>
              <Text style={[styles.segText, s === active && styles.segTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          label={chosen ? `Instead: ${chosen.name}` : 'Suggest another place'}
          variant="secondary"
          onPress={() => setPicking((v) => !v)}
        />
        {picking ? (
          options.isPending ? <LoadingState compact /> : (options.data ?? []).filter((p) => p.id !== current).map((p) => (
            <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ selected: p.id === placeId }} onPress={() => { setPlaceId(p.id); setPicking(false); }} style={styles.row}>
              <Text style={[styles.rowText, styles.flex]}>{p.name}</Text>
              {p.id === placeId ? <Check size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} /> : null}
            </Pressable>
          ))
        ) : null}
        <View style={styles.note}>
          <TextField label="Add a note" value={note} onChangeText={setNote} placeholder="Maybe somewhere closer?" multiline maxLength={200} style={styles.noteInput} />
        </View>
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <Button label="Send suggestion" onPress={() => void send()} loading={h.busy} disabled={!placeId && !note.trim()} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base, paddingHorizontal: board.settings.sheet.paddingX },
  flex: { flex: 1 },
  handle: {
    width: board.filters.handle.width, height: board.filters.handle.height, borderRadius: board.filters.handle.radius,
    backgroundColor: board.filters.handle.color, alignSelf: 'center', marginTop: board.filters.handle.marginTop, marginBottom: board.filters.handle.marginBottom,
  },
  title: { fontSize: board.settings.sheet.titleSize, lineHeight: board.settings.sheet.titleLineHeight, fontWeight: '700', color: colors.brand.plum, marginBottom: board.listRow.paddingY },
  label: { fontSize: board.field.labelSize, color: colors.text.secondary },
  seg: { flexDirection: 'row', gap: SEG.gap, padding: SEG.padding, borderRadius: SEG.radius, backgroundColor: SEG.background, marginTop: SEG.marginTop / 2, marginBottom: SEG.marginBottom },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: SEG.itemPaddingY, borderRadius: SEG.itemRadius },
  segOn: { backgroundColor: colors.surface.base },
  segText: { fontSize: SEG.fontSize, color: colors.brand.plum },
  segTextOn: { color: colors.brand.violet, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: board.listRow.paddingY, borderBottomWidth: 1, borderBottomColor: board.listRow.borderColor },
  rowText: { fontSize: board.settings.row.titleSize, color: colors.brand.plum },
  note: { marginVertical: board.listRow.paddingY },
  noteInput: { minHeight: board.settings.bioMinHeight, textAlignVertical: 'top' },
  error: { ...board.small, color: colors.status.danger, marginBottom: board.inlineGap },
});
