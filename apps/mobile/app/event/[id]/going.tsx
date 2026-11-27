import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Calendar from 'expo-calendar';
import { Check } from 'lucide-react-native';
import { Button, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { authStyles } from '@/features/auth/AuthParts';
import { Cover, clock, eventStyles } from '@/features/event/EventParts';
import { useEvent } from '@/features/event/useEvent';
import { board, colors, icon } from '@/theme';

const E = board.event;

/** 24 RSVP confirmed. Only for a guest whose answer is "going". */
export default function Going() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useEvent(id);
  const [note, setNote] = React.useState<string | undefined>();
  if (h.isPending) return <Screen><LoadingState /></Screen>;
  const event = h.event;
  if (!event || h.myRsvp !== 'going') return <Redirect href={`/event/${id}`} />;

  const addToCalendar = async () => {
    setNote(undefined);
    try {
      // The system's own "New Event" sheet: nothing is written unless the person saves it there.
      const result = await Calendar.createEventInCalendarAsync({
        title: event.title,
        startDate: new Date(event.startsAt!),
        endDate: new Date(event.endsAt ?? Date.parse(event.startsAt!) + 3 * 3600000),
        location: event.venue,
      });
      if (result.action === 'saved') setNote('Added to your calendar.');
    } catch {
      setNote('Your calendar couldn’t be opened.');
    }
  };
  const d = new Date(event.startsAt!);
  const date = `${d.toLocaleDateString(undefined, { weekday: 'long' })} · ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="RSVP confirmed" onBack={() => router.replace(`/event/${event.id}`)} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.center}>
          <View style={styles.celebrate}>
            <Check size={E.celebrate.checkSize} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
            <Text style={styles.spark}>✦</Text>
          </View>
          <Text style={styles.h1}>You&apos;re going!</Text>
          <Text style={styles.muted}>We can&apos;t wait to celebrate with you.</Text>
        </View>
        <Cover event={event} style={styles.cover} />
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.when}>{`${date}\n${clock(event.startsAt)}`}</Text>
        <Text style={[styles.muted, styles.centerText]}>{event.venue ?? event.city}</Text>
        <View style={styles.spacer} />
        <Button label="Add to calendar" onPress={() => void addToCalendar()} />
        <Button label="View schedule" variant="secondary" onPress={() => router.push(`/event/${event.id}/schedule`)} />
        {note ? <Text style={[eventStyles.tinyCenter, styles.note]}>{note}</Text> : null}
        <Text style={[eventStyles.tinyCenter, styles.note]}>Your host will let you know if anything changes.</Text>
      </ScrollView>
    </Screen>
  );
}


const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  celebrate: {
    width: E.celebrate.size, height: E.celebrate.size, borderRadius: E.celebrate.size / 2, backgroundColor: E.celebrate.background,
    alignItems: 'center', justifyContent: 'center', marginTop: E.celebrate.marginTop, marginBottom: E.celebrate.marginBottom,
  },
  spark: { position: 'absolute', right: E.celebrate.sparkRight, top: E.celebrate.sparkTop, fontSize: E.celebrate.sparkSize, color: colors.brand.peach },
  h1: { ...board.h1, color: colors.brand.plum, textAlign: 'center' },
  muted: { ...board.small, color: colors.text.secondary, marginBottom: E.confirmCover.marginBottom / 2 },
  cover: { height: E.confirmCover.height, marginBottom: E.confirmCover.marginBottom },
  title: { fontSize: E.confirmTitle, fontWeight: '700', color: colors.brand.plum, textAlign: 'center' },
  when: { fontSize: board.hangout.formRow.fontSize, lineHeight: board.hangout.formRow.fontSize * 1.5, color: colors.brand.plum, textAlign: 'center', marginTop: board.listRow.paddingY },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  note: { marginTop: board.listRow.paddingY },
});
