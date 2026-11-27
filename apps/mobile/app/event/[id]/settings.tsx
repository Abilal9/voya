import * as React from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { Cover, dayMonth, eventStyles, longDate, clock } from '@/features/event/EventParts';
import { useEvent } from '@/features/event/useEvent';
import { BottomSheet, SettingsRow, Switch, sheetText } from '@/features/settings/SettingsParts';
import { useSettings } from '@/features/settings/useSettings';
import { board, colors } from '@/theme';

const E = board.event;

/**
 * EV01 Event settings for hosts and co-hosts; each row shows only when the
 * person's capabilities allow it (the service enforces the same rules).
 * EV04 Share is a sheet here. There are no real invitation links yet, so
 * sharing sends the plain details and "Copy invitation link" says so.
 */
export default function EventSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useEvent(id);
  const settings = useSettings();
  const [sheet, setSheet] = React.useState<'share' | 'cancel' | null>(null);
  if (h.isPending) return <Screen><LoadingState /></Screen>;
  const event = h.event;
  if (!event || !h.managing) return <Screen><TopBar /><EmptyState title="Only hosts can open event settings" /></Screen>;
  const muted = (settings.data?.mutedPlans ?? []).includes(event.id);
  const open = !h.closed;

  const share = async () => {
    // Title, date and place only: no guest list, no private notes.
    await Share.share({ message: `You're invited: ${event.title} — ${longDate(event.startsAt)}, ${clock(event.startsAt)}, ${event.venue ?? event.city}.` });
  };
  const cancel = async () => {
    const ok = await h.run(() => h.services.events.cancel(event.id));
    setSheet(null);
    if (ok) router.replace(`/event/${event.id}`);
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Host view" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Event settings" body={`${event.title} · ${h.role === 'co-host' ? 'Co-host' : 'Host only'}`} />
        {open && h.can.edit ? <SettingsRow title="Edit event" onPress={() => router.push(`/event/${event.id}/edit`)} /> : null}
        {h.can.guests ? <SettingsRow title="Guest management" onPress={() => router.push(`/event/${event.id}/guests`)} /> : null}
        {open ? <SettingsRow title="Invitation" onPress={() => router.push(`/event/${event.id}/invitation`)} /> : null}
        <SettingsRow
          title="Event schedule"
          onPress={() => router.push(open && h.can.schedule ? `/event/${event.id}/schedule-edit` : `/event/${event.id}/schedule`)}
        />
        {h.isHost ? <SettingsRow title="Hosts & co-hosts" onPress={() => router.push(`/event/${event.id}/hosts`)} /> : null}
        <SettingsRow
          title="Notifications"
          right={<Switch label="Notifications for this event" value={!muted} onChange={(on) => settings.update({
            mutedPlans: on ? (settings.data?.mutedPlans ?? []).filter((p) => p !== event.id) : [...(settings.data?.mutedPlans ?? []), event.id],
          })} />}
        />
        {open ? <SettingsRow title="Share event" onPress={() => setSheet('share')} /> : null}
        <View style={styles.spacer} />
        {open && h.isHost ? <SettingsRow danger title="Cancel event" onPress={() => setSheet('cancel')} /> : null}
        {h.error ? <Text style={eventStyles.error}>{h.error}</Text> : null}
      </ScrollView>

      <BottomSheet visible={sheet === 'share'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Share the invitation</Text>
        <View style={styles.card}>
          <Cover event={event} style={styles.thumb} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
            <Text style={styles.small}>{`${dayMonth(event.startsAt)} · ${event.venue ?? event.city}`}</Text>
          </View>
        </View>
        <SettingsRow title="Share invitation" onPress={() => void share()} />
        <SettingsRow title="Copy invitation link" subtitle="Available when invite links go live" />
        {h.can.invite ? <SettingsRow title="Invite contacts" onPress={() => { setSheet(null); router.push(`/event/${event.id}/guests?invite=1`); }} /> : null}
        <Button label="Done" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'cancel'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Cancel this event?</Text>
        <Text style={sheetText.body}>Guests will see that it’s cancelled. The event stays in Past Plans, read-only, and can’t be reopened.</Text>
        <Button label="Cancel event" variant="danger" onPress={() => void cancel()} loading={h.busy} />
        <Button label="Keep event" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  flex: { flex: 1 },
  spacer: { flex: 1, minHeight: board.listRow.paddingY * 2 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: board.hangout.selection.gap, padding: board.hangout.selection.padding,
    backgroundColor: board.hangout.selection.background, borderRadius: board.hangout.selection.radius, marginVertical: board.listRow.paddingY,
  },
  thumb: { width: E.shareThumb.width, height: E.shareThumb.height, borderRadius: E.shareThumb.radius },
  cardTitle: { fontSize: board.home.rowTitle.fontSize, fontWeight: '700', color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
});
