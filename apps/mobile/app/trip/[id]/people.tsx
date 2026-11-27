import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { PersonAvatar } from '@/features/event/EventParts';
import { BottomSheet, sheetText } from '@/features/settings/SettingsParts';
import { FriendsSheet, ShareSheet } from '@/features/trip/InviteSheet';
import { useFirstNames } from '@/features/trip/TripParts';
import { useTrip } from '@/features/trip/useTrip';
import { travelerStatus, travelers } from '@/services/tripRules';
import { board, colors, icon } from '@/theme';

/** T03 Travelers: who's on the trip, who's invited, and organizer actions. */
export default function TripPeople() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const h = useTrip(id);
  const names = useFirstNames();
  const [sheet, setSheet] = React.useState<'share' | 'friends' | null>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  if (h.isPending) return <Screen><LoadingState /></Screen>;
  const trip = h.trip;
  if (!trip || h.relation !== 'member') return <Screen><TopBar /><EmptyState title="This trip isn’t available" /></Screen>;
  const hh = { ...h, trip };
  const pending = (trip.invites ?? []).filter((i) => i.status === 'pending').map((i) => i.personId);
  const ids = [trip.ownerId, ...travelers(trip).filter((p) => p !== trip.ownerId), ...pending];
  const isMember = (p: string) => trip.members.some((m) => m.personId === p);
  const act = (op: () => Promise<unknown>) => { setMenuFor(null); void h.run(op); };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Trip settings" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Travelers" body={`${trip.title} · ${travelers(trip).length} people`} />
        {ids.map((pid) => (
          <View key={pid} style={styles.row}>
            <PersonAvatar person={names.people.byId.get(pid)} size={board.activity.avatar} />
            <View style={styles.flex}>
              <Text style={styles.name}>{names.first(pid)}</Text>
              <Text style={styles.small}>{pid === trip.ownerId ? 'Organizer' : isMember(pid) ? 'Member' : travelerStatus(trip, pid) === 'invited' ? 'Invited' : ''}</Text>
            </View>
            {pid === h.me ? <Text style={styles.small}>You</Text> : h.isOrganizer && !h.closed && pid !== trip.ownerId ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${names.first(pid)}`} onPress={() => setMenuFor(pid)} hitSlop={board.inlineGap}>
                <MoreHorizontal size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Text style={styles.note}>Organizers can edit the trip and manage travelers.</Text>
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={styles.spacer} />
        {h.isOrganizer && !h.closed ? <Button label="Invite people" onPress={() => setSheet('share')} /> : null}
      </ScrollView>

      <ShareSheet h={hh} visible={sheet === 'share'} onClose={() => setSheet(null)} onInviteContacts={() => setSheet('friends')} />
      <FriendsSheet h={hh} visible={sheet === 'friends'} onClose={() => setSheet(null)} />

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)}>
        {menuFor ? (
          <>
            <Text style={sheetText.title}>{names.first(menuFor)}</Text>
            {isMember(menuFor) && trip.ownerId === h.me ? (
              <Button label="Make organizer" variant="secondary" onPress={() => act(() => h.services.trips.makeOrganizer(trip.id, menuFor))} />
            ) : null}
            <Button
              label={isMember(menuFor) ? 'Remove from trip' : 'Withdraw invitation'} variant="danger"
              onPress={() => act(() => h.services.trips.removeTraveler(trip.id, menuFor))}
            />
            <Text style={sheetText.body}>Their picks and preferences are removed. The trip stays for everyone else.</Text>
            <Button label="Cancel" variant="ghost" onPress={() => setMenuFor(null)} />
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  flex: { flex: 1 },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: board.settings.row.gap, minHeight: board.settings.row.minHeight,
    paddingVertical: board.listRow.paddingY, borderBottomWidth: 1, borderBottomColor: board.settings.row.border,
  },
  name: { fontSize: board.settings.row.titleSize, fontWeight: '500', color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  note: { ...board.small, color: colors.text.secondary, marginTop: board.listRow.paddingY },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
