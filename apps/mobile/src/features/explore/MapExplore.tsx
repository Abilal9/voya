import * as React from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import {
  Check, Coffee, Heart, Landmark, Moon, ShoppingBag, Sparkles, Trees, Trophy, Utensils, X, type LucideIcon,
} from 'lucide-react-native';
import { Text } from '@/components/ui';
import type { Place, PlaceCategory } from '@/services';
import { board, colors, icon, shadow } from '@/theme';
import { PHOTO_TINT, ratingLine } from './PlaceCard';

const M = board.map;

const CATEGORY_ICON: Record<PlaceCategory, LucideIcon> = {
  Food: Utensils, Coffee, Dessert: Sparkles, Activities: Trophy, Culture: Landmark,
  Shopping: ShoppingBag, Nature: Trees, Nightlife: Moon, Experiences: Sparkles,
};

/** Region that fits every pin, or the city centre when there are none. */
export function regionFor(places: Place[], center: { latitude: number; longitude: number } | null): Region | undefined {
  const pts = places.map((p) => p.coordinates).filter((c): c is NonNullable<typeof c> => !!c);
  if (pts.length === 0) {
    return center ? { ...center, latitudeDelta: 0.12, longitudeDelta: 0.12 } : undefined;
  }
  const lats = pts.map((c) => c.latitude);
  const lons = pts.map((c) => c.longitude);
  const pad = 1.6;
  return {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    latitudeDelta: Math.max(0.02, (Math.max(...lats) - Math.min(...lats)) * pad),
    longitudeDelta: Math.max(0.02, (Math.max(...lons) - Math.min(...lons)) * pad),
  };
}

