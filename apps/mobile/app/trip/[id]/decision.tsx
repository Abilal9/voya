import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Check, Circle } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TextField, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { PersonAvatar } from '@/features/event/EventParts';
import { placeTint, useFirstNames } from '@/features/trip/TripParts';
import { useTrip } from '@/features/trip/useTrip';
import { destinationPool, interestedIn, travelers } from '@/services/tripRules';
import { board, colors, icon } from '@/theme';

/**
 * 11 Group decision on one stop. Travelers' replacement suggestions are shown
 * with their notes; alternatives are places not on the itinerary yet, most
 * wanted by the group first. The organizer replaces or keeps the original;
 * anyone else's choice becomes a suggestion for the organizer.
 */
export default function Decision() {
  const { id, item: itemId } = useLocalSearchParams<{ id: string; item: string }>();
  const router = useRouter();
  const h = useTrip(id);
  const names = useFirstNames();
  const trip = h.trip;
  const pool = useQuery({
    queryKey: ['trip-pool-all', trip?.destination],
    queryFn: () => h.services.places.discover({ city: trip!.destination }),
    enabled: !!trip,
  });
  const [choice, setChoice] = React.useState<string>();
  const [note, setNote] = React.useState('');
  if (h.isPending || pool.isPending) return <Screen><LoadingState /></Screen>;
  const item = trip?.days.flatMap((d) => d.items).find((i) => i.id === itemId);
  if (!trip || h.relation !== 'member' || !item) return <Screen><TopBar /><EmptyState title="That stop changed" body="It may have been removed or replaced." /></Screen>;
  const places = pool.data ?? [];
  const current = places.find((p) => p.id === item.placeId);
  const onTrip = new Set(trip.days.flatMap((d) => d.items.map((i) => i.placeId)));
  const n = travelers(trip).length;
  const alternatives = destinationPool(trip, places)
    .filter((p) => !onTrip.has(p.id))
    .map((p) => ({ p, interested: interestedIn(trip, p.id).length }))
    .sort((a, b) => b.interested - a.interested || a.p.id.localeCompare(b.p.id))
    .slice(0, 5);
  const requests = item.replaceRequests ?? [];
  const decide = h.isOrganizer && !h.closed;

  const replace = async () => {
    if (!choice) return h.setError('Choose a place first.');
    const ok = await h.run(() => (decide
      ? h.services.trips.replaceItem(trip.id, item.id, choice)
      : h.services.trips.suggestReplacement(trip.id, item.id, { placeId: choice, note })));
    if (ok) router.back();
  };
  const keep = async () => {
    if (!decide) return router.back();
    const ok = await h.run(() => h.services.trips.keepOriginal(trip.id, item.id));
    if (ok) router.back();
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Group decision" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title={requests.length ? 'One stop needs\nattention' : decide ? 'Replace this stop?' : 'Suggest a\nreplacement'} />
        <View style={styles.row}>
          <View style={[styles.thumb, { backgroundColor: placeTint(current) }]} />
          <View style={styles.flex}>
            <Text style={styles.name}>{current?.name ?? item.title}</Text>
            <Text style={styles.small}>{`${item.placeId ? interestedIn(trip, item.placeId).length : 0} interested${requests.length ? ` · ${requests.length} ${requests.length === 1 ? 'wants' : 'want'} to replace` : ''}`}</Text>
          </View>
        </View>
        {requests.map((r) => (
          <View key={r.id} style={styles.request}>
            <View style={styles.requestHead}>
              <PersonAvatar person={names.people.byId.get(r.by)} size={board.trip.requestAvatar} />
              <Text style={styles.small}>{`${names.first(r.by)} suggested replacing this stop${r.placeId ? ` with ${places.find((p) => p.id === r.placeId)?.name ?? 'another place'}` : ''}`}</Text>
            </View>
            {r.note ? <Text style={styles.quote}>{`“${r.note}”`}</Text> : null}
          </View>
        ))}
        <Text style={styles.section}>Something everyone will love</Text>
        {alternatives.length === 0 ? <Text style={styles.small}>Every place Voya knows here is already on the trip.</Text> : alternatives.map(({ p, interested }) => (
          <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: choice === p.id }} onPress={() => setChoice(p.id)} style={styles.row}>
            <View style={[styles.thumb, { backgroundColor: placeTint(p) }]} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
              <Text style={styles.small}>{`${interested}/${n} match`}</Text>
            </View>
            {choice === p.id ? <Check size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} /> : <Circle size={board.trip.emptyDot} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />}
          </Pressable>
        ))}
        {!decide ? (
          <View style={styles.note}>
            <TextField label="Add a note · optional" value={note} onChangeText={setNote} placeholder="Prefer something outdoors" maxLength={200} />
          </View>
        ) : null}
        <Text style={styles.hint}>{decide ? 'Replacing updates the trip for everyone.' : 'Your choice becomes a group suggestion.'}</Text>
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={styles.spacer} />
        <Button label={decide ? 'Replace' : 'Suggest'} onPress={() => void replace()} loading={h.busy} disabled={!choice && (decide || !note.trim())} />
        <Button label="Keep original" variant="secondary" onPress={() => void keep()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  flex: { flex: 1 },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: board.settings.row.gap, paddingVertical: board.listRow.paddingY,
    borderBottomWidth: 1, borderBottomColor: board.settings.row.border,
  },
  thumb: { width: board.trip.rowThumb.width, height: board.trip.rowThumb.height, borderRadius: board.thumb.radius },
  name: { fontSize: board.settings.row.titleSize, fontWeight: '700', color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary, flexShrink: 1 },
  request: { padding: board.hangout.selection.padding, borderRadius: board.hangout.selection.radius, backgroundColor: board.hangout.selection.background, marginTop: board.listRow.paddingY },
  requestHead: { flexDirection: 'row', alignItems: 'center', gap: board.inlineGap },
  quote: { fontSize: board.hangout.formRow.fontSize, color: colors.brand.plum, marginTop: board.listRow.paddingY },
  section: { fontSize: board.trip.sectionTitle.size, fontWeight: '700', color: colors.brand.plum, marginTop: board.trip.sectionTitle.marginTop },
  note: { marginTop: board.listRow.paddingY },
  hint: { ...board.tinyCenter, textAlign: 'center', marginTop: board.listRow.paddingY },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap, textAlign: 'center' },
});
