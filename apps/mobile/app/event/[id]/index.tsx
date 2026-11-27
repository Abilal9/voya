import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar, ErrorState } from '@/components/ui';
import { authStyles } from '@/features/auth/AuthParts';
import { usePeople } from '@/features/catalog';
import {
  Cover, FormRow, PersonAvatar, ScheduleList, Segments, Stats, clock, eventStyles, fullDate, longDate, openInMaps,
} from '@/features/event/EventParts';
import { InvitationCard } from '@/features/event/Invitation';
import { useEvent, type EventHook } from '@/features/event/useEvent';
import { BottomSheet, SettingsRow, Switch, sheetText } from '@/features/settings/SettingsParts';
import { useSettings } from '@/features/settings/useSettings';
import { eventScreen, hostLine, hostsInOrder, rsvpCounts } from '@/services/eventRules';
import type { RSVP } from '@/services';
import { ServiceError } from '@/services';
import { board, colors, icon } from '@/theme';

const E = board.event;

/**
 * One route for an event; what it shows follows the canonical record and the
 * viewer's role: host view (19) for hosts and co-hosts, the invitation (20)
 * for someone who hasn't answered, the guest view (21) after answering, and
 * the completed (EV05) or cancelled state once it's over. Guests receive the
 * service's guest projection, so host-only data never reaches these screens.
 */
export default function EventScreen() {
  const { id, view } = useLocalSearchParams<{ id: string; view?: string }>();
  const h = useEvent(id);
  if (h.isPending) return <Screen><LoadingState label="Loading event" /></Screen>;
  const event = h.event;
  if (h.isError && !(h.failureReason instanceof ServiceError && h.failureReason.code === 'not_found')) {
    return <Screen><TopBar /><ErrorState error={h.failureReason} onRetry={() => void h.refetch()} /></Screen>;
  }
  if (!event) {
    return <Screen><TopBar /><EmptyState title="This event isn’t available" body="It may have been removed, or you’re not on its guest list." /></Screen>;
  }
  const hh: EventHook = { ...h, event };
  switch (eventScreen(event, h.me, h.closed, view === 'details')) {
    case 'closed': return <Closed h={hh} />;
    case 'host': return <HostView h={hh} />;
    case 'invitation': return <Invitation h={hh} />;
    default: return <GuestView h={hh} />;
  }
}

function useHostNames(h: EventHook) {
  const people = usePeople();
  const first = (pid: string) => people.byId.get(pid)?.firstName ?? '';
  return { people, first, line: hostLine(h.event, first) };
}

function MoreButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={board.inlineGap}>
      <MoreHorizontal size={icon.lg} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
    </Pressable>
  );
}

