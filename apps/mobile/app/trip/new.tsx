import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react-native';
import { Button, Screen, Text, TopBar } from '@/components/ui';
import { authStyles } from '@/features/auth/AuthParts';
import { PHOTO_TINT } from '@/features/explore/PlaceCard';
import { SuccessSheet } from '@/features/feedback/Sheets';
import { StepDashes } from '@/features/trip/TripParts';
import { addDays, dateRange, formatDay, localDate, nightsBetween } from '@/services/tripRules';
import { useServices } from '@/services/ServicesProvider';
import { board, colors, icon } from '@/theme';

const T = board.trip;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The days of a month as date-only strings, padded to start on Monday. */
function monthGrid(year: number, month: number): (string | null)[] {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => addDays(first, i))];
}

/** 03 Destination and 04 Dates. The trip is created on "Continue" from the dates. */
export default function NewTrip() {
  const router = useRouter();
  const services = useServices();
  const qc = useQueryClient();
  const destinations = useQuery({ queryKey: ['catalog', 'destinations'], queryFn: () => services.catalog.destinations() });
  const [step, setStep] = React.useState<1 | 2>(1);
  const [query, setQuery] = React.useState('');
  const [dest, setDest] = React.useState<{ city: string; country: string }>();
  const today = localDate(new Date());
  const [month, setMonth] = React.useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [start, setStart] = React.useState<string>();
  const [end, setEnd] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [created, setCreated] = React.useState<string>();

  const q = query.trim().toLowerCase();
  const matches = (destinations.data ?? []).filter((d) => !q || d.city.toLowerCase().includes(q) || d.country.toLowerCase().includes(q));

  const tapDay = (d: string) => {
    setError(undefined);
    if (!start || end || d < start) { setStart(d); setEnd(undefined); return; }
    setEnd(d);
  };
  const shiftMonth = (n: number) => setMonth(({ y, m }) => {
    const t = new Date(y, m + n, 1);
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const create = async () => {
    if (busy || !dest) return; // one trip per tap
    if (!start || !end) return setError('Choose the day you leave and the day you come back.');
    setBusy(true);
    try {
      const t = await services.trips.create({ destination: dest.city, startDate: start, endDate: end });
      await qc.invalidateQueries({ queryKey: ['plans'] });
      setCreated(t.id); // S09, once the trip exists
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The trip could not be created.');
      setBusy(false);
    }
  };

  const nights = start && end ? nightsBetween(start, end) : 0;
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="" onBack={step === 2 ? () => setStep(1) : undefined} right={<StepDashes step={step} />} />
      {step === 1 ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>YOUR NEXT ADVENTURE</Text>
          <Text style={styles.h1}>{'Where are\nyou going?'}</Text>
          <View style={styles.search}>
            <SearchIcon size={icon.sm} color={colors.text.secondary} strokeWidth={icon.strokeWidth} />
            <TextInput
              value={query} onChangeText={setQuery} placeholder="Search cities or countries" placeholderTextColor={board.field.placeholder}
              accessibilityLabel="Search cities or countries" style={styles.input}
            />
          </View>
          {dest && !q ? (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel={`${dest.city} selected. Change`} onPress={() => setDest(undefined)} style={styles.destCard}>
                <View style={[styles.thumb, { backgroundColor: PHOTO_TINT[dest.city.toLowerCase()] ?? board.explore.card.placeholder }]} />
                <View style={styles.flex}>
                  <Text style={styles.destName}>{dest.city}</Text>
                  <Text style={styles.small}>{dest.country}</Text>
                </View>
                <Check size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
              </Pressable>
              <View style={[styles.photo, { backgroundColor: PHOTO_TINT[dest.city.toLowerCase()] ?? board.explore.card.placeholder }]} />
            </>
          ) : (
            matches.map((d) => (
              <Pressable key={d.city} accessibilityRole="button" onPress={() => { setDest(d); setQuery(''); }} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.destName}>{d.city}</Text>
                  <Text style={styles.small}>{d.country}</Text>
                </View>
                <ChevronRight size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
              </Pressable>
            ))
          )}
          {q && !matches.length ? <Text style={styles.small}>No destinations match. Voya covers a few cities in this preview.</Text> : null}
          <View style={styles.spacer} />
          <Button label="Continue" onPress={() => setStep(2)} disabled={!dest} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>{'When are\nyou going?'}</Text>
          <Text style={styles.small}>Make room for a few good days.</Text>
          <View style={styles.monthRow}>
            <Text style={styles.month}>{new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
            <View style={styles.monthNav}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => shiftMonth(-1)} hitSlop={board.inlineGap}>
                <ChevronLeft size={icon.sm} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shiftMonth(1)} hitSlop={board.inlineGap}>
                <ChevronRight size={icon.sm} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
              </Pressable>
            </View>
          </View>
          <View style={styles.week}>
            {WEEKDAYS.map((d, i) => <Text key={i} style={styles.weekday}>{d}</Text>)}
          </View>
          <View style={styles.grid}>
            {monthGrid(month.y, month.m).map((d, i) => {
              if (!d) return <View key={`pad-${i}`} style={styles.cell} />;
              const past = d < today;
              const edge = d === start || d === end;
              const inside = !!start && !!end && d > start && d < end;
              return (
                <Pressable
                  key={d} accessibilityRole="button" accessibilityState={{ disabled: past, selected: edge || inside }}
                  accessibilityLabel={formatDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}
                  disabled={past} onPress={() => tapDay(d)} style={[styles.cell, inside && styles.inside]}
                >
                  <View style={[styles.dayDot, edge && styles.edge]}>
                    <Text style={[styles.day, past && styles.past, edge && styles.edgeText]}>{String(Number(d.slice(8)))}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {start ? (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{end ? dateRange(start, end) : formatDay(start, { day: 'numeric', month: 'long' })}</Text>
              <Text style={styles.small}>
                {end
                  ? `${nights} ${nights === 1 ? 'night' : 'nights'} · ${formatDay(start, { weekday: 'long' })} to ${formatDay(end, { weekday: 'long' })}`
                  : 'Now choose the day you come back.'}
              </Text>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.spacer} />
          <Button label="Continue" onPress={() => void create()} loading={busy} disabled={!start || !end} />
        </ScrollView>
      )}
      <SuccessSheet
        visible={!!created} title={`${dest?.city ?? 'Your trip'} is ready.`} body="Now bring everyone in."
        primaryLabel="Invite travelers" onPrimary={() => router.replace(`/trip/${created}/travelers?setup=1`)}
        secondaryLabel="View trip" onSecondary={() => router.replace(`/trip/${created}`)}
        onClose={() => router.replace(`/trip/${created}`)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  flex: { flex: 1 },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  eyebrow: { ...board.home.eyebrow, color: colors.brand.violet, marginBottom: board.inlineGap },
  h1: { ...board.h1, color: colors.brand.plum, marginBottom: board.inlineGap },
  small: { ...board.small, color: colors.text.secondary },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: board.search.field.gap, padding: board.search.field.padding,
    borderRadius: board.search.field.radius, backgroundColor: board.search.field.background, minHeight: board.search.field.minHeight,
    marginTop: board.search.field.marginTop,
  },
  input: { flex: 1, fontSize: board.search.field.fontSize, color: colors.brand.plum, padding: 0 },
  destCard: {
    flexDirection: 'row', alignItems: 'center', gap: T.destCard.gap, padding: T.destCard.padding, borderRadius: T.destCard.radius,
    backgroundColor: board.hangout.selection.background, marginTop: T.destCard.marginTop,
  },
  thumb: { width: T.destCard.thumb, height: T.destCard.thumb, borderRadius: T.destCard.thumbRadius },
  destName: { fontSize: board.home.rowTitle.fontSize, fontWeight: '700', color: colors.brand.plum },
  photo: { height: T.destPhoto.height, borderRadius: board.photoRadius, marginTop: T.destPhoto.marginTop, marginBottom: T.destPhoto.marginBottom },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: board.listRow.paddingY, borderBottomWidth: 1, borderBottomColor: board.listRow.borderColor },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: T.calendar.marginTop },
  month: { fontSize: T.calendar.headerSize, fontWeight: '700', color: colors.brand.plum },
  monthNav: { flexDirection: 'row', gap: board.listRow.paddingY },
  week: { flexDirection: 'row', marginTop: board.listRow.paddingY },
  weekday: { flex: 1, textAlign: 'center', fontSize: T.calendar.weekdaySize, color: colors.text.secondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: T.calendar.rowGap, marginTop: board.inlineGap },
  cell: { width: `${100 / 7}%`, height: T.calendar.cell, alignItems: 'center', justifyContent: 'center' },
  inside: { backgroundColor: T.calendar.rangeFill },
  dayDot: { width: T.calendar.cell, height: T.calendar.cell, borderRadius: T.calendar.cell / 2, alignItems: 'center', justifyContent: 'center' },
  edge: { backgroundColor: colors.brand.peach },
  day: { fontSize: T.calendar.daySize, color: colors.brand.plum },
  past: { color: board.field.placeholder },
  edgeText: { fontWeight: '700' },
  summary: { padding: T.summary.padding, borderRadius: T.summary.radius, backgroundColor: board.hangout.selection.background, marginTop: T.summary.marginTop },
  summaryTitle: { fontSize: T.summary.titleSize, fontWeight: '700', color: colors.brand.plum },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
