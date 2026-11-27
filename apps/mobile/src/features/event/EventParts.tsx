import * as React from 'react';
import { Image, Linking, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@/components/ui';
import { PHOTO_TINT } from '@/features/explore/PlaceCard';
import { avatarUri, initialsOf } from '@/features/profile/avatar';
import { sortSchedule } from '@/services/eventRules';
import type { EventScheduleItem, Person, VoyaEvent } from '@/services';
import { board, colors } from '@/theme';

const E = board.event;
const H = board.hangout;

// ------------------------------------------------------------ formatting

export const time24 = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/** "Saturday, 12 December" */
export const longDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
/** "12 December" */
export const dayMonth = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : '');
/** "7:00 PM" */
export const clock = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
/** "7:00 PM – 1:00 AM" */
export const clockRange = (start?: string, end?: string) => (end ? `${clock(start)} – ${clock(end)}` : clock(start));
/** "19:00–20:00" (23) */
export const range24 = (item: Pick<EventScheduleItem, 'startsAt' | 'endsAt'>) =>
  item.endsAt ? `${time24(item.startsAt)}–${time24(item.endsAt)}` : time24(item.startsAt);
/** "20 June 2025" (EV05) */
export const fullDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** Opens Apple/Google Maps with the venue as a search. Nothing is sent from Voya itself. */
export function openInMaps(event: Pick<VoyaEvent, 'venue' | 'city'>) {
  const q = encodeURIComponent([event.venue, event.city].filter(Boolean).join(', '));
  void Linking.openURL(`https://maps.apple.com/?q=${q}`);
}

// ------------------------------------------------------------ cover

/** A picked cover (app-local file) if it still exists, else the fixture tint. */
export function Cover({ event, coverRef, pendingUri, style }: {
  event?: Pick<VoyaEvent, 'coverRef' | 'coverPhoto'>; coverRef?: string; pendingUri?: string; style?: StyleProp<ViewStyle>;
}) {
  const uri = pendingUri ?? avatarUri(coverRef ?? event?.coverRef);
  const tint = PHOTO_TINT[event?.coverPhoto ?? 'wedding'] ?? board.explore.card.placeholder;
  return (
    <View style={[styles.cover, { backgroundColor: tint }, style]} accessibilityRole="image" accessibilityLabel="Event cover">
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
    </View>
  );
}

export type CoverPick = { uri: string } | { error: string; denied?: boolean } | null;

/** Photo library, 16:9 crop. null = cancelled. The file is copied by the service, not uploaded. */
export async function pickCover(): Promise<CoverPick> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { error: 'Allow photo access in Settings to choose a cover.', denied: true };
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return null;
    return { uri: result.assets[0].uri };
  } catch {
    return { error: 'That photo could not be opened. Try another.' };
  }
}

/** Board `.xp-cover-edit` / 18's "+ Add cover": cover with a cream button on it. */
export function CoverButton({ label, onPress, inset }: { label: string; onPress: () => void; inset: number }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.coverButton, { left: inset, bottom: inset }]} hitSlop={board.inlineGap}>
      <Text style={styles.coverButtonText}>{label}</Text>
    </Pressable>
  );
}

// ------------------------------------------------------------ pieces

