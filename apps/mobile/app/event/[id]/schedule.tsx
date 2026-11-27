import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { usePeople } from '@/features/catalog';
import { ScheduleList, eventStyles, longDate } from '@/features/event/EventParts';
import { useEvent } from '@/features/event/useEvent';
import { hostLine } from '@/services/eventRules';
import { board, colors, icon } from '@/theme';

const E = board.event;

/**
 * 22 Event schedule. Guests get the service's projection (no host-only
 * items); hosts see everything, with host-only items marked.
 */
export default function EventSchedule() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useEvent(id);
  const people = usePeople();
  if (h.isPending) return <Screen><LoadingState /></Screen>;
  const event = h.event;
  if (!event) return <Screen><TopBar /><EmptyState title="This event isn’t available" /></Screen>;
  const hosts = hostLine(event, (pid) => people.byId.get(pid)?.firstName ?? '');
  const canEdit = h.can.schedule && !h.closed;
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar
        title={event.title}
        right={canEdit ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Edit schedule" onPress={() => router.push(`/event/${event.id}/schedule-edit`)} hitSlop={board.inlineGap}>
            <Pencil size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
          </Pressable>
        ) : undefined}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Schedule" body={longDate(event.startsAt)} />
        <Text style={styles.agenda}>AN EVENING TO REMEMBER</Text>
        {event.schedule.length ? (
          <ScheduleList items={event.schedule} variant="event" />
        ) : (
          <Text style={styles.small}>{canEdit ? 'No schedule yet. Tap the pencil to add the first moment.' : 'Your hosts haven’t shared the schedule yet.'}</Text>
        )}
        <View style={styles.spacer} />
        <Text style={eventStyles.tinyCenter}>{`${hosts ? `Lovingly planned by ${hosts}.\n` : ''}Times are set by your hosts.`}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  agenda: { fontSize: E.agenda.size, letterSpacing: E.agenda.letterSpacing, color: colors.brand.violet, paddingTop: E.agenda.paddingTop, paddingBottom: E.agenda.paddingBottom },
  small: { ...board.small, color: colors.text.secondary },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
});
