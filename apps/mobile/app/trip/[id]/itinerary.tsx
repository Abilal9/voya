import * as React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MoreHorizontal } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { authStyles } from '@/features/auth/AuthParts';
import { Segments } from '@/features/event/EventParts';
import { usePlaces } from '@/features/hangout/usePlaces';
import { BottomSheet, SettingsRow, Switch, sheetText } from '@/features/settings/SettingsParts';
import { DayTimeline, placeTint } from '@/features/trip/TripParts';
import { useTrip, type TripHook } from '@/features/trip/useTrip';
import { dateRange, durationLabel, formatDay, hhmm, interestedIn, minutesOf, travelers } from '@/services/tripRules';
import type { TripItem } from '@/services';
import { board, colors, icon } from '@/theme';

const T = board.trip;
const DURATIONS = [30, 45, 60, 90, 120, 150, 180, 240];

/**
 * 09 Generated itinerary with 10 Activity controls as a sheet. Everyone on
 * the trip sees the same days; only the organizer edits (the service refuses
 * edits from anyone else). Travelers can suggest a replacement instead (11).
 */
export default function Itinerary() {
  const { id, day: dayParam } = useLocalSearchParams<{ id: string; day?: string }>();
  const router = useRouter();
  const h = useTrip(id);
  const trip = h.trip;
  const places = usePlaces(trip?.days.flatMap((d) => d.items.map((i) => i.placeId).filter((x): x is string => !!x)) ?? []);
  const [day, setDay] = React.useState(Number(dayParam ?? 0) || 0);
  const [item, setItem] = React.useState<TripItem | null>(null);
  const [sheet, setSheet] = React.useState<'menu' | 'rebuild' | null>(null);

  if (h.isPending) return <Screen><LoadingState /></Screen>;
  if (!trip || h.relation !== 'member') return <Screen><TopBar /><EmptyState title="This trip isn’t available" /></Screen>;
  const hh: TripHook = { ...h, trip };
  const built = trip.generated && trip.days.length > 0;
  const labels = trip.days.map((_, i) => `Day ${i + 1}`);
  const current = trip.days[Math.min(day, trip.days.length - 1)];
  const others = travelers(trip).length - 1;
  // Keep the open sheet on the canonical item after every refresh.
  const live = item ? trip.days.flatMap((d) => d.items).find((i) => i.id === item.id) ?? null : null;

  const rebuild = async () => {
    setSheet(null);
    await h.run(() => h.services.trips.generateItinerary(trip.id, { rebuild: true }));
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar
        title="Your shared trip"
        right={(
          <Pressable accessibilityRole="button" accessibilityLabel="Trip options" onPress={() => setSheet('menu')} hitSlop={board.inlineGap}>
            <MoreHorizontal size={icon.lg} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
          </Pressable>
        )}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={styles.h1} numberOfLines={1}>{trip.title}</Text>
          {others > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${others} other travelers`} onPress={() => router.push(`/trip/${trip.id}/people`)} style={styles.badge}>
              <Text style={styles.badgeText}>{`+${others}`}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.small}>{`${dateRange(trip.startDate, trip.endDate)} · ${trip.days.length} planned ${trip.days.length === 1 ? 'day' : 'days'}`}</Text>
        {!built ? (
          <EmptyState
            title="No itinerary yet"
            body={h.canBuild ? 'Build it from the group’s picks when everyone is ready.' : 'The organizer builds it when the group is ready.'}
            actionLabel={h.canBuild ? 'Go to the group' : undefined}
            onAction={h.canBuild ? () => router.replace(`/trip/${trip.id}/group`) : undefined}
          />
        ) : (
          <>
            {labels.length > 1 ? <Segments items={labels} value={labels[Math.min(day, labels.length - 1)]!} onChange={(l) => setDay(labels.indexOf(l))} /> : null}
            <Text style={styles.intro}>{current?.title ? `${current.title} · ` : ''}{current ? formatDay(current.date, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}</Text>
            <Text style={styles.small}>Voya built this day from your group’s picks and must-dos.</Text>
            <View style={styles.gap} />
            {current && current.items.length ? (
              <DayTimeline items={current.items} places={places} onPress={setItem} />
            ) : (
              <Text style={styles.small}>Nothing planned for this day yet.</Text>
            )}
          </>
        )}
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={styles.spacer} />
        {built ? <Button label="View map" variant="secondary" onPress={() => router.push(`/trip/${trip.id}/map?day=${day}`)} /> : null}
      </ScrollView>

      <ActivitySheet h={hh} item={live} places={places} onClose={() => setItem(null)} />

      <BottomSheet visible={sheet === 'menu'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>{trip.title}</Text>
        <SettingsRow title="Today" onPress={() => { setSheet(null); router.push(`/trip/${trip.id}/today`); }} />
        <SettingsRow title="Trip settings" onPress={() => { setSheet(null); router.push(`/trip/${trip.id}/settings`); }} />
        {h.canBuild && built ? <SettingsRow title="Rebuild the itinerary" subtitle="Locked stops stay where they are" onPress={() => setSheet('rebuild')} /> : null}
        <Button label="Done" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'rebuild'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Rebuild the itinerary?</Text>
        <Text style={sheetText.body}>Locked stops stay exactly where they are. Every other stop, including your edits, is replaced with a fresh plan from the group’s picks.</Text>
        <Button label="Rebuild" onPress={() => void rebuild()} loading={h.busy} />
        <Button label="Keep this itinerary" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>
    </Screen>
  );
}

/** 10 Activity controls. */
function ActivitySheet({ h, item, places, onClose }: { h: TripHook; item: TripItem | null; places: Map<string, import('@/services').Place>; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<'main' | 'move' | 'duration' | 'remove'>('main');
  const [moveDay, setMoveDay] = React.useState(0);
  const [moveTime, setMoveTime] = React.useState(new Date());
  React.useEffect(() => { if (!item) setMode('main'); }, [item]);
  if (!item) return <BottomSheet visible={false} onClose={onClose}><View /></BottomSheet>;
  const { trip } = h;
  const place = item.placeId ? places.get(item.placeId) : undefined;
  const dayOf = trip.days.find((d) => d.items.some((i) => i.id === item.id));
  const interested = item.placeId ? interestedIn(trip, item.placeId).length : 0;
  const range = `${hhmm(item.startsAt)}${item.endsAt ? `–${hhmm(item.endsAt)}` : ''}${item.durationMinutes ? ` · ${durationLabel(item.durationMinutes)}` : ''}`;
  const edit = h.isOrganizer && !h.closed;
  const act = async (op: () => Promise<unknown>) => {
    const ok = await h.run(op);
    if (ok) { setMode('main'); if (mode === 'remove') onClose(); }
  };
  const labels = trip.days.map((_, i) => `Day ${i + 1}`);

  return (
    <BottomSheet visible onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.sheetHead}>
          <View style={styles.flex}>
            <Text style={sheetText.title}>{place?.name ?? item.title}</Text>
            <Text style={styles.small}>{range}</Text>
          </View>
          {place ? <View style={[styles.thumb, { backgroundColor: placeTint(place) }]} /> : null}
        </View>
        {item.placeId ? <Text style={styles.small}>{`${interested}/${travelers(trip).length} interested`}</Text> : null}
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        {mode === 'main' ? (
          <>
            {place ? <SettingsRow title="View place" onPress={() => { onClose(); router.push(`/place/${place.id}`); }} /> : null}
            {item.placeId ? (
              <SettingsRow
                title={edit ? 'Replace' : 'Suggest a replacement'}
                subtitle={edit && item.locked ? 'Unlock to replace' : item.replaceRequests?.length ? `${item.replaceRequests.length} waiting for a decision` : undefined}
                onPress={edit && item.locked ? undefined : () => { onClose(); router.push(`/trip/${trip.id}/decision?item=${item.id}`); }}
              />
            ) : null}
            {edit ? (
              <>
                <SettingsRow
                  title="Move" subtitle={item.locked ? 'Unlock to move' : undefined}
                  onPress={item.locked ? undefined : () => {
                    setMoveDay(Math.max(0, trip.days.indexOf(dayOf!)));
                    const m = minutesOf(item.startsAt, dayOf!.date);
                    const t = new Date(); t.setHours(Math.floor(m / 60) % 24, m % 60, 0, 0);
                    setMoveTime(t); setMode('move');
                  }}
                />
                <SettingsRow title="Change duration" subtitle={durationLabel(item.durationMinutes) || undefined} onPress={() => setMode('duration')} />
                <SettingsRow
                  title="Lock time" subtitle="Keep this activity fixed when Voya reorganizes the day."
                  right={<Switch label="Lock time" value={!!item.locked} onChange={() => void h.run(() => h.services.trips.toggleLock(trip.id, item.id))} />}
                />
                <SettingsRow danger title="Remove" subtitle={item.locked ? 'Unlock to remove' : undefined} onPress={item.locked ? undefined : () => setMode('remove')} />
              </>
            ) : null}
          </>
        ) : mode === 'move' ? (
          <>
            <Text style={styles.label}>Day</Text>
            <Segments items={labels} value={labels[moveDay]!} onChange={(l) => setMoveDay(labels.indexOf(l))} />
            <Text style={styles.label}>Start time</Text>
            <DateTimePicker value={moveTime} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} minuteInterval={15} onChange={(_, d) => d && setMoveTime(d)} textColor={colors.brand.plum} />
            <Button
              label="Move here" loading={h.busy}
              onPress={() => void act(() => h.services.trips.moveItem(trip.id, item.id, { date: trip.days[moveDay]!.date, minutes: moveTime.getHours() * 60 + moveTime.getMinutes() }))}
            />
            <Button label="Back" variant="ghost" onPress={() => setMode('main')} />
          </>
        ) : mode === 'duration' ? (
          <>
            <View style={styles.durations}>
              {DURATIONS.map((m) => (
                <Pressable key={m} accessibilityRole="button" accessibilityState={{ selected: m === item.durationMinutes }} onPress={() => void act(() => h.services.trips.setDuration(trip.id, item.id, m))} style={[styles.duration, m === item.durationMinutes && styles.durationOn]}>
                  <Text style={styles.durationText}>{durationLabel(m)}</Text>
                </Pressable>
              ))}
            </View>
            <Button label="Back" variant="ghost" onPress={() => setMode('main')} />
          </>
        ) : (
          <>
            <Text style={sheetText.body}>{`Remove ${place?.name ?? item.title} from ${dayOf ? formatDay(dayOf.date, { weekday: 'long' }) : 'this day'}? Everyone on the trip will see the change.`}</Text>
            <Button label="Remove" variant="danger" loading={h.busy} onPress={() => void act(() => h.services.trips.removeItem(trip.id, item.id))} />
            <Button label="Keep it" variant="ghost" onPress={() => setMode('main')} />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  flex: { flex: 1 },
  gap: { height: board.listRow.paddingY },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { ...board.h1, color: colors.brand.plum, flexShrink: 1 },
  badge: { width: T.badge.size, height: T.badge.size, borderRadius: T.badge.size / 2, backgroundColor: colors.brand.peach, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: T.badge.fontSize, fontWeight: '700', color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  intro: { ...board.small, color: colors.brand.plum, fontWeight: '600', marginTop: board.inlineGap },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: board.listRow.paddingY },
  thumb: { width: T.rowThumb.width, height: T.rowThumb.height, borderRadius: board.thumb.radius },
  label: { fontSize: board.field.labelSize, color: colors.text.secondary, marginTop: board.inlineGap },
  durations: { flexDirection: 'row', flexWrap: 'wrap', gap: T.chip.gap, marginVertical: board.listRow.paddingY },
  duration: { paddingVertical: board.inlineGap, paddingHorizontal: board.listRow.paddingY, borderRadius: T.chip.radius, borderWidth: 1, borderColor: T.chip.border },
  durationOn: { backgroundColor: T.chip.selectedBackground, borderColor: colors.brand.lavender },
  durationText: { fontSize: T.chip.fontSize, color: colors.brand.plum },
});
