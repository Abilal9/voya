import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { PHOTO_TINT } from '@/features/explore/PlaceCard';
import { usePeople } from '@/features/catalog';
import { durationLabel, hhmm } from '@/services/tripRules';
import type { Place, TripItem } from '@/services';
import { board, colors, icon } from '@/theme';

const T = board.trip;
const H = board.hangout;

export const placeTint = (place?: Place) => (place?.photo ? PHOTO_TINT[place.photo] : undefined) ?? board.explore.card.placeholder;

/** Board top-bar progress dashes for the creation steps (03–06). */
export function StepDashes({ step, of = 4 }: { step: number; of?: number }) {
  return (
    <View style={styles.dashes} accessibilityLabel={`Step ${step} of ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <View key={i} style={[styles.dash, { backgroundColor: i < step ? colors.brand.violet : T.dashes.off }]} />
      ))}
    </View>
  );
}

/** First names joined board-style: "Ahmad, Khaled, Omar & Faisal". */
export function useFirstNames() {
  const people = usePeople();
  const first = React.useCallback((id: string) => people.byId.get(id)?.firstName ?? 'Former traveler', [people.byId]);
  const join = React.useCallback((ids: string[]) => {
    const names = ids.map(first);
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0] ?? '';
  }, [first]);
  return { people, first, join };
}

/**
 * Board `.timeline` for a trip day (09, 36, T05): time, dot and line, title,
 * place or note. The board's walking times between stops aren't shown: there
 * is no routing yet, so they would be made up.
 */
export function DayTimeline({ items, places, onPress, compact }: {
  items: TripItem[]; places: Map<string, Place>; onPress?: (item: TripItem) => void; compact?: boolean;
}) {
  return (
    <View>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const place = item.placeId ? places.get(item.placeId) : undefined;
        const sub = item.kind === 'meal' ? (place?.name ?? item.subtitle) : item.kind === 'activity' ? (durationLabel(item.durationMinutes) || place?.type) : item.subtitle;
        const body = (
          <>
            <Text style={styles.time}>{hhmm(item.startsAt)}</Text>
            <View style={styles.lineCol}>
              <View style={styles.dot} />
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, styles.shrink]} numberOfLines={2}>{item.title}</Text>
                {item.locked ? <Lock size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} accessibilityLabel="Locked" /> : null}
              </View>
              {sub ? <Text style={styles.body} numberOfLines={1}>{sub}</Text> : null}
              {item.replaceRequests?.length ? <Text style={styles.flag}>{`${item.replaceRequests.length} replacement ${item.replaceRequests.length === 1 ? 'suggestion' : 'suggestions'}`}</Text> : null}
            </View>
          </>
        );
        return onPress ? (
          <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${hhmm(item.startsAt)} ${item.title}. Options`} onPress={() => onPress(item)} style={[styles.stop, compact && styles.compact]}>
            {body}
          </Pressable>
        ) : (
          <View key={item.id} style={[styles.stop, compact && styles.compact]}>{body}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: board.inlineGap / 2 },
  dashes: { flexDirection: 'row', gap: T.dashes.gap },
  dash: { width: T.dashes.width, height: T.dashes.height, borderRadius: T.dashes.height },
  stop: { flexDirection: 'row', gap: H.stop.gap, minHeight: board.event.eventStop.minHeight },
  compact: { minHeight: H.stop.minHeight },
  time: { width: H.stop.timeWidth, fontSize: H.stop.timeSize, color: H.stop.timeColor, paddingTop: H.stop.timePaddingTop, fontVariant: ['tabular-nums'] },
  lineCol: { width: H.stop.lineWidth, alignItems: 'center' },
  dot: { width: H.stop.dot, height: H.stop.dot, borderRadius: H.stop.dot / 2, backgroundColor: colors.brand.lavender, marginTop: H.stop.dotMarginTop },
  line: { flex: 1, width: 1, backgroundColor: H.stop.lineColor },
  title: { fontSize: H.stop.titleSize, fontWeight: '700', color: colors.brand.plum, marginBottom: H.stop.titleMarginBottom },
  body: { fontSize: H.stop.bodySize, color: H.stop.bodyColor, marginBottom: board.event.stopTextMarginBottom },
  flag: { fontSize: H.stop.bodySize, color: colors.brand.violet, marginBottom: board.event.stopTextMarginBottom },
});
