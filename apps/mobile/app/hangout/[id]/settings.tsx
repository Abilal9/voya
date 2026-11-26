import * as React from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AvatarStack, Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { usePeople } from '@/features/catalog';
import { whenLabel } from '@/features/hangout/HangoutParts';
import { useHangout } from '@/features/hangout/useHangout';
import { BottomSheet, GroupLabel, SettingsRow, Switch, sheetText } from '@/features/settings/SettingsParts';
import { useSettings } from '@/features/settings/useSettings';
import { peopleCounts } from '@/services/hangoutRules';
import { board, colors } from '@/theme';

/**
 * H01 Hangout settings, with the H04 Share sheet and confirmations for
 * leaving and deleting. Organizer-only rows are hidden from participants.
 * Sharing uses the OS share sheet with a plain description: there are no
 * real invite links yet, so none are made up.
 */
export default function HangoutSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useHangout(id);
  const people = usePeople();
  const settings = useSettings();
  const [sheet, setSheet] = React.useState<'share' | 'leave' | 'delete' | null>(null);
  const hangout = h.hangout;

  if (h.isPending) return <Screen><LoadingState /></Screen>;
  if (!hangout || h.relation !== 'member') return <Screen><TopBar /><EmptyState title="This hangout isn’t available" /></Screen>;

  const muted = (settings.data?.mutedPlans ?? []).includes(hangout.id);
  const counts = peopleCounts(hangout);
  const names = [hangout.ownerId, ...(hangout.invites ?? []).filter((i) => i.status !== 'declined').map((i) => i.personId)]
    .map((pid) => people.byId.get(pid)?.displayName ?? '');

  const share = async () => {
    await Share.share({
      message: `Join "${hangout.title}" on Voya — ${whenLabel(hangout.startsAt)}, ${hangout.city}. ${hangout.template}.`,
    });
  };
  const leave = async () => {
    const ok = await h.run(() => h.services.plans.leave(hangout.id));
    if (ok !== undefined) router.replace('/(tabs)');
  };
  const remove = async () => {
    const ok = await h.run(() => h.services.hangouts.remove(hangout.id));
    if (ok !== undefined) router.replace('/(tabs)');
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title={hangout.title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Hangout settings" body={`${hangout.title} · ${h.isOrganizer ? 'Organizer' : 'Participant'}`} />
        {h.isOrganizer ? <SettingsRow title="Edit details" onPress={() => router.push(`/hangout/${hangout.id}/edit`)} /> : null}
        <SettingsRow title="People" subtitle={`${counts.invited} invited · ${counts.confirmed} confirmed`} onPress={() => router.push(`/hangout/${hangout.id}/people`)} />
        {h.isOrganizer ? <SettingsRow title="Invite friends" onPress={() => router.push(`/hangout/${hangout.id}/people?invite=1`)} /> : null}
        <SettingsRow title="Share hangout" onPress={() => setSheet('share')} />
        <SettingsRow
          title="Notifications"
          right={<Switch label="Notifications for this hangout" value={!muted} onChange={(on) => settings.update({
            mutedPlans: on ? (settings.data?.mutedPlans ?? []).filter((p) => p !== hangout.id) : [...(settings.data?.mutedPlans ?? []), hangout.id],
          })} />}
        />
        <View style={styles.spacer} />
        <SettingsRow title="Leave hangout" onPress={() => setSheet('leave')} />
        {h.isOrganizer ? (
          <>
            <GroupLabel>Organizer only</GroupLabel>
            <SettingsRow danger title="Delete hangout" onPress={() => setSheet('delete')} />
          </>
        ) : null}
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
      </ScrollView>

      <BottomSheet visible={sheet === 'share'} onClose={() => setSheet(null)}>
        <View style={styles.stack}><AvatarStack names={names} /></View>
        <Text style={sheetText.title}>Bring everyone in</Text>
        <Text style={sheetText.body}>{`${hangout.title} · ${hangout.city}\n${hangout.template}`}</Text>
        <SettingsRow title="Share invite link" subtitle="Shares the plan details; invite links arrive later" onPress={() => void share()} />
        {h.isOrganizer ? <SettingsRow title="Invite contacts" onPress={() => { setSheet(null); router.push(`/hangout/${hangout.id}/people?invite=1`); }} /> : null}
        <SettingsRow title="Copy link" subtitle="Available when invite links go live" />
        <Button label="Done" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'leave'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Leave this hangout?</Text>
        <Text style={sheetText.body}>
          {h.isOrganizer
            ? 'The plan stays for everyone else and the next person on it becomes the organizer.'
            : 'The plan stays for everyone else. Your votes are removed.'}
        </Text>
        <Button label="Leave hangout" variant="danger" onPress={() => void leave()} loading={h.busy} />
        <Button label="Cancel" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'delete'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Delete this hangout?</Text>
        <Text style={sheetText.body}>It will be removed for everyone, with its suggestions and votes.</Text>
        <Button label="Delete hangout" variant="danger" onPress={() => void remove()} loading={h.busy} />
        <Button label="Cancel" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  spacer: { flex: 1, minHeight: board.listRow.paddingY * 2 },
  stack: { alignItems: 'center', marginBottom: board.listRow.paddingY },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
