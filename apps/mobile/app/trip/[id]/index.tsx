import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, ChevronRight, MapPin, MoreHorizontal, Navigation, Star, Users } from 'lucide-react-native';
import { AvatarStack, Button, EmptyState, LoadingState, Screen, Text, TopBar, ErrorState } from '@/components/ui';
import { authStyles } from '@/features/auth/AuthParts';
import { Cover } from '@/features/event/EventParts';
import { SuccessSheet } from '@/features/feedback/Sheets';
import { usePlaces } from '@/features/hangout/usePlaces';
import { BottomSheet, SettingsRow, sheetText } from '@/features/settings/SettingsParts';
import { placeTint, useFirstNames } from '@/features/trip/TripParts';
import { useTrip, type TripHook } from '@/features/trip/useTrip';
import { dateRange, formatDay, nightsBetween, plannedDates, readyCount, travelers } from '@/services/tripRules';
import { ServiceError } from '@/services';
import { board, colors, icon } from '@/theme';

const T = board.trip;
const E = board.event;

/**
 * One route for a trip: the invitation (12) for someone who hasn't answered,
 * the completed trip (T05) once it's over, otherwise the overview (35).
 */
export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useTrip(id);
  const [welcome, setWelcome] = React.useState(false);
  if (h.isPending) return <Screen><LoadingState label="Loading trip" /></Screen>;
  const trip = h.trip;
  if (h.isError && !(h.failureReason instanceof ServiceError && h.failureReason.code === 'not_found')) {
    return <Screen><TopBar /><ErrorState error={h.failureReason} onRetry={() => void h.refetch()} /></Screen>;
  }
  if (!trip || h.relation === 'none') return <Screen><TopBar /><EmptyState title="This trip isn’t available" body="It may have been deleted, or you’re not on it." /></Screen>;
  const hh: TripHook = { ...h, trip };
  const view = h.relation === 'invited' ? <Join h={hh} onJoined={() => setWelcome(true)} /> : h.closed ? <Completed h={hh} /> : <Overview h={hh} />;
  return (
    <>
      {view}
      {/* S07 lives here: after joining, this screen switches from the invitation to the overview. */}
      <SuccessSheet
        visible={welcome} title="You’re in." body={`${trip.destination} · ${dateRange(trip.startDate, trip.endDate)}`}
        primaryLabel="Choose your preferences" onPrimary={() => { setWelcome(false); router.push(`/trip/${trip.id}/preferences`); }}
        onClose={() => setWelcome(false)}
      />
    </>
  );
}

/** Where "Continue planning" takes this traveler next. */
function nextStep(h: TripHook) {
  const { trip, me } = h;
  if (trip.generated && trip.days.some((d) => d.items.length)) return 'itinerary';
  if (!trip.preferences?.[me]) return 'preferences';
  if (!(trip.doneChoosing ?? []).includes(me)) return 'discover';
  return 'group';
}

