import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, MoreHorizontal, Send } from 'lucide-react-native';
import { AvatarStack, Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { PersonAvatar } from '@/features/event/EventParts';
import { FriendsSheet, shareTrip } from '@/features/trip/InviteSheet';
import { StepDashes, useFirstNames } from '@/features/trip/TripParts';
import { useTrip, type TripHook } from '@/features/trip/useTrip';
import { travelerStatus, type TravelerStatus } from '@/services/tripRules';
import { board, colors, icon } from '@/theme';

const LABEL: Record<TravelerStatus, string> = {
  ready: 'Ready', choosing: 'Choosing preferences', joined: 'Joined', invited: 'Invite sent', declined: 'Can’t come',
};

/** Everyone on the trip or invited to it, organizer first. */
export function tripPeople(h: TripHook) {
  const ids = [h.trip.ownerId, ...h.trip.members.map((m) => m.personId), ...(h.trip.invites ?? []).map((i) => i.personId)];
  return [...new Set(ids)];
}

/** 05 Who's coming? (step 3 of creating a trip). */
export default function Travelers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useTrip(id);
  const names = useFirstNames();
  const [inviting, setInviting] = React.useState(false);
  if (h.isPending) return <Screen><LoadingState /></Screen>;
  const trip = h.trip;
  if (!trip || h.relation !== 'member') return <Screen><TopBar /><EmptyState title="This trip isn’t available" /></Screen>;
  const hh = { ...h, trip };
  const ids = tripPeople(hh);
  const going = ids.filter((p) => travelerStatus(trip, p) !== 'declined');

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="" right={<StepDashes step={3} />} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Who's coming?" body="The best part of the trip." />
        <View style={styles.count}>
          <Text style={styles.countText}>{`${going.length} ${going.length === 1 ? 'traveler' : 'travelers'}`}</Text>
          <AvatarStack names={going.map((p) => names.people.byId.get(p)?.displayName ?? '')} />
        </View>
        {ids.map((pid) => {
          const status = travelerStatus(trip, pid);
          const person = names.people.byId.get(pid);
          return (
            <View key={pid} style={styles.row}>
              <PersonAvatar person={person} size={board.activity.avatar} />
              <View style={styles.flex}>
                <Text style={styles.name}>{person?.firstName ?? 'Former traveler'}</Text>
                <Text style={styles.small}>{pid === trip.ownerId ? `Organizer · ${LABEL[status]}` : LABEL[status]}</Text>
              </View>
              {status === 'ready' || status === 'joined' ? <Check size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
                : status === 'choosing' ? <MoreHorizontal size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
                  : status === 'invited' ? <Send size={icon.sm} color={colors.text.secondary} strokeWidth={icon.strokeWidth} /> : null}
            </View>
          );
        })}
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={styles.spacer} />
        <Button label="Share invite link" onPress={() => void shareTrip(hh)} />
        {h.isOrganizer ? <Button label="Invite contacts" variant="secondary" onPress={() => setInviting(true)} /> : null}
        <Button label="Set preferences" onPress={() => router.push(`/trip/${trip.id}/preferences?setup=1`)} />
      </ScrollView>
      <FriendsSheet h={hh} visible={inviting} onClose={() => setInviting(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  flex: { flex: 1 },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  count: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: board.listRow.paddingY },
  countText: { fontSize: board.trip.countSize, fontWeight: '700', color: colors.brand.plum },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: board.settings.row.gap, minHeight: board.settings.row.minHeight,
    paddingVertical: board.listRow.paddingY, borderBottomWidth: 1, borderBottomColor: board.settings.row.border,
  },
  name: { fontSize: board.settings.row.titleSize, fontWeight: '700', color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
