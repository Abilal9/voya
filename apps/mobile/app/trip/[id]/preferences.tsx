import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { Segments } from '@/features/event/EventParts';
import { StepDashes } from '@/features/trip/TripParts';
import { useTrip } from '@/features/trip/useTrip';
import { DISCOVERIES, PACES, TRIP_INTERESTS, suggestedInterests } from '@/services/tripRules';
import type { TripDiscovery, TripPace } from '@/services';
import { useSession } from '@/stores/session';
import { board, colors } from '@/theme';

const T = board.trip;

/**
 * 06 What kind of trip do you want? This traveler's choices for this trip
 * only. Account interests are only a starting suggestion; nothing here is
 * written back to the profile.
 */
export default function TripPreferencesScreen() {
  const { id, setup } = useLocalSearchParams<{ id: string; setup?: string }>();
  const router = useRouter();
  const h = useTrip(id);
  const account = useSession((s) => s.account);
  const mine = h.trip?.preferences?.[h.me];
  const [interests, setInterests] = React.useState<string[] | null>(null);
  const [pace, setPace] = React.useState<TripPace | null>(null);
  const [disc, setDisc] = React.useState<TripDiscovery | null>(null);
  if (h.isPending) return <Screen><LoadingState /></Screen>;
  const trip = h.trip;
  if (!trip || h.relation !== 'member') return <Screen><TopBar /><EmptyState title="This trip isn’t available" /></Screen>;

  const chosen = interests ?? mine?.interests ?? suggestedInterests(account?.interests ?? []);
  const p = pace ?? mine?.pace ?? 'Balanced';
  const d = disc ?? mine?.discoveries ?? 'Mix';
  const toggle = (i: string) => setInterests(chosen.includes(i) ? chosen.filter((x) => x !== i) : [...chosen, i]);
  const save = async () => {
    const ok = await h.run(() => h.services.trips.setPreferences(trip.id, { interests: chosen, pace: p, discoveries: d }));
    if (ok) router.push(`/trip/${trip.id}/discover`);
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title={setup ? '' : trip.title} right={setup ? <StepDashes step={4} /> : undefined} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title={'What kind of trip\ndo you want?'} body="Pick what feels like you." />
        <View style={styles.chips}>
          {TRIP_INTERESTS.map((i) => {
            const on = chosen.includes(i);
            return (
              <Pressable key={i} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(i)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{on ? `${i} ✓` : i}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.section}>Your pace</Text>
        <Segments items={PACES} value={p} onChange={setPace} />
        <Text style={styles.section}>Your discoveries</Text>
        <Segments items={DISCOVERIES} value={d} onChange={setDisc} />
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={styles.spacer} />
        <Button label="Start discovering" onPress={() => void save()} loading={h.busy} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: T.chip.gap },
  chip: {
    width: '48%', minHeight: T.chip.minHeight, justifyContent: 'center', paddingHorizontal: board.listRow.paddingY,
    borderRadius: T.chip.radius, borderWidth: 1, borderColor: T.chip.border,
  },
  chipOn: { backgroundColor: T.chip.selectedBackground, borderColor: colors.brand.lavender },
  chipText: { fontSize: T.chip.fontSize, color: colors.brand.plum },
  chipTextOn: { color: colors.brand.violet, fontWeight: '700' },
  section: { fontSize: T.sectionTitle.size, fontWeight: '700', color: colors.brand.plum, marginTop: T.sectionTitle.marginTop },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