/** 35 Trip overview. */
function Overview({ h }: { h: TripHook }) {
  const router = useRouter();
  const { trip } = h;
  const names = useFirstNames();
  const places = usePlaces(trip.mustDoPlaceIds);
  const people = travelers(trip);
  const days = plannedDates(trip.startDate, trip.endDate).length;
  const built = trip.generated && trip.days.some((d) => d.items.length);
  const go = (path: string) => router.push(`/trip/${trip.id}${path}` as never);
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar
        title="Your trip"
        right={(
          <Pressable accessibilityRole="button" accessibilityLabel="Trip settings" onPress={() => go('/settings')} hitSlop={board.inlineGap}>
            <MoreHorizontal size={icon.lg} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
          </Pressable>
        )}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Cover event={trip} style={styles.cover} />
        <View style={styles.titleRow}>
          <Text style={styles.h1} numberOfLines={2}>{trip.title}</Text>
          <View style={styles.pill}><Text style={styles.pillText}>{built ? 'Itinerary ready' : 'Planning'}</Text></View>
        </View>
        <Text style={styles.small}>{`${dateRange(trip.startDate, trip.endDate)} · ${people.length} ${people.length === 1 ? 'traveler' : 'travelers'}`}</Text>
        <View style={styles.peopleRow}>
          <AvatarStack names={people.map((p) => names.people.byId.get(p)?.displayName ?? '')} />
          <Text style={styles.small}>{`${readyCount(trip)} of ${people.length} travelers ready`}</Text>
        </View>
        <Button label="Continue planning" onPress={() => go(`/${nextStep(h)}`)} />
        <Row icon={<CalendarDays size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />} title="Itinerary" body={`${days} ${days === 1 ? 'day' : 'days'} · ${built ? 'Draft ready' : 'Not built yet'}`} onPress={() => go(built ? '/itinerary' : '/group')} />
        <Row icon={<Users size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />} title="People" body={names.join(people)} onPress={() => go('/people')}>
          <View style={styles.stack}><AvatarStack names={people.map((p) => names.people.byId.get(p)?.displayName ?? '')} /></View>
        </Row>
        <Row icon={<Star size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />} title="Must-dos" body={`${trip.mustDoPlaceIds.length} ${trip.mustDoPlaceIds.length === 1 ? 'place' : 'places'}`}>
          {trip.mustDoPlaceIds.length ? (
            <View style={styles.thumbs}>
              {trip.mustDoPlaceIds.slice(0, 3).map((pid) => (
                <View key={pid} accessibilityLabel={places.get(pid)?.name} style={[styles.mustThumb, { backgroundColor: placeTint(places.get(pid)) }]} />
              ))}
            </View>
          ) : null}
        </Row>
        {trip.accommodation ? (
          <Row icon={<MapPin size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />} title={trip.accommodation.split(',')[0]!} body={trip.accommodation.split(',').slice(1).join(',').trim() || trip.destination} />
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => go('/today')} style={styles.today}>
          <Navigation size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
          <Text style={styles.link}>During your trip · Today</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon: glyph, title, body, onPress, children }: { icon: React.ReactNode; title: string; body: string; onPress?: () => void; children?: React.ReactNode }) {
  const inner = (
    <>
      <View style={styles.iconBox}>{glyph}</View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.small}>{body}</Text>
        {children}
      </View>
      {onPress ? <ChevronRight size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} /> : null}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${body}`} onPress={onPress} style={styles.row}>{inner}</Pressable>
  ) : <View style={styles.row}>{inner}</View>;
}

/** 12 Join trip. */
function Join({ h, onJoined }: { h: TripHook; onJoined: () => void }) {
  const router = useRouter();
  const { trip } = h;
  const names = useFirstNames();
  const [menu, setMenu] = React.useState(false);
  const invite = trip.invites?.find((i) => i.personId === h.me);
  const people = travelers(trip);
  const answer = async (a: 'join' | 'decline') => {
    setMenu(false);
    const ok = await h.run(() => h.services.trips.respond(trip.id, a));
    if (!ok) return;
    if (a === 'join') onJoined(); // S07, once the join is saved
    else router.replace('/(tabs)');
  };
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar
        title="A Voya invitation"
        right={(
          <Pressable accessibilityRole="button" accessibilityLabel="Invitation options" onPress={() => setMenu(true)} hitSlop={board.inlineGap}>
            <MoreHorizontal size={icon.lg} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
          </Pressable>
        )}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Cover event={trip} style={styles.joinCover} />
        <View style={styles.center}>
          <Text style={styles.eyebrow}>A FEW DAYS AWAY, TOGETHER</Text>
          <Text style={styles.joinTitle}>{`You're invited\nto ${trip.destination}`}</Text>
          <Text style={styles.when}>{dateRange(trip.startDate, trip.endDate)}</Text>
          {invite ? <Text style={styles.small}>{`${names.first(invite.invitedBy)} invited you`}</Text> : null}
          <View style={styles.stackCenter}><AvatarStack names={people.map((p) => names.people.byId.get(p)?.displayName ?? '')} /></View>
          <Text style={styles.small}>{`${people.length} ${people.length === 1 ? 'traveler' : 'travelers'}`}</Text>
        </View>
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={styles.spacer} />
        <Button label="Join trip" onPress={() => void answer('join')} loading={h.busy} />
        <Text style={styles.foot}>Next, we’ll learn what you like so the itinerary works for everyone.</Text>
      </ScrollView>
      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <Text style={sheetText.title}>{`Not going to ${trip.destination}?`}</Text>
        <Text style={sheetText.body}>The trip goes on without you. You won’t see it unless you’re invited again.</Text>
        <SettingsRow danger title="Decline invitation" onPress={() => void answer('decline')} />
        <Button label="Cancel" variant="ghost" onPress={() => setMenu(false)} />
      </BottomSheet>
    </Screen>
  );
}

