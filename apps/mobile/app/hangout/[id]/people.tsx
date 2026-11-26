import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { usePeople } from '@/features/catalog';
import { initialsOf } from '@/features/profile/avatar';
import { useHangout } from '@/features/hangout/useHangout';
import { BottomSheet, Switch, sheetText } from '@/features/settings/SettingsParts';
import type { HangoutResponse } from '@/services';
import { board, colors, icon } from '@/theme';

const STATUS: Record<HangoutResponse, string> = { pending: 'Invited', in: 'In', maybe: 'Maybe', declined: 'Can’t make it' };

/**
 * H03 Who's in? Everyone invited and how they answered. The organizer can
 * remove someone (their votes go, the plan stays) and invite more friends.
 */
export default function People() {
  const { id, invite } = useLocalSearchParams<{ id: string; invite?: string }>();
  const h = useHangout(id);
  const people = usePeople();
  const [inviting, setInviting] = React.useState(invite === '1');
  const [picked, setPicked] = React.useState<string[]>([]);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const hangout = h.hangout;

  if (h.isPending) return <Screen><LoadingState /></Screen>;
  if (!hangout || h.relation !== 'member') return <Screen><TopBar /><EmptyState title="This hangout isn’t available" /></Screen>;

  const rows = [
    { personId: hangout.ownerId, label: 'Organizer' },
    ...(hangout.invites ?? []).map((i) => ({ personId: i.personId, label: STATUS[i.status] })),
  ];
  const invitedIds = new Set(rows.map((r) => r.personId));
  const declined = new Set((hangout.invites ?? []).filter((i) => i.status === 'declined').map((i) => i.personId));
  const eligible = (people.data ?? []).filter((p) => !invitedIds.has(p.id) || declined.has(p.id));

  const sendInvites = async () => {
    const ok = await h.run(() => h.services.hangouts.invite(hangout.id, picked));
    if (ok) { setPicked([]); setInviting(false); }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title={hangout.title} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Who's in?" body="Good company makes the plan." />
        {rows.map((r) => {
          const person = people.byId.get(r.personId);
          const isMe = r.personId === h.me;
          return (
            <View key={r.personId} style={styles.row}>
              <View style={styles.avatar}><Text style={styles.initials}>{initialsOf(person?.firstName, person?.lastName)}</Text></View>
              <View style={styles.flex}>
                <Text style={styles.name}>{person?.firstName ?? 'Former member'}</Text>
                <Text style={styles.small}>{r.label}</Text>
              </View>
              {isMe ? <Text style={styles.small}>You</Text> : h.isOrganizer && r.personId !== hangout.ownerId ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${person?.firstName ?? 'this person'}`} onPress={() => setMenuFor(r.personId)} hitSlop={board.inlineGap}>
                  <MoreHorizontal size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={styles.spacer} />
        {h.isOrganizer ? <Button label="Invite another friend" onPress={() => setInviting(true)} /> : null}
      </ScrollView>

      <BottomSheet visible={inviting} onClose={() => setInviting(false)}>
        <Text style={sheetText.title}>Invite friends</Text>
        {eligible.length === 0 ? <Text style={sheetText.body}>Everyone you plan with is already invited.</Text> : eligible.map((p) => (
          <View key={p.id} style={styles.row}>
            <Text style={[styles.name, styles.flex]}>{p.displayName}</Text>
            <Switch label={`Invite ${p.displayName}`} value={picked.includes(p.id)} onChange={(v) => setPicked((l) => (v ? [...l, p.id] : l.filter((x) => x !== p.id)))} />
          </View>
        ))}
        <Button label={picked.length ? `Invite ${picked.length}` : 'Invite'} onPress={() => void sendInvites()} disabled={!picked.length} loading={h.busy} />
        <Text style={styles.note}>They’ll see the invitation in Voya. Nothing is sent by email or text in this preview.</Text>
      </BottomSheet>

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)}>
        <Text style={sheetText.title}>{`Remove ${people.byId.get(menuFor ?? '')?.firstName ?? 'this person'}?`}</Text>
        <Text style={sheetText.body}>They’ll lose access to this hangout and their votes are removed. Their suggestions stay.</Text>
        <Button label="Remove" variant="danger" onPress={() => { const pid = menuFor!; setMenuFor(null); void h.run(() => h.services.hangouts.removePerson(hangout.id, pid)); }} />
        <Button label="Cancel" variant="ghost" onPress={() => setMenuFor(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: board.settings.row.gap, minHeight: board.settings.row.minHeight,
    paddingVertical: board.listRow.paddingY, borderBottomWidth: 1, borderBottomColor: board.settings.row.border,
  },
  avatar: {
    width: board.activity.avatar - 2, height: board.activity.avatar - 2, borderRadius: board.activity.avatar,
    backgroundColor: board.avatar.tints[0], alignItems: 'center', justifyContent: 'center',
  },
  initials: { fontSize: board.avatar.fontSize, fontWeight: board.avatar.fontWeight, color: colors.brand.plum },
  name: { fontSize: board.settings.row.titleSize, fontWeight: '500', color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  spacer: { flex: 1, minHeight: board.listRow.paddingY * 2 },
  note: { ...board.small, color: colors.text.secondary, textAlign: 'center', marginTop: board.inlineGap },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
