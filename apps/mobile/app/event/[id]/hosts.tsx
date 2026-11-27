import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { usePeople } from '@/features/catalog';
import { PersonAvatar, eventStyles } from '@/features/event/EventParts';
import { useEvent } from '@/features/event/useEvent';
import { BottomSheet, SettingsRow, Switch, sheetText } from '@/features/settings/SettingsParts';
import { hostsInOrder, permissionsOf } from '@/services/eventRules';
import type { CohostPermissions, PlanMember } from '@/services';
import { board, colors, icon } from '@/theme';

const PERMISSIONS: { key: keyof CohostPermissions; title: string }[] = [
  { key: 'details', title: 'Edit event details' },
  { key: 'guests', title: 'Manage guests' },
  { key: 'schedule', title: 'Edit the schedule' },
];

/**
 * EV03 Hosts & co-hosts (hosts only). Hosts can do everything; co-hosts can do
 * what "Manage permissions" allows. The event's creator always stays a host.
 */
export default function Hosts() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const h = useEvent(id);
  const people = usePeople();
  const [sheet, setSheet] = React.useState<'add' | 'permissions' | null>(null);
  const [menuFor, setMenuFor] = React.useState<PlanMember | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);

  if (h.isPending) return <Screen><LoadingState /></Screen>;
  const event = h.event;
  if (!event || !h.isHost) return <Screen><TopBar /><EmptyState title="Only hosts can manage hosts" /></Screen>;
  const open = !h.closed;
  const perms = permissionsOf(event);
  const hosting = new Set(event.members.map((m) => m.personId));
  const eligible = (people.data ?? []).filter((p) => !hosting.has(p.id));
  const first = (pid: string) => people.byId.get(pid)?.firstName ?? 'Former member';

  const act = (op: () => Promise<unknown>) => { setMenuFor(null); void h.run(op); };
  const add = async () => {
    const ok = await h.run(() => h.services.events.addCohosts(event.id, picked));
    if (ok) { setPicked([]); setSheet(null); }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Event settings" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Hosts & co-hosts" body={event.title} />
        {hostsInOrder(event).map((m) => (
          <View key={m.personId} style={styles.row}>
            <PersonAvatar person={people.byId.get(m.personId)} size={board.activity.avatar} />
            <View style={styles.flex}>
              <Text style={styles.name}>{first(m.personId)}</Text>
              <Text style={styles.small}>{m.role === 'co-host' ? 'Co-host' : 'Host'}</Text>
            </View>
            {m.personId === h.me ? <Text style={styles.small}>You</Text> : open && m.personId !== event.ownerId ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Manage ${first(m.personId)}`} onPress={() => setMenuFor(m)} hitSlop={board.inlineGap}>
                <MoreHorizontal size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <SettingsRow title="Manage permissions" subtitle="Choose what co-hosts can manage" onPress={open ? () => setSheet('permissions') : undefined} />
        {h.error ? <Text style={eventStyles.error}>{h.error}</Text> : null}
        <View style={styles.spacer} />
        {open ? <Button label="Add co-host" onPress={() => setSheet('add')} /> : null}
      </ScrollView>

      <BottomSheet visible={sheet === 'permissions'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>What co-hosts can manage</Text>
        <Text style={sheetText.body}>Hosts can always do everything, including cancelling the event.</Text>
        {PERMISSIONS.map((p) => (
          <SettingsRow
            key={p.key} title={p.title}
            right={<Switch label={p.title} value={perms[p.key]} onChange={(v) => void h.run(() => h.services.events.setCohostPermissions(event.id, { ...perms, [p.key]: v }))} />}
          />
        ))}
        <Button label="Done" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'add'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Add co-host</Text>
        <Text style={sheetText.body}>A guest who becomes a co-host moves off the guest list.</Text>
        {eligible.length === 0 ? <Text style={sheetText.body}>Everyone you plan with is already hosting.</Text> : eligible.map((p) => (
          <View key={p.id} style={styles.row}>
            <Text style={[styles.name, styles.flex]}>{p.displayName}</Text>
            <Switch label={`Make ${p.displayName} a co-host`} value={picked.includes(p.id)} onChange={(v) => setPicked((l) => (v ? [...l, p.id] : l.filter((x) => x !== p.id)))} />
          </View>
        ))}
        <Button label={picked.length ? `Add ${picked.length}` : 'Add'} onPress={() => void add()} disabled={!picked.length} loading={h.busy} />
      </BottomSheet>

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)}>
        {menuFor ? (
          <>
            <Text style={sheetText.title}>{first(menuFor.personId)}</Text>
            <Button
              label={menuFor.role === 'co-host' ? 'Make host' : 'Make co-host'} variant="secondary"
              onPress={() => act(() => h.services.events.setHostRole(event.id, menuFor.personId, menuFor.role === 'co-host' ? 'host' : 'co-host'))}
            />
            <Button label="Remove from hosts" variant="danger" onPress={() => act(() => h.services.events.removeHost(event.id, menuFor.personId))} />
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
  row: {
    flexDirection: 'row', alignItems: 'center', gap: board.settings.row.gap, minHeight: board.settings.row.minHeight,
    paddingVertical: board.listRow.paddingY, borderBottomWidth: 1, borderBottomColor: board.settings.row.border,
  },
  name: { fontSize: board.settings.row.titleSize, fontWeight: '500', color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  spacer: { flex: 1, minHeight: board.listRow.paddingY * 2 },
});