/** Board `.formrow`: violet label, plum value. */
export function FormRow({ label, children, onPress, last }: { label: string; children: React.ReactNode; onPress?: () => void; last?: boolean }) {
  const body = (
    <>
      <Text style={styles.formLabel}>{label}</Text>
      {typeof children === 'string' ? <Text style={styles.formValue}>{children}</Text> : children}
    </>
  );
  const style = [styles.formRow, last && styles.formRowLast];
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>{body}</Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

/** Board `.stats`. */
export function Stats({ items }: { items: { value: number; label: string }[] }) {
  return (
    <View style={styles.stats}>
      {items.map((s) => (
        <View key={s.label} accessibilityLabel={`${s.value} ${s.label}`}>
          <Text style={styles.statValue}>{String(s.value)}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Board `.av` with a name beside it (21 Hosts, EV03). */
export function PersonAvatar({ person, index = 0, size = board.avatar.size }: { person?: Pick<Person, 'firstName' | 'lastName'>; index?: number; size?: number }) {
  const [lavender, peach, sage] = board.avatar.tints;
  const n = index + 1;
  const bg = n % 3 === 0 ? sage : n % 2 === 0 ? peach : lavender;
  return (
    <View style={[styles.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={styles.avText}>{initialsOf(person?.firstName, person?.lastName)}</Text>
    </View>
  );
}

/**
 * Board `.timeline` with `.stop.event` rows. `variant` follows the board:
 * host (19, compact), event (22), past (EV05).
 */
export function ScheduleList({ items, variant }: { items: EventScheduleItem[]; variant: 'host' | 'event' | 'past' }) {
  const minHeight = variant === 'host' ? E.hostStop.minHeight : variant === 'past' ? E.pastStop.minHeight : E.eventStop.minHeight;
  const titleSize = variant === 'host' ? E.hostStop.titleSize : variant === 'past' ? E.pastStop.titleSize : H.stop.titleSize;
  return (
    <View style={variant === 'past' ? styles.pastTimeline : undefined}>
      {sortSchedule(items).map((item, i) => {
        const last = i === items.length - 1;
        const lines = variant === 'host' ? [] : [item.location ?? item.notes, item.instructions].filter((x): x is string => !!x);
        return (
          <View key={item.id} style={[styles.stop, { minHeight }, variant === 'past' && styles.pastStop]}>
            <Text style={styles.time}>{time24(item.startsAt)}</Text>
            <View style={styles.lineCol}>
              <View style={styles.dot} />
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.flex}>
              <Text style={[styles.stopTitle, { fontSize: titleSize }]}>{item.title}</Text>
              {lines.map((l) => <Text key={l} style={styles.stopText}>{l}</Text>)}
              {item.visibility === 'hosts_only' ? <Text style={styles.hostOnly}>Hosts only</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Board `.seg` (21). */
export function Segments<T extends string>({ items, value, onChange }: { items: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {items.map((t) => (
        <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: t === value }} onPress={() => onChange(t)} style={[styles.segItem, t === value && styles.segOn]}>
          <Text style={[styles.segText, t === value && styles.segTextOn]}>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const eventStyles = StyleSheet.create({
  smallTitle: { ...board.h1, fontSize: E.smallTitle, lineHeight: E.smallTitle * 1.12, color: colors.brand.plum, marginBottom: board.inlineGap },
  tinyCenter: { ...board.tinyCenter, textAlign: 'center' },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cover: { height: E.hostCover.height, borderRadius: board.photoRadius, overflow: 'hidden' },
  coverButton: {
    position: 'absolute', backgroundColor: colors.surface.base, borderRadius: E.coverEdit.radius,
    paddingVertical: E.coverEdit.paddingY, paddingHorizontal: E.coverEdit.paddingX,
  },
  coverButtonText: { fontSize: E.coverEdit.fontSize, color: colors.brand.plum, fontWeight: '600' },
  formRow: { paddingVertical: H.formRow.paddingY, borderBottomWidth: 1, borderBottomColor: H.formRow.border },
  formRowLast: { borderBottomWidth: 0 },
  formLabel: { fontSize: H.formRow.labelSize, color: colors.brand.violet, marginBottom: H.formRow.labelMarginBottom },
  formValue: { fontSize: H.formRow.fontSize, lineHeight: H.formRow.fontSize * 1.5, color: colors.brand.plum },
  muted: { ...board.small, color: colors.text.secondary },
  stats: { flexDirection: 'row', gap: E.stats.gap, marginTop: E.stats.marginTop, marginBottom: E.stats.marginBottom },
  statValue: { fontSize: E.stats.valueSize, fontWeight: '700', color: colors.brand.plum, marginBottom: E.stats.valueMarginBottom },
  statLabel: { fontSize: E.stats.labelSize, color: colors.text.secondary },
  av: { alignItems: 'center', justifyContent: 'center', borderWidth: board.avatar.border, borderColor: colors.surface.base },
  avText: { fontSize: board.avatar.fontSize, fontWeight: board.avatar.fontWeight, color: colors.brand.plum },
  pastTimeline: { marginTop: E.pastStop.marginTop },
  stop: { flexDirection: 'row', gap: H.stop.gap },
  pastStop: { paddingBottom: E.pastStop.paddingBottom },
  time: { width: H.stop.timeWidth, fontSize: H.stop.timeSize, color: H.stop.timeColor, paddingTop: H.stop.timePaddingTop, fontVariant: ['tabular-nums'] },
  lineCol: { width: H.stop.lineWidth, alignItems: 'center' },
  dot: { width: H.stop.dot, height: H.stop.dot, borderRadius: H.stop.dot / 2, backgroundColor: colors.brand.lavender, marginTop: H.stop.dotMarginTop },
  line: { flex: 1, width: 1, backgroundColor: H.stop.lineColor },
  stopTitle: { fontWeight: '700', color: colors.brand.plum, marginBottom: H.stop.titleMarginBottom },
  stopText: { fontSize: H.stop.bodySize, lineHeight: H.stop.bodySize * 1.3, color: H.stop.bodyColor, marginBottom: E.stopTextMarginBottom },
  hostOnly: { fontSize: E.hostStop.bodySize, color: colors.brand.violet, marginBottom: E.stopTextMarginBottom },
  seg: { flexDirection: 'row', gap: board.segment.gap, padding: board.segment.padding, borderRadius: board.segment.radius, backgroundColor: board.segment.background, marginTop: board.segment.marginTop, marginBottom: board.segment.marginBottom },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: board.segment.itemPaddingY, borderRadius: board.segment.itemRadius },
  segOn: { backgroundColor: colors.surface.base },
  segText: { fontSize: board.segment.fontSize, color: colors.brand.plum },
  segTextOn: { color: colors.brand.violet, fontWeight: '600' },
});
