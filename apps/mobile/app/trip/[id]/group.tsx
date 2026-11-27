import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Check, MoreHorizontal } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { PersonAvatar } from '@/features/event/EventParts';
import { placeTint, useFirstNames } from '@/features/trip/TripParts';
import { useTrip } from '@/features/trip/useTrip';
import { canGenerateFor, destinationPool, groupMatches, readyCount, travelerStatus, travelers } from '@/services/tripRules';
import { board, colors, icon } from '@/theme';

/**
 * 08 Your group is almost ready. Progress comes from what each traveler has
 * actually chosen; "Early matches" are places travelers picked. The organizer
 * builds the trip (mock generator); travelers see it once it exists.
 */
export default function Group() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useTrip(id);
  const names = useFirstNames();
  const trip = h.trip;
  const pool = useQuery({
    queryKey: ['trip-pool-all', trip?.destination],
    queryFn: () => h.services.places.discover({ city: trip!.destination }),
    enabled: !!trip,
  });
  if (h.isPending || pool.isPending) return <Screen><LoadingState /></Screen>;
  if (!trip || h.relation !== 'member') return <Screen><TopBar /><EmptyState title="This trip isn’t available" /></Screen>;
  const places = pool.data ?? [];
  const total = destinationPool(trip, places).length;
  const people = travelers(trip);
  const ready = readyCount(trip);
  const matches = groupMatches(trip, places).slice(0, 5);
  const supported = canGenerateFor(trip, places);
  const built = trip.generated && trip.days.some((d) => d.items.length);

  const build = async () => {
    const ok = await h.run(() => h.services.trips.generateItinerary(trip.id));
    if (ok) router.push(`/trip/${trip.id}/itinerary`);
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title={trip.title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro
          tight
          title={ready === people.length ? 'Your group is ready' : 'Your group is\nalmost ready'}
          body={`${ready} of ${people.length} ${people.length === 1 ? 'traveler' : 'travelers'} ready. Good things are coming together.`}
        />
        {people.map((pid) => {
          const status = travelerStatus(trip, pid);
          const n = Object.keys(trip.picks?.[pid] ?? {}).length;
          return (
            <View key={pid} style={styles.row}>
              <PersonAvatar person={names.people.byId.get(pid)} size={board.activity.avatar} />
              <View style={styles.flex}>
                <Text style={styles.name}>{names.first(pid)}</Text>
                <Text style={styles.small}>{status === 'ready' ? `${n} ${n === 1 ? 'choice' : 'choices'}` : status === 'joined' ? 'Hasn’t started yet' : `${Math.min(n, total)} / ${total}`}</Text>
              </View>
              {status === 'ready'
                ? <Check size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} accessibilityLabel="Ready" />
                : <MoreHorizontal size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} accessibilityLabel="Still choosing" />}
            </View>
          );
        })}
        <Text style={styles.section}>Early matches</Text>
        {matches.length === 0 ? <Text style={styles.small}>Matches appear once travelers start picking places.</Text> : matches.map(({ place, interested }) => (
          <View key={place.id} style={styles.row}>
            <View style={[styles.thumb, { backgroundColor: placeTint(place) }]} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={2}>{place.name}</Text>
              <Text style={styles.small}>{`${interested}/${people.length} interested`}</Text>
            </View>
          </View>
        ))}
        {!supported ? <Text style={styles.note}>{`Voya doesn’t have enough places in ${trip.destination} to build a trip yet.`}</Text> : null}
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={styles.spacer} />
        {built ? (
          <Button label="See the itinerary" onPress={() => router.push(`/trip/${trip.id}/itinerary`)} />
        ) : h.canBuild ? (
          <Button label={h.busy ? 'Building your trip…' : h.error ? 'Try again' : 'Build our trip'} onPress={() => void build()} loading={h.busy} disabled={!supported} />
        ) : (
          <Text style={styles.note}>{`${names.first(trip.ownerId)} builds the trip when the group is ready.`}</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  flex: { flex: 1 },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: board.settings.row.gap, minHeight: board.settings.row.minHeight,
    paddingVertical: board.listRow.paddingY, borderBottomWidth: 1, borderBottomColor: board.settings.row.border,
  },
  thumb: { width: board.thumb.width, height: board.thumb.height, borderRadius: board.thumb.radius },
  name: { fontSize: board.settings.row.titleSize, fontWeight: '700', color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  section: { fontSize: board.trip.sectionTitle.size, fontWeight: '700', color: colors.brand.plum, marginTop: board.trip.sectionTitle.marginTop, marginBottom: board.inlineGap },
  note: { ...board.small, color: colors.text.secondary, textAlign: 'center', marginTop: board.listRow.paddingY },
  error: { ...board.small, color: colors.status.danger, textAlign: 'center', marginTop: board.inlineGap },
});