/** 19 Host view (hosts and co-hosts). */
function HostView({ h }: { h: EventHook }) {
  const router = useRouter();
  const { event } = h;
  const { line } = useHostNames(h);
  const counts = rsvpCounts(event);
  const settings = () => router.push(`/event/${event.id}/settings`);
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Host view" right={<MoreButton label="Event settings" onPress={settings} />} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Cover event={event} style={styles.hostCover} />
        <Text style={eventStyles.smallTitle}>{event.title}</Text>
        <Text style={styles.small}>{`${longDate(event.startsAt)} · ${clock(event.startsAt)}\n${event.venue ?? event.city}`}</Text>
        {line ? <Text style={styles.hostedBy}>{`Hosted by ${line}`}</Text> : null}
        <Pressable
          accessibilityRole="button" accessibilityLabel={`${counts.going} going, ${counts.maybe} maybe, ${counts.awaiting} awaiting. Open guests`}
          disabled={!h.can.guests} onPress={() => router.push(`/event/${event.id}/guests`)}
        >
          <Stats items={[{ value: counts.going, label: 'Going' }, { value: counts.maybe, label: 'Maybe' }, { value: counts.awaiting, label: 'Awaiting' }]} />
        </Pressable>
        <Button label="Manage Event" onPress={settings} />
        <Pressable accessibilityRole="button" onPress={() => router.push(`/event/${event.id}/schedule`)}>
          <Text style={styles.scheduleHeading}>Schedule</Text>
        </Pressable>
        {event.schedule.length ? (
          <ScheduleList items={event.schedule} variant="host" />
        ) : (
          <View>
            <Text style={styles.small}>No schedule yet.</Text>
            {h.can.schedule ? (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/event/${event.id}/schedule-edit`)} style={styles.link}>
                <Text style={styles.linkText}>Build the schedule</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

/** 20 Invitation, for someone who hasn't answered. */
function Invitation({ h }: { h: EventHook }) {
  const router = useRouter();
  const answer = async (rsvp: Exclude<RSVP, 'pending'>) => {
    const ok = await h.run(() => h.services.events.respond(h.event.id, rsvp));
    if (ok && rsvp === 'going') router.push(`/event/${h.event.id}/going`);
  };
  return (
    <InvitationCard
      h={h}
      onAnswer={(r) => void answer(r)}
      onDetails={() => router.push(`/event/${h.event.id}?view=details`)}
    />
  );
}

const TABS = ['Details', 'Schedule', 'Guests'] as const;
const HEADER: Record<RSVP, string> = {
  going: 'You’re going ✓', maybe: 'You said maybe', declined: 'You can’t make it', pending: 'You’re invited',
};

/** 21 Guest view, after answering (or opened from the invitation's "View event details"). */
function GuestView({ h }: { h: EventHook }) {
  const router = useRouter();
  const { event } = h;
  const { people, line } = useHostNames(h);
  const settings = useSettings();
  const [tab, setTab] = React.useState<(typeof TABS)[number]>('Details');
  const [menu, setMenu] = React.useState(false);
  const counts = rsvpCounts(event);
  const muted = (settings.data?.mutedPlans ?? []).includes(event.id);
  const hosts = hostsInOrder(event).filter((m) => m.role !== 'co-host');
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title={HEADER[h.myRsvp ?? 'pending']} right={<MoreButton label="Event options" onPress={() => setMenu(true)} />} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Cover event={event} style={styles.hostCover} />
        <Text style={eventStyles.smallTitle}>{event.title}</Text>
        <Segments items={TABS} value={tab} onChange={setTab} />
        {tab === 'Details' ? (
          <>
            <FormRow label="Location">
              <Text style={styles.value}>{event.venue ?? event.city}</Text>
              <Pressable accessibilityRole="link" onPress={() => openInMaps(event)} hitSlop={board.inlineGap}>
                <Text style={styles.linkSmall}>Open in Maps ↗</Text>
              </Pressable>
            </FormRow>
            {event.dressCode ? <FormRow label="Dress code">{event.dressCode}</FormRow> : null}
            {event.note ? <FormRow label="Important note">{event.note}</FormRow> : null}
            {event.description ? <FormRow label="Event details">{event.description}</FormRow> : null}
            <FormRow label="Hosts">
              <View style={styles.hosts}>
                {hosts.map((m, i) => {
                  const p = people.byId.get(m.personId);
                  return (
                    <View key={m.personId} style={styles.host}>
                      <PersonAvatar person={p} index={i} />
                      <Text style={styles.value}>{p?.firstName ?? 'Host'}</Text>
                    </View>
                  );
                })}
              </View>
            </FormRow>
          </>
        ) : tab === 'Schedule' ? (
          event.schedule.length ? <ScheduleList items={event.schedule} variant="event" /> : <Text style={styles.small}>Your hosts haven’t shared the schedule yet.</Text>
        ) : (
          <>
            <Stats items={[{ value: counts.going, label: 'Going' }, { value: counts.maybe, label: 'Maybe' }]} />
            <Text style={styles.small}>Only your hosts can see who’s on the guest list.</Text>
          </>
        )}
        <View style={styles.spacer} />
        <Text style={eventStyles.tinyCenter}>{line ? `Lovingly planned by ${line}.` : 'Everything you need for a beautiful evening.'}</Text>
      </ScrollView>

      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <Text style={sheetText.title}>{event.title}</Text>
        <SettingsRow title="Change your answer" onPress={() => { setMenu(false); router.push(`/event/${event.id}/invitation`); }} />
        <SettingsRow title="Schedule" onPress={() => { setMenu(false); router.push(`/event/${event.id}/schedule`); }} />
        <SettingsRow
          title="Notifications"
          right={<Switch label="Notifications for this event" value={!muted} onChange={(on) => settings.update({
            mutedPlans: on ? (settings.data?.mutedPlans ?? []).filter((p) => p !== event.id) : [...(settings.data?.mutedPlans ?? []), event.id],
          })} />}
        />
        <Button label="Done" variant="ghost" onPress={() => setMenu(false)} />
      </BottomSheet>
    </Screen>
  );
}

/** EV05 Event completed, and the cancelled state (read-only for everyone). */
function Closed({ h }: { h: EventHook }) {
  const router = useRouter();
  const { event } = h;
  const cancelled = event.lifecycle === 'cancelled';
  const counts = rsvpCounts(event);
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Past Plans" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Cover event={event} style={styles.pastCover} />
        <View style={styles.pill}><Text style={styles.pillText}>{cancelled ? 'Event cancelled' : 'Event complete'}</Text></View>
        <Text style={eventStyles.smallTitle}>{event.title}</Text>
        <Text style={styles.muted}>{cancelled ? 'The hosts cancelled this event.' : 'Thank you for being part of it.'}</Text>
        <Text style={styles.small}>{`${fullDate(event.startsAt)} · ${event.city}`}</Text>
        {event.schedule.length ? <ScheduleList items={event.schedule} variant="past" /> : null}
        {h.managing ? (
          <>
            <Stats items={[{ value: counts.going, label: 'Going' }, { value: counts.maybe, label: 'Maybe' }, { value: counts.awaiting, label: 'No response' }]} />
            <Text style={styles.hostedBy}>Final RSVP summary · Visible to hosts</Text>
          </>
        ) : null}
        <View style={styles.spacer} />
        {h.managing ? <Button label="View guest list" onPress={() => router.push(`/event/${event.id}/guests`)} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  hostCover: { height: E.hostCover.height, marginBottom: E.hostCover.marginBottom },
  pastCover: { height: E.shareCover.height, marginBottom: E.shareCover.marginBottom },
  small: { ...board.small, color: colors.text.secondary },
  muted: { ...board.small, color: colors.text.secondary, marginBottom: board.inlineGap },
  hostedBy: { fontSize: E.hostedBy.size, color: colors.text.secondary, marginTop: E.hostedBy.marginTop },
  value: { fontSize: board.hangout.formRow.fontSize, color: colors.brand.plum },
  scheduleHeading: {
    fontSize: E.scheduleHeading.size, fontWeight: '700', color: colors.brand.plum,
    marginTop: E.scheduleHeading.marginTop, marginBottom: E.scheduleHeading.marginBottom,
  },
  link: { paddingVertical: board.inlineGap },
  linkText: { fontSize: board.subtleControl.fontSize, color: colors.brand.violet },
  linkSmall: { ...board.small, color: colors.brand.violet },
  hosts: { flexDirection: 'row', flexWrap: 'wrap', gap: E.hostAvatarGap, marginTop: board.inlineGap },
  host: { flexDirection: 'row', alignItems: 'center', gap: board.inlineGap },
  pill: {
    alignSelf: 'flex-start', backgroundColor: E.miniPill.background, borderRadius: E.miniPill.radius,
    paddingVertical: E.miniPill.paddingY, paddingHorizontal: E.miniPill.paddingX, marginBottom: E.miniPill.marginBottom,
  },
  pillText: { fontSize: E.miniPill.fontSize, color: colors.brand.violet },
});
