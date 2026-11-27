import * as React from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { BottomSheet, SettingsRow, Switch, sheetText } from '@/features/settings/SettingsParts';
import { dateRange } from '@/services/tripRules';
import { board } from '@/theme';
import { useFirstNames } from './TripParts';
import type { TripHook } from './useTrip';

/** Native share with the trip's name and dates only: there are no invite links yet. */
export async function shareTrip(h: TripHook) {
  await Share.share({ message: `Join me in ${h.trip.destination} on Voya — ${dateRange(h.trip.startDate, h.trip.endDate)}.` });
}

/** Friend picker for 05 / T03 / T04 "Invite contacts". Invitations appear in Voya only. */
export function FriendsSheet({ h, visible, onClose }: { h: TripHook; visible: boolean; onClose: () => void }) {
  const { people } = useFirstNames();
  const [picked, setPicked] = React.useState<string[]>([]);
  const on = new Set([...h.trip.members.map((m) => m.personId), ...(h.trip.invites ?? []).filter((i) => i.status === 'pending').map((i) => i.personId)]);
  const eligible = (people.data ?? []).filter((p) => !on.has(p.id));
  const send = async () => {
    const ok = await h.run(() => h.services.trips.invite(h.trip.id, picked));
    if (ok) { setPicked([]); onClose(); }
  };
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={sheetText.title}>Invite friends</Text>
      {eligible.length === 0 ? <Text style={sheetText.body}>Everyone you plan with is already on this trip.</Text> : eligible.map((p) => (
        <SettingsRow
          key={p.id} title={p.displayName}
          right={<Switch label={`Invite ${p.displayName}`} value={picked.includes(p.id)} onChange={(v) => setPicked((l) => (v ? [...l, p.id] : l.filter((x) => x !== p.id)))} />}
        />
      ))}
      <View style={styles.gap} />
      <Button label={picked.length ? `Invite ${picked.length}` : 'Invite'} onPress={() => void send()} disabled={!picked.length} loading={h.busy} />
      <Text style={styles.note}>They’ll see the invitation in Voya. Nothing is sent by email or text in this preview.</Text>
    </BottomSheet>
  );
}

/** T04 Invite to the trip. The board's invite code isn't shown: codes don't exist yet. */
export function ShareSheet({ h, visible, onClose, onInviteContacts }: { h: TripHook; visible: boolean; onClose: () => void; onInviteContacts?: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={sheetText.title}>{`Invite to ${h.trip.title}`}</Text>
      <Text style={sheetText.body}>Share the trip’s name and dates, or invite friends who are on Voya.</Text>
      <SettingsRow title="Share invite link" subtitle="Shares the trip details; invite links arrive later" onPress={() => void shareTrip(h)} />
      {onInviteContacts ? <SettingsRow title="Invite contacts" onPress={onInviteContacts} /> : null}
      <SettingsRow title="Copy invite code" subtitle="Available when invite codes go live" />
      <Button label="Done" variant="ghost" onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  gap: { height: board.inlineGap },
  note: { ...board.small, textAlign: 'center', marginTop: board.inlineGap },
});