interface Props {
  places: Place[];
  center: { latitude: number; longitude: number } | null;
  isSaved: (id: string) => boolean;
  onToggleSave: (place: Place) => void;
  onSignal: (place: Place, signal: 'like' | 'dislike') => void;
  onOpen: (place: Place) => void;
  /** Overlays drawn above the map (location row, chips). */
  header: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * E05 Map view / E06 Map marker + place preview — board figures "E05", "E06".
 * Apple Maps on iOS through react-native-maps (bundled in Expo Go, no key or
 * paid provider). Pins and the preview carousel stay in sync: tapping a pin
 * scrolls the carousel, swiping the carousel selects the pin.
 * The board's custom illustrated basemap is not reproduced; the OS map is used.
 */
export function MapExplore({ places, center, isSaved, onToggleSave, onSignal, onOpen, header, footer }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = width - M.preview.x * 2;
  const pinned = React.useMemo(() => places.filter((p) => p.coordinates), [places]);
  const [selected, setSelected] = React.useState<number | null>(null);
  const list = React.useRef<FlatList<Place>>(null);
  const region = React.useMemo(() => regionFor(pinned, center), [pinned, center]);

  // A new result set (city, filters) clears the selection.
  React.useEffect(() => setSelected(null), [pinned]);

  // Custom marker views must be laid out before iOS snapshots them, or they
  // clip. Track changes briefly after pins or selection change, then freeze.
  const [tracking, setTracking] = React.useState(true);
  React.useEffect(() => {
    setTracking(true);
    const t = setTimeout(() => setTracking(false), 600);
    return () => clearTimeout(t);
  }, [pinned, selected]);

  const select = (i: number) => {
    setSelected(i);
    requestAnimationFrame(() => list.current?.scrollToIndex({ index: i, animated: true }));
  };

  return (
    <View style={styles.root}>
      <MapView
        key={region ? `${region.latitude},${region.longitude}` : 'none'}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onPress={(e) => {
          if (e.nativeEvent.action !== 'marker-press') setSelected(null);
        }}
        showsPointsOfInterest={false}
        accessibilityLabel="Map of places"
      >
        {pinned.map((p, i) => {
          const Icon = CATEGORY_ICON[p.category];
          const on = i === selected;
          const tone = on ? colors.text.inverse : colors.brand.plum;
          return (
            <Marker
              key={p.id}
              coordinate={p.coordinates!}
              onPress={() => select(i)}
              accessibilityLabel={p.name}
              tracksViewChanges={tracking}
              zIndex={on ? 3 : 2}
            >
              <View collapsable={false} style={styles.pinRoom}>
                <View style={[styles.pin, on && styles.pinOn]}>
                  <Icon size={M.pin.icon} color={tone} strokeWidth={icon.strokeWidth} />
                  {p.price ? <Text style={[styles.pinText, { color: tone }]}>{p.price}</Text> : null}
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.controls} pointerEvents="box-none">{header}</View>

      {selected === null ? (
        <View style={styles.label} pointerEvents="none">
          <Text style={styles.labelText}>
            {pinned.length === 0
              ? 'No places to show here yet'
              : `${pinned.length} ${pinned.length === 1 ? 'place' : 'places'} to discover · Tap a pin`}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={list}
          data={pinned}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          snapToInterval={cardWidth + M.preview.x}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={selected}
          getItemLayout={(_, i) => ({ length: cardWidth + M.preview.x, offset: (cardWidth + M.preview.x) * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + M.preview.x));
            if (i >= 0 && i < pinned.length) setSelected(i);
          }}
          style={styles.carousel}
          contentContainerStyle={{ paddingHorizontal: M.preview.x / 2 }}
          renderItem={({ item: p, index }) => (
            <View style={[styles.preview, { width: cardWidth, marginHorizontal: M.preview.x / 2 }]}>
              <Text style={styles.counter}>{`${index + 1}/${pinned.length}`}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`${p.name}. Open details`} onPress={() => onOpen(p)} style={styles.previewRow}>
                <View style={[styles.thumb, { backgroundColor: PHOTO_TINT[p.photo ?? ''] ?? board.explore.card.placeholder }]} />
                <View style={styles.previewText}>
                  <Text style={styles.previewTitle} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.previewLine} numberOfLines={1}>
                    {[p.type?.split(' · ')[0], p.price].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.previewLine} numberOfLines={1}>
                    {[ratingLine(p).split('  ·  ')[0], p.area].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Choice label="Not for me" background={board.explore.actions.skipBackground} onPress={() => onSignal(p, 'dislike')}>
                  <X size={M.preview.roundIcon} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
                </Choice>
                <Choice
                  label="Save"
                  background={isSaved(p.id) ? colors.brand.peach : board.explore.actions.saveBackground}
                  onPress={() => onToggleSave(p)}
                >
                  <Heart
                    size={M.preview.roundIcon}
                    color={isSaved(p.id) ? colors.brand.plum : board.explore.actions.saveColor}
                    fill={isSaved(p.id) ? colors.brand.plum : 'transparent'}
                    strokeWidth={icon.strokeWidth}
                  />
                </Choice>
                <Choice label="I like this" background={colors.brand.peach} onPress={() => onSignal(p, 'like')}>
                  <Check size={M.preview.roundIcon} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
                </Choice>
              </View>
            </View>
          )}
        />
      )}

      <View style={styles.footer} pointerEvents="box-none">{footer}</View>
    </View>
  );
}

function Choice({ label, background, onPress, children }: {
  label: string; background: string; onPress: () => void; children: React.ReactNode;
}) {
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
  root: { flex: 1 },
  controls: { position: 'absolute', top: M.controlsTop, left: M.controlsX, right: M.controlsX },
  // Room around the pin so its shadow is not cut off by the marker snapshot.
  pinRoom: { width: M.pin.boxWidth, height: M.pin.boxHeight, alignItems: 'center', justifyContent: 'center' },
  pin: {
    flexDirection: 'row', alignItems: 'center', gap: M.pin.gap, backgroundColor: colors.surface.base,
    borderRadius: M.pin.radius, paddingVertical: M.pin.paddingY, paddingHorizontal: M.pin.paddingX, ...shadow.card,
  },
  pinOn: { backgroundColor: colors.brand.plum },
  pinText: { fontSize: M.pin.fontSize },
  label: {
    position: 'absolute', bottom: M.label.bottom, alignSelf: 'center', backgroundColor: colors.surface.base,
    borderRadius: M.label.radius, paddingVertical: M.label.paddingY, paddingHorizontal: M.label.paddingX, ...shadow.card,
  },
  labelText: { fontSize: M.label.fontSize, color: colors.brand.plum },
  carousel: { position: 'absolute', left: 0, right: 0, bottom: M.preview.bottom, flexGrow: 0 },
  preview: { backgroundColor: colors.surface.base, borderRadius: M.preview.radius, padding: M.preview.padding, ...shadow.floating },
  counter: { position: 'absolute', top: M.preview.padding, right: M.preview.padding, fontSize: M.preview.counterSize, color: M.preview.counterColor },
  previewRow: { flexDirection: 'row', gap: board.inlineGap },
  thumb: { width: M.preview.thumbWidth, height: M.preview.thumbHeight, borderRadius: M.preview.thumbRadius },
  previewText: { flex: 1, paddingRight: board.listRow.paddingY * 2 },
  previewTitle: { fontSize: M.preview.titleSize, fontWeight: '700', color: colors.brand.plum, marginBottom: M.preview.titleMarginBottom },
  previewLine: { fontSize: M.preview.lineSize, color: M.preview.lineColor, marginBottom: board.inlineGap / 2.5 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: M.preview.actionsGap, marginTop: M.preview.actionsMarginTop },
  choice: { alignItems: 'center', gap: M.preview.labelGap },
  round: { width: M.preview.round, height: M.preview.round, borderRadius: M.preview.round / 2, alignItems: 'center', justifyContent: 'center' },
  choiceLabel: { fontSize: M.preview.labelSize, color: board.explore.actions.labelColor },
  footer: { position: 'absolute', bottom: M.toggleBottom, left: 0, right: 0, alignItems: 'center' },
});