/** T05 Completed trip. */
function Completed({ h }: { h: TripHook }) {
  const router = useRouter();
  const { trip } = h;
  const names = useFirstNames();
  const places = usePlaces(trip.days.flatMap((d) => d.items.map((i) => i.placeId).filter((x): x is string => !!x)));
  const people = travelers(trip);
  const nights = trip.startDate && trip.endDate ? nightsBetween(trip.startDate, trip.endDate) : 0;
  const year = trip.endDate ? formatDay(trip.endDate, { year: 'numeric' }) : '';
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title={trip.title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Cover event={trip} style={styles.pastCover} />
        <View style={[styles.pill, styles.pillStart]}><Text style={styles.pillText}>{trip.lifecycle === 'cancelled' ? 'Trip cancelled' : 'Trip complete'}</Text></View>
        <Text style={styles.h1}>{trip.title}</Text>
        <Text style={styles.small}>{`${dateRange(trip.startDate, trip.endDate)} ${year} · ${people.length} travelers · ${Math.max(1, nights)} days`}</Text>
        <View style={styles.peopleRow}><AvatarStack names={people.map((p) => names.people.byId.get(p)?.displayName ?? '')} /></View>
        {trip.days.map((d, i) => {
          const stops = d.items.map((it) => (it.placeId ? places.get(it.placeId)?.name : undefined) ?? it.subtitle ?? it.title);
          return (
            <View key={d.date} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{`Day ${i + 1}`}</Text>
              <View style={styles.lineCol}>
                <View style={styles.dot} />
                {i < trip.days.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{d.title ?? formatDay(d.date, { weekday: 'long' })}</Text>
                <Text style={styles.small} numberOfLines={2}>{stops.length ? [...new Set(stops)].join(' · ') : 'A free day'}</Text>
              </View>
            </View>
          );
        })}
        <View style={styles.spacer} />
        <Button label="Plan another trip" onPress={() => router.push('/trip/new')} />
        <Button label="Places you saved" variant="ghost" onPress={() => router.push('/saved')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  flex: { flex: 1 },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  center: { alignItems: 'center' },
  cover: { height: T.covers.overview, marginBottom: board.listRow.paddingY },
  joinCover: { height: T.covers.join, marginBottom: E.weddingCover.marginBottom },
  pastCover: { height: T.covers.past, marginBottom: E.shareCover.marginBottom },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: board.inlineGap },
  h1: { ...board.h1, color: colors.brand.plum, flexShrink: 1 },
  pill: { backgroundColor: E.miniPill.background, borderRadius: E.miniPill.radius, paddingVertical: E.miniPill.paddingY, paddingHorizontal: E.miniPill.paddingX },
  pillStart: { alignSelf: 'flex-start', marginBottom: E.miniPill.marginBottom },
  pillText: { fontSize: E.miniPill.fontSize, color: colors.brand.violet, fontWeight: '600' },
  small: { ...board.small, color: colors.text.secondary },
  peopleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: board.listRow.paddingY },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: board.settings.row.gap, paddingVertical: board.listRow.paddingY,
    borderBottomWidth: 1, borderBottomColor: board.settings.row.border,
  },
  iconBox: { width: T.overviewIcon.size, height: T.overviewIcon.size, borderRadius: T.overviewIcon.radius, backgroundColor: board.hangout.selection.background, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: board.settings.row.titleSize, fontWeight: '700', color: colors.brand.plum },
  stack: { marginTop: board.inlineGap },
  thumbs: { flexDirection: 'row', gap: T.mustThumb.gap, marginTop: board.inlineGap },
  mustThumb: { width: T.mustThumb.width, height: T.mustThumb.height, borderRadius: T.mustThumb.radius },
  today: { flexDirection: 'row', alignItems: 'center', gap: board.inlineGap, paddingVertical: board.listRow.paddingY },
  link: { fontSize: board.subtleControl.fontSize, color: colors.brand.violet },
  eyebrow: { ...board.home.eyebrow, color: colors.brand.violet, textAlign: 'center' },
  joinTitle: { ...board.h1, color: colors.brand.plum, textAlign: 'center', marginVertical: board.inlineGap },
  when: { fontSize: board.hangout.formRow.fontSize, color: colors.brand.plum, marginBottom: board.inlineGap },
  stackCenter: { marginVertical: board.listRow.paddingY },
  foot: { ...board.tinyCenter, textAlign: 'center', marginTop: board.listRow.paddingY },
  error: { ...board.small, color: colors.status.danger, textAlign: 'center' },
  dayRow: { flexDirection: 'row', gap: board.hangout.stop.gap, minHeight: board.hangout.stop.minHeight },
  dayLabel: { width: board.hangout.stop.timeWidth, fontSize: board.hangout.stop.timeSize, color: board.hangout.stop.timeColor, paddingTop: board.hangout.stop.timePaddingTop },
  lineCol: { width: board.hangout.stop.lineWidth, alignItems: 'center' },
  dot: { width: board.hangout.stop.dot, height: board.hangout.stop.dot, borderRadius: board.hangout.stop.dot / 2, backgroundColor: colors.brand.lavender, marginTop: board.hangout.stop.dotMarginTop },
  line: { flex: 1, width: 1, backgroundColor: board.hangout.stop.lineColor },
});
