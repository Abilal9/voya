import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { PHOTO_TINT } from '@/features/explore/PlaceCard';
import type { Place, TimelineItem } from '@/services';
import { board, colors } from '@/theme';

const H = board.hangout;

export const time24 = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function whenLabel(iso?: string) {
  if (!iso) return 'Choose a time';
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: 'long' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

/** Board "Friday Night": a default name from the day and time. */
export function defaultTitle(iso: string) {
  const d = new Date(iso);
  const part = d.getHours() >= 17 ? 'Night' : d.getHours() >= 12 ? 'Afternoon' : 'Morning';
  return `${d.toLocaleDateString(undefined, { weekday: 'long' })} ${part}`;
}

export const tintFor = (place?: Place) => (place?.photo ? PHOTO_TINT[place.photo] : undefined) ?? board.explore.card.placeholder;

/** Board `.stop` timeline (16, H05): time, dot and line, title, place, optional photo. */
export function Timeline({ items, places, withPhotos, onOpenPlace }: {
  items: TimelineItem[]; places: Map<string, Place>; withPhotos?: boolean; onOpenPlace?: (id: string) => void;
}) {
  return (
    <View>
      {items.map((item, i) => {
        const place = item.placeId ? places.get(item.placeId) : undefined;
        const last = i === items.length - 1;
        return (
          <View key={item.id} style={styles.stop}>
            <Text style={styles.time}>{time24(item.startsAt)}</Text>
            <View style={styles.lineCol}>
              <View style={styles.dot} />
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.stopBody}>
              <Text style={styles.stopTitle}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.stopText}>{item.subtitle}</Text> : null}
              {withPhotos && place ? (
                <Pressable
                  accessibilityRole="button" accessibilityLabel={`${place.name}. Open details`}
                  onPress={() => onOpenPlace?.(place.id)}
                  style={[styles.stopPhoto, { backgroundColor: tintFor(place) }]}
                />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Board `.steps` (14): numbered slots with the current one highlighted. */
export function SlotSteps({ slots, current, states }: { slots: string[]; current?: string; states: Record<string, string> }) {
  return (
    <View style={styles.steps}>
      {slots.map((slot, i) => (
        <View key={slot} style={[styles.step, slot === current && styles.stepOn]}>
          <Text style={styles.stepText} numberOfLines={1}>{`${i + 1}  ${slot}`}</Text>
          <Text style={styles.stepText} numberOfLines={1}>{states[slot]}</Text>
        </View>
      ))}
    </View>
  );
}

/** Board `.pill`. */
export function Pill({ label, tone = 'violet' }: { label: string; tone?: 'violet' | 'plum' }) {
  return (
    <View style={styles.pill}>
      <Text style={[styles.pillText, tone === 'plum' && { color: colors.brand.plum }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stop: { flexDirection: 'row', gap: H.stop.gap, minHeight: H.stop.minHeight },
  time: { width: H.stop.timeWidth, fontSize: H.stop.timeSize, color: H.stop.timeColor, paddingTop: H.stop.timePaddingTop },
  lineCol: { width: H.stop.lineWidth, alignItems: 'center' },
  dot: { width: H.stop.dot, height: H.stop.dot, borderRadius: H.stop.dot / 2, backgroundColor: colors.brand.lavender, marginTop: H.stop.dotMarginTop },
  line: { flex: 1, width: 1, backgroundColor: H.stop.lineColor, marginTop: H.stop.timePaddingTop },
  stopBody: { flex: 1, paddingBottom: board.listRow.paddingY },
  stopTitle: { fontSize: H.stop.titleSize, fontWeight: '700', color: colors.brand.plum, marginBottom: H.stop.titleMarginBottom },
  stopText: { fontSize: H.stop.bodySize, color: H.stop.bodyColor },
  stopPhoto: { height: H.stop.photoHeight, borderRadius: H.stop.photoRadius, marginTop: H.stop.photoMarginTop },
  steps: { flexDirection: 'row', gap: H.steps.gap, marginTop: H.steps.marginTop, marginBottom: H.steps.marginBottom },
  step: { flex: 1, backgroundColor: H.steps.background, borderRadius: H.steps.radius, paddingVertical: H.steps.paddingY, paddingHorizontal: H.steps.paddingX },
  stepOn: { backgroundColor: colors.brand.lavender },
  stepText: { fontSize: H.steps.fontSize, color: colors.brand.plum },
  pill: {
    alignSelf: 'flex-start', paddingVertical: board.place.pill.paddingY, paddingHorizontal: board.place.pill.paddingX,
    borderRadius: board.place.pill.radius, backgroundColor: board.place.pill.background,
  },
  pillText: { fontSize: board.place.pill.fontSize, fontWeight: '600', color: colors.brand.violet },
});
