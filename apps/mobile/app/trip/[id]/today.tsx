import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Navigation } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { openInMaps } from '@/features/event/EventParts';
import { usePlaces } from '@/features/hangout/usePlaces';
import { testClockOn, tripNow } from '@/features/trip/devClock';
import { DayTimeline, placeTint } from '@/features/trip/TripParts';
import { useTrip } from '@/features/trip/useTrip';
import { hhmm, plannedDates, todayOn } from '@/services/tripRules';
import { board, colors, icon } from '@/theme';

const T = board.trip;

/** 36 Today: the stop happening now (or next) and the rest of the day. */
export default function Today() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useTrip(id);
  const trip = h.trip;
  const places = usePlaces(trip?.days.flatMap((d) => d.items.map((i) => i.placeId).filter((x): x is string => !!x)) ?? []);
  if (h.isPending) return <Screen><LoadingState /></Screen>;
  if (!trip || h.relation !== 'member') return <Screen><TopBar /><EmptyState title="This trip isn’t available" /></Screen>;
  const state = todayOn(trip, tripNow());
  const total = plannedDates(trip.startDate, trip.endDate).length;

  if (state.kind !== 'during') {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
        <TopBar title="Your shared trip" />
        <AuthIntro tight title="Today" body={trip.destination} />
        <EmptyState
          title={state.kind === 'before' ? `${state.daysUntil} ${state.daysUntil === 1 ? 'day' : 'days'} to go` : 'This trip is over'}
          body={state.kind === 'before' ? 'Today fills in once the trip starts.' : 'Its itinerary stays on the trip page.'}
          actionLabel="View the itinerary"
          onAction={() => router.replace(`/trip/${trip.id}/itinerary`)}
        />
      </Screen>
    );
  }
  const now = state.now;
  const place = now?.placeId ? places.get(now.placeId) : undefined;
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Your shared trip" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Today" body={`${trip.destination} · Day ${state.dayIndex + 1} of ${total}${testClockOn() ? ' · test clock' : ''}`} />
        {now ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.eyebrow}>{state.running ? 'NOW' : 'NEXT UP'}</Text>
              <Text style={styles.small}>{hhmm(now.startsAt)}</Text>
            </View>
            <View style={[styles.photo, { backgroundColor: placeTint(place) }]} />
            <Text style={styles.title}>{place?.name ?? now.title}</Text>
            <Text style={styles.small}>{place?.type ?? now.subtitle ?? ''}</Text>
            {now.endsAt ? <Text style={styles.small}>{`Until ${hhmm(now.endsAt)}`}</Text> : null}
            {place ? <Button label="Directions" onPress={() => openInMaps({ venue: place.name, city: place.city })} /> : null}
            {place ? (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/place/${place.id}`)} style={styles.link}>
                <Text style={styles.linkText}>View details</Text>
                <ChevronRight size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={styles.small}>Nothing else planned today. Enjoy the rest of it.</Text>
        )}
        {state.next.length ? (
          <>
            <View style={styles.nextHead}>
              <Navigation size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
              <Text style={styles.eyebrow}>NEXT</Text>
            </View>
            <DayTimeline items={state.next} places={places} compact />
          </>
        ) : null}
        <View style={styles.spacer} />
        <Button label="View full day" variant="secondary" onPress={() => router.push(`/trip/${trip.id}/itinerary?day=${state.dayIndex}`)} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  card: { padding: T.todayCard.padding, borderRadius: T.todayCard.radius, backgroundColor: T.todayCard.background, gap: board.inlineGap / 2 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { ...board.home.eyebrow, color: colors.brand.violet },
  photo: { height: T.todayCard.photoHeight, borderRadius: board.thumb.radius, marginVertical: board.inlineGap },
  title: { ...board.h1, fontSize: board.event.smallTitle, color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  link: { flexDirection: 'row', alignItems: 'center', gap: board.inlineGap / 2, paddingVertical: board.inlineGap },
  linkText: { ...board.small, color: colors.brand.violet },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: board.inlineGap, marginTop: T.nextMarginTop, marginBottom: board.inlineGap },
});
