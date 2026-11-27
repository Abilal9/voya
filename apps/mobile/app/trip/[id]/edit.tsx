import * as React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Check } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TextField, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { Cover, CoverButton, pickCover } from '@/features/event/EventParts';
import { BottomSheet, sheetText } from '@/features/settings/SettingsParts';
import { useTrip } from '@/features/trip/useTrip';
import { formatDay, localDate } from '@/services/tripRules';
import { board, colors, icon } from '@/theme';

const E = board.event;
const toDate = (d: string) => new Date(`${d}T12:00:00`);

/** T02 Edit trip details (organizer). Moving the dates moves the itinerary's days with them. */
export default function EditTrip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useTrip(id);
  const destinations = useQuery({ queryKey: ['catalog', 'destinations'], queryFn: () => h.services.catalog.destinations() });
  const [title, setTitle] = React.useState<string>();
  const [dest, setDest] = React.useState<string>();
  const [from, setFrom] = React.useState<string>();
  const [to, setTo] = React.useState<string>();
  const [stay, setStay] = React.useState<string>();
  const [cover, setCover] = React.useState<string>();
  const [sheet, setSheet] = React.useState<'from' | 'to' | 'dest' | 'leave' | null>(null);
  const [saved, setSaved] = React.useState(false);
  if (h.isPending) return <Screen><LoadingState /></Screen>;
  const trip = h.trip;
  if (!trip || !h.isOrganizer || h.closed) return <Screen><TopBar /><EmptyState title="Only the organizer can edit this trip" /></Screen>;

  const t = title ?? trip.title;
  const d = dest ?? trip.destination;
  const f = from ?? trip.startDate ?? localDate(new Date());
  const e = to ?? trip.endDate ?? f;
  const s = stay ?? trip.accommodation ?? '';
  const changed = !saved && [title, dest, from, to, stay, cover].some((x) => x !== undefined);
  const country = (destinations.data ?? []).find((x) => x.city === d)?.country;

  const save = async () => {
    const ok = await h.run(() => h.services.trips.update(trip.id, {
      title: t, destination: d, startDate: f, endDate: e, accommodation: s, coverUri: cover,
    }));
    if (ok) { setSaved(true); router.back(); }
  };
  const chooseCover = async () => {
    const picked = await pickCover();
    if (!picked) return;
    if ('error' in picked) return h.setError(picked.error);
    setCover(picked.uri);
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <Stack.Screen options={{ gestureEnabled: !changed }} />
      <TopBar title="Trip settings" onBack={() => (changed ? setSheet('leave') : router.back())} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <AuthIntro tight title="Edit trip details" />
          <View style={styles.coverWrap}>
            <Cover event={trip} pendingUri={cover} style={styles.cover} />
            <CoverButton label="Change cover" onPress={() => void chooseCover()} inset={E.coverEdit.inset} />
          </View>
          <View style={styles.fields}>
            <TextField label="Trip name" value={t} onChangeText={setTitle} maxLength={60} />
            <Pressable accessibilityRole="button" onPress={() => setSheet('dest')}>
              <View pointerEvents="none"><TextField label="Destination" value={country ? `${d}, ${country}` : d} editable={false} /></View>
            </Pressable>
            <View style={styles.pair}>
              <Pressable accessibilityRole="button" style={styles.flex} onPress={() => setSheet('from')}>
                <View pointerEvents="none"><TextField label="From" value={formatDay(f, { day: 'numeric', month: 'short', year: 'numeric' })} editable={false} /></View>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.flex} onPress={() => setSheet('to')}>
                <View pointerEvents="none"><TextField label="To" value={formatDay(e, { day: 'numeric', month: 'short', year: 'numeric' })} editable={false} /></View>
              </Pressable>
            </View>
            <TextField label="Accommodation / base" value={s} onChangeText={setStay} placeholder="Where you’re staying" maxLength={120} />
          </View>
          {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
          <View style={authStyles.foot}>
            <Button label="Save changes" onPress={() => void save()} loading={h.busy} disabled={!changed} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet visible={sheet === 'from' || sheet === 'to'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>{sheet === 'from' ? 'From' : 'To'}</Text>
        <DateTimePicker
          value={toDate(sheet === 'to' ? e : f)} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={sheet === 'to' ? toDate(f) : undefined}
          onChange={(_, v) => {
            if (!v) return;
            const day = localDate(v);
            if (sheet === 'from') { setFrom(day); if (day > e) setTo(day); } else setTo(day);
          }}
          themeVariant="light" accentColor={colors.brand.violet}
        />
        <Button label="Done" onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'dest'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Destination</Text>
        {trip.generated ? <Text style={sheetText.body}>The itinerary is built for this destination, so it can’t change now.</Text> : null}
        {(destinations.data ?? []).map((x) => (
          <Pressable key={x.city} accessibilityRole="button" disabled={trip.generated} onPress={() => { setDest(x.city); setSheet(null); }} style={styles.row}>
            <Text style={[styles.rowText, styles.flex]}>{`${x.city}, ${x.country}`}</Text>
            {x.city === d ? <Check size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} /> : null}
          </Pressable>
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'leave'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Discard your changes?</Text>
        <Text style={sheetText.body}>The trip stays as it was.</Text>
        <Button label="Discard changes" variant="danger" onPress={() => { setSheet(null); setSaved(true); router.back(); }} />
        <Button label="Keep editing" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  coverWrap: { marginBottom: E.coverEdit.marginBottom },
  cover: { height: E.coverEdit.height },
  fields: { gap: board.inlineGap },
  pair: { flexDirection: 'row', gap: board.inlineGap },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: board.listRow.paddingY, borderBottomWidth: 1, borderBottomColor: board.listRow.borderColor },
  rowText: { fontSize: board.settings.row.titleSize, color: colors.brand.plum },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
