import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Check, Star, X } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { SwipeDeck, type SwipeDeckHandle } from '@/features/explore/SwipeDeck';
import { useTrip } from '@/features/trip/useTrip';
import { destinationPool, matchesInterest } from '@/services/tripRules';
import type { Place, TripPick } from '@/services';
import { board, colors, icon } from '@/theme';

const A = board.explore.actions;

/**
 * 07 Pick the places you love. Each answer is this traveler's own pick on the
 * shared trip; "Must do" adds a must-do (the same list Explore's Add to Plan
 * writes to). "Continue" marks this traveler as done choosing.
 */
export default function Discover() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useTrip(id);
  const deck = React.useRef<SwipeDeckHandle>(null);
  const nextPick = React.useRef<TripPick | null>(null);
  const trip = h.trip;
  const pool = useQuery({
    queryKey: ['trip-pool', trip?.destination],
    queryFn: async () => destinationPool(trip!, await h.services.places.discover({ city: trip!.destination })),
    enabled: !!trip,
  });
  // The deck is fixed when it opens, so answering doesn't reshuffle it.
  const [deckPlaces, setDeckPlaces] = React.useState<Place[] | null>(null);
  React.useEffect(() => {
    if (!deckPlaces && pool.data && trip) setDeckPlaces(pool.data.filter((p) => !trip.picks?.[h.me]?.[p.id]));
  }, [pool.data, trip, deckPlaces, h.me]);

  if (h.isPending || pool.isPending || !deckPlaces) return <Screen><LoadingState /></Screen>;
  if (!trip || h.relation !== 'member') return <Screen><TopBar /><EmptyState title="This trip isn’t available" /></Screen>;
  const total = pool.data?.length ?? 0;
  const picked = Object.keys(trip.picks?.[h.me] ?? {}).filter((pid) => pool.data?.some((p) => p.id === pid)).length;
  const interests = trip.preferences?.[h.me]?.interests ?? [];
  const tagFor = (p: Place) => (interests.some((i) => matchesInterest(p, i)) ? 'Great match for you' : undefined);

  const onSwipe = (place: Place, dir: 'like' | 'dislike') => {
    const pick: TripPick = nextPick.current ?? (dir === 'like' ? 'like' : 'skip');
    nextPick.current = null;
    void h.run(() => h.services.trips.pick(trip.id, place.id, pick));
  };
  const finish = async () => {
    const ok = await h.run(() => h.services.trips.finishChoosing(trip.id));
    if (ok) router.push(`/trip/${trip.id}/group`);
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title={`${trip.destination} · Your picks`} />
      <AuthIntro tight title={'Pick the places\nyou love'} body={'We’ll use your choices to build\nthe group itinerary.'} />
      {total === 0 ? (
        <EmptyState title={`No places in ${trip.destination} yet`} body="Voya covers a few cities in this preview." />
      ) : picked >= total || deckPlaces.length === 0 ? (
        <EmptyState title="You’ve seen every place" body="Continue to see how the group is doing." />
      ) : (
        <>
          <SwipeDeck ref={deck} places={deckPlaces} onSwipe={onSwipe} onOpen={(p) => router.push(`/place/${p.id}`)} tagFor={tagFor} />
          <View style={styles.actions}>
            <Choice label="Not for me" background={A.skipBackground} onPress={() => deck.current?.dislike()}>
              <X size={A.icon} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
            </Choice>
            <Choice label="Must do" background={A.saveBackground} onPress={() => { nextPick.current = 'must'; deck.current?.like(); }}>
              <Star size={A.icon} color={A.saveColor} strokeWidth={icon.strokeWidth} />
            </Choice>
            <Choice label="I like this" background={colors.brand.peach} onPress={() => deck.current?.like()}>
              <Check size={A.icon} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
            </Choice>
          </View>
          <Text style={styles.hint}>Your must-dos help shape the shared itinerary.</Text>
        </>
      )}
      {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
      <View style={styles.spacer} />
      <View style={styles.progress}>
        <Text style={styles.label}>YOUR DISCOVERIES</Text>
        <Text style={styles.label}>{`${picked} of ${total}`}</Text>
      </View>
      <Button label="Continue" variant="secondary" onPress={() => void finish()} loading={h.busy} />
    </Screen>
  );
}

function Choice({ label, background, onPress, children }: { label: string; background: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.choice}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.round, { backgroundColor: background }]}>
        {children}
      </Pressable>
      <Text style={styles.choiceLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'center', gap: A.gap, marginTop: A.marginTop },
  choice: { alignItems: 'center', gap: A.labelGap },
  round: { width: A.size, height: A.size, borderRadius: A.size / 2, alignItems: 'center', justifyContent: 'center' },
  choiceLabel: { fontSize: A.labelSize, color: A.labelColor },
  hint: { ...board.tinyCenter, textAlign: 'center', marginTop: board.inlineGap },
  spacer: { flex: 1 },
  progress: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: board.tinyCenter.fontSize, color: colors.text.secondary, letterSpacing: board.trip.labelSpacing },
  error: { ...board.small, color: colors.status.danger, textAlign: 'center' },
});
