import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { ChevronLeft } from 'lucide-react-native';
import { EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { Segments } from '@/features/event/EventParts';
import { regionFor } from '@/features/explore/MapExplore';
import { usePlaces } from '@/features/hangout/usePlaces';
import { placeTint } from '@/features/trip/TripParts';
import { useTrip } from '@/features/trip/useTrip';
import { hhmm } from '@/services/tripRules';
import type { Place } from '@/services';
import { board, colors, icon, layout } from '@/theme';

const T = board.trip;

/**
 * T06 Itinerary map. Numbered pins follow the day's order and the selected
 * pin's stop shows below. The dashed line only joins the stops in order: it is
 * not a route, and no travel times are shown (there is no routing yet).
 * Apple Maps replaces the board's illustrated basemap.
 */
export default function TripMap() {
  const { id, day: dayParam } = useLocalSearchParams<{ id: string; day?: string }>();
  const router = useRouter();
  const h = useTrip(id);
  const trip = h.trip;
  const places = usePlaces(trip?.days.flatMap((d) => d.items.map((i) => i.placeId).filter((x): x is string => !!x)) ?? []);
  const [day, setDay] = React.useState(Number(dayParam ?? 0) || 0);
  const [selected, setSelected] = React.useState(0);
  const [tracking, setTracking] = React.useState(true);
  React.useEffect(() => {
    setTracking(true);
    setSelected(0);
    const t = setTimeout(() => setTracking(false), 600);
    return () => clearTimeout(t);
  }, [day, places.size]);

  if (h.isPending) return <Screen><LoadingState /></Screen>;
  if (!trip || h.relation !== 'member') return <Screen><TopBar /><EmptyState title="This trip isn’t available" /></Screen>;
  const labels = trip.days.map((_, i) => `Day ${i + 1}`);
  const current = trip.days[Math.min(day, trip.days.length - 1)];
  const stops = (current?.items ?? [])
    .map((item) => ({ item, place: item.placeId ? places.get(item.placeId) : undefined }))
    .filter((s): s is { item: typeof s.item; place: Place } => !!s.place?.coordinates);
  const missing = (current?.items.length ?? 0) - stops.length;
  const region = regionFor(stops.map((s) => s.place), null);
  const focus = stops[selected];

  return (
    <View style={styles.root}>
      {region ? (
        <MapView key={`${day}-${stops.length}`} style={StyleSheet.absoluteFill} initialRegion={region} showsPointsOfInterest={false} accessibilityLabel="Map of the day's stops">
          <Polyline coordinates={stops.map((s) => s.place.coordinates!)} strokeColor={colors.brand.violet} strokeWidth={T.routeLine.width} lineDashPattern={[...T.routeLine.dash]} />
          {stops.map((s, i) => (
            <Marker key={s.item.id} coordinate={s.place.coordinates!} onPress={() => setSelected(i)} tracksViewChanges={tracking} accessibilityLabel={`Stop ${i + 1}, ${s.place.name}`} zIndex={i === selected ? 3 : 2}>
              <View collapsable={false} style={[styles.marker, i === selected && styles.markerOn]}>
                <Text style={[styles.markerText, i === selected && styles.markerTextOn]}>{String(i + 1)}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      ) : null}
      <SafeAreaView edges={['top']} style={styles.top}>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/trip/${trip.id}`))} hitSlop={layout.minTouchTarget / 4}>
            <ChevronLeft size={icon.lg} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
          </Pressable>
          <Text style={styles.barTitle}>{`${trip.destination} · Itinerary`}</Text>
          <View style={styles.barSide} />
        </View>
        {labels.length > 1 ? <View style={styles.tabs}><Segments items={labels} value={labels[Math.min(day, labels.length - 1)]!} onChange={(l) => setDay(labels.indexOf(l))} /></View> : null}
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        <View style={styles.card}>
          {focus ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${focus.place.name}. Open details`} onPress={() => router.push(`/place/${focus.place.id}`)} style={styles.cardRow}>
              <View style={[styles.thumb, { backgroundColor: placeTint(focus.place) }]} />
              <View style={styles.flex}>
                <Text style={styles.small}>{`Stop ${selected + 1} · ${hhmm(focus.item.startsAt)}`}</Text>
                <Text style={styles.name} numberOfLines={2}>{focus.place.name}</Text>
                <Text style={styles.small}>{focus.item.kind === 'meal' ? focus.item.title : focus.place.type ?? ''}</Text>
              </View>
            </Pressable>
          ) : (
            <Text style={styles.name}>No stops with a location on this day.</Text>
          )}
          <Text style={styles.foot}>
            {`Day ${day + 1} · ${stops.length} ${stops.length === 1 ? 'stop' : 'stops'}${missing > 0 ? ` · ${missing} without a location` : ''} · Tap a number to preview`}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base },
  flex: { flex: 1 },
  top: { position: 'absolute', left: board.screenPaddingX, right: board.screenPaddingX, top: 0 },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface.base,
    borderRadius: board.segment.radius, paddingHorizontal: board.inlineGap, minHeight: layout.minTouchTarget,
  },
  barTitle: { fontSize: board.topBar.fontSize, color: colors.text.secondary },
  barSide: { width: icon.lg },
  tabs: { backgroundColor: colors.surface.base, borderRadius: board.segment.radius, marginTop: board.inlineGap },
  bottom: { position: 'absolute', left: board.screenPaddingX, right: board.screenPaddingX, bottom: 0 },
  card: { backgroundColor: colors.surface.base, borderRadius: T.mapCard.radius, padding: T.mapCard.padding, marginBottom: board.inlineGap },
  cardRow: { flexDirection: 'row', gap: board.listRow.paddingY },
  thumb: { width: T.mapCard.thumb, height: T.mapCard.thumb, borderRadius: board.thumb.radius },
  name: { fontSize: board.home.rowTitle.fontSize, fontWeight: '700', color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  foot: { ...board.tinyCenter, textAlign: 'center', marginTop: board.inlineGap },
  marker: {
    width: T.mapMarker.size, height: T.mapMarker.size, borderRadius: T.mapMarker.size / 2, backgroundColor: colors.surface.base,
    alignItems: 'center', justifyContent: 'center',
  },
  markerOn: { backgroundColor: colors.brand.violet },
  markerText: { fontSize: T.mapMarker.fontSize, fontWeight: '700', color: colors.brand.plum },
  markerTextOn: { color: colors.text.inverse },
});
