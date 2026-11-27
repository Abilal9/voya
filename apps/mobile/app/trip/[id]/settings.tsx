import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { BottomSheet, GroupLabel, SettingsRow, Switch, sheetText } from '@/features/settings/SettingsParts';
import { useSettings } from '@/features/settings/useSettings';
import { ConfirmSheet } from '@/features/feedback/Sheets';
import { FriendsSheet, ShareSheet } from '@/features/trip/InviteSheet';
import { useTrip } from '@/features/trip/useTrip';
import { travelers } from '@/services/tripRules';
import { board, colors } from '@/theme';

/**
 * T01 Trip settings, with T04 (invite / share) as a sheet. Organizer-only rows
 * are hidden from travelers; the service refuses the same actions anyway.
 */
export default function TripSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useTrip(id);
  const settings = useSettings();
  const [sheet, setSheet] = React.useState<'share' | 'friends' | 'permissions' | 'leave' | 'delete' | null>(null);
  if (h.isPending) return <Screen><LoadingState /></Screen>;
  const trip = h.trip;
  if (!trip || h.relation !== 'member') return <Screen><TopBar /><EmptyState title="This trip isn’t available" /></Screen>;
  const hh = { ...h, trip };
  const muted = (settings.data?.mutedPlans ?? []).includes(trip.id);
  const n = travelers(trip).length;
  const open = !h.closed;

  const leave = async () => {
    const ok = await h.run(() => h.services.plans.leave(trip.id));
    if (ok !== undefined) router.replace('/(tabs)');
  };
  const remove = async () => {
    const ok = await h.run(() => h.services.trips.remove(trip.id));
    if (ok !== undefined) router.replace('/(tabs)');
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title={trip.title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Trip settings" body={`${trip.title} · ${h.isOrganizer ? 'Organizer' : 'Traveler'}`} />
        {open && h.isOrganizer ? <SettingsRow title="Edit trip details" onPress={() => router.push(`/trip/${trip.id}/edit`)} /> : null}
        <SettingsRow title="Travelers" subtitle={`${n} ${n === 1 ? 'person' : 'people'}`} onPress={() => router.push(`/trip/${trip.id}/people`)} />
        {open && h.isOrganizer ? <SettingsRow title="Invite people" onPress={() => setSheet('friends')} /> : null}
        {open ? <SettingsRow title="Share trip" onPress={() => setSheet('share')} /> : null}
        <SettingsRow
          title="Notifications"
          right={<Switch label="Notifications for this trip" value={!muted} onChange={(on) => settings.update({
            mutedPlans: on ? (settings.data?.mutedPlans ?? []).filter((p) => p !== trip.id) : [...(settings.data?.mutedPlans ?? []), trip.id],
          })} />}
        />
        <SettingsRow title="Trip permissions" subtitle="Organizers manage the trip" onPress={() => setSheet('permissions')} />
        <View style={styles.spacer} />
        <SettingsRow title="Leave trip" onPress={() => setSheet('leave')} />
        {h.isOrganizer ? (
          <>
            <GroupLabel>Organizer only</GroupLabel>
            <SettingsRow danger title="Delete trip" onPress={() => setSheet('delete')} />
          </>
        ) : null}
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
      </ScrollView>

      <ShareSheet h={hh} visible={sheet === 'share'} onClose={() => setSheet(null)} onInviteContacts={h.isOrganizer ? () => setSheet('friends') : undefined} />
      <FriendsSheet h={hh} visible={sheet === 'friends'} onClose={() => setSheet(null)} />

      <BottomSheet visible={sheet === 'permissions'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Trip permissions</Text>
        <Text style={sheetText.body}>
          {'Organizers edit the trip and its itinerary, invite and remove travelers, and can delete the trip.\n\nTravelers set their preferences, pick places and must-dos, and suggest replacements for any stop.'}
        </Text>
        <Button label="Done" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'leave'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Leave this trip?</Text>
        <Text style={sheetText.body}>
          {h.isOrganizer
            ? 'The trip stays for everyone else and the next traveler becomes the organizer. Your picks and preferences are removed.'
            : 'The trip stays for everyone else. Your picks and preferences are removed.'}
        </Text>
        <Button label="Leave trip" variant="danger" onPress={() => void leave()} loading={h.busy} />
        <Button label="Cancel" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>

      <ConfirmSheet
        visible={sheet === 'delete'} title="Delete this Plan?" body="It goes for every traveler, with its itinerary, picks and must-dos. This can’t be undone."
        confirmLabel="Delete" onConfirm={() => void remove()} onCancel={() => setSheet(null)} busy={h.busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  spacer: { flex: 1, minHeight: board.listRow.paddingY * 2 },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
