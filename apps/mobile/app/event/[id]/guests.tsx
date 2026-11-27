import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Check, MoreHorizontal, Search as SearchIcon } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TextField, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { usePeople } from '@/features/catalog';
import { PersonAvatar, eventStyles } from '@/features/event/EventParts';
import { useEvent } from '@/features/event/useEvent';
import { BottomSheet, Switch, sheetText } from '@/features/settings/SettingsParts';
import { RSVP_LABEL, rsvpCounts } from '@/services/eventRules';
import type { EventGuest, RSVP } from '@/services';
import { board, colors, icon } from '@/theme';

const E = board.event;
const FILTERS: { key: RSVP | 'all'; label: string }[] = [
  { key: 'all', label: 'All guests' }, { key: 'going', label: 'Going' }, { key: 'maybe', label: 'Maybe' },
  { key: 'pending', label: 'Awaiting' }, { key: 'declined', label: 'Can’t attend' },
];

const nameParts = (g: EventGuest) => {
  const [first, ...rest] = g.displayName.split(' ');
  return { firstName: first ?? '', lastName: rest.join(' ') || undefined };
};

/**
 * 40 Guests (hosts, and co-hosts allowed to manage guests). Counts come from
 * the event's guest list. Invitations only appear inside Voya: nothing is sent
 * by email or text.
 */
export default function Guests() {
  const { id, invite: inviteParam } = useLocalSearchParams<{ id: string; invite?: string }>();
  const h = useEvent(id);
  const people = usePeople();
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<RSVP | 'all'>('all');
  const [sheet, setSheet] = React.useState<'filter' | 'invite' | null>(inviteParam === '1' ? 'invite' : null);
  const [menuFor, setMenuFor] = React.useState<EventGuest | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [name, setName] = React.useState('');

  if (h.isPending) return <Screen><LoadingState /></Screen>;
  const event = h.event;
  if (!event || !h.managing) return <Screen><TopBar /><EmptyState title="Only hosts can see the guest list" /></Screen>;
  const canManage = h.can.guests && !h.closed;
  const counts = rsvpCounts(event);
  const q = query.trim().toLowerCase();
  const shown = event.guests.filter((g) => (filter === 'all' || g.rsvp === filter) && (!q || g.displayName.toLowerCase().includes(q)));
  const listed = new Set([...event.guests.map((g) => g.personId), ...event.members.map((m) => m.personId)]);
  const eligible = (people.data ?? []).filter((p) => !listed.has(p.id));

  const invite = async () => {
    const ok = await h.run(async () => {
      if (picked.length) await h.services.events.invite(event.id, picked);
      if (name.trim()) await h.services.events.addGuest(event.id, name);
      return true;
    });
    if (ok) { setPicked([]); setName(''); setSheet(null); }
  };
  const act = (op: () => Promise<unknown>) => { setMenuFor(null); void h.run(op); };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Host only" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Guests" body={event.title} />
        <View style={styles.panel}>
          {[[counts.going, 'Going'], [counts.maybe, 'Maybe'], [counts.awaiting, 'Awaiting'], [counts.declined, 'Can’t attend']].map(([v, l]) => (
            <View key={l} style={styles.stat} accessibilityLabel={`${v} ${l}`}>
              <Text style={styles.statValue}>{String(v)}</Text>
              <Text style={styles.statLabel}>{l}</Text>
            </View>
          ))}
        </View>
        <View style={styles.search}>
          <SearchIcon size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
          <TextInput
            value={query} onChangeText={setQuery} placeholder="Search guests" placeholderTextColor={board.field.placeholder}
            accessibilityLabel="Search guests" style={styles.input} returnKeyType="search"
          />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Showing ${FILTERS.find((f) => f.key === filter)!.label}. Change`} onPress={() => setSheet('filter')} style={styles.filter}>
          <Text style={styles.filterText}>{FILTERS.find((f) => f.key === filter)!.label}</Text>
        </Pressable>
        {shown.length === 0 ? (
          <Text style={styles.small}>{event.guests.length ? 'No guests match.' : 'No guests yet. Invite the people you’d love to celebrate with.'}</Text>
        ) : shown.map((g) => (
          <View key={g.id} style={styles.row}>
            <PersonAvatar person={nameParts(g)} size={board.activity.avatar} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>{g.displayName}</Text>
              <Text style={styles.small}>{`${RSVP_LABEL[g.rsvp]}${g.personId ? '' : ' · Not on Voya'}`}</Text>
            </View>
            {canManage ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${g.displayName}`} onPress={() => setMenuFor(g)} hitSlop={board.inlineGap}>
                <MoreHorizontal size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {h.error ? <Text style={eventStyles.error}>{h.error}</Text> : null}
        <View style={styles.spacer} />
        {canManage && h.can.invite ? <Button label="Invite guests" onPress={() => setSheet('invite')} /> : null}
      </ScrollView>

      <BottomSheet visible={sheet === 'filter'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Show</Text>
        {FILTERS.map((f) => (
          <Pressable key={f.key} accessibilityRole="button" onPress={() => { setFilter(f.key); setSheet(null); }} style={styles.row}>
            <Text style={[styles.name, styles.flex]}>{f.label}</Text>
            {f.key === filter ? <Check size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} /> : null}
          </Pressable>
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'invite'} onClose={() => setSheet(null)}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={sheetText.title}>Invite guests</Text>
          {eligible.map((p) => (
            <View key={p.id} style={styles.row}>
              <Text style={[styles.name, styles.flex]}>{p.displayName}</Text>
              <Switch label={`Invite ${p.displayName}`} value={picked.includes(p.id)} onChange={(v) => setPicked((l) => (v ? [...l, p.id] : l.filter((x) => x !== p.id)))} />
            </View>
          ))}
          <View style={styles.byName}>
            <TextField label="Someone not on Voya" value={name} onChangeText={setName} placeholder="Their name" maxLength={60} />
          </View>
          <Button label="Invite" onPress={() => void invite()} disabled={!picked.length && !name.trim()} loading={h.busy} />
          <Text style={[eventStyles.tinyCenter, styles.note]}>Voya friends see the invitation in the app. Nothing is sent by email or text in this preview.</Text>
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)}>
        {menuFor ? (
          <>
            <Text style={sheetText.title}>{menuFor.displayName}</Text>
            <Text style={sheetText.body}>{menuFor.personId ? 'Voya guests answer for themselves. You can still record an answer they gave you.' : 'Record their answer.'}</Text>
            {(['going', 'maybe', 'declined'] as const).filter((r) => r !== menuFor.rsvp).map((r) => (
              <Button key={r} label={`Mark as ${RSVP_LABEL[r].toLowerCase()}`} variant="secondary" onPress={() => act(() => h.services.events.setRsvp(event.id, menuFor.id, r))} />
            ))}
            <Button
              label={menuFor.rsvp === 'pending' ? 'Withdraw invitation' : 'Remove from guest list'} variant="danger"
              onPress={() => act(() => h.services.events.removeGuest(event.id, menuFor.id))}
            />
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
  panel: {
    flexDirection: 'row', justifyContent: 'space-around', padding: E.statsPanel.padding, borderRadius: E.statsPanel.radius,
    backgroundColor: E.statsPanel.background, marginTop: E.statsPanel.marginTop,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: E.statsPanel.valueSize, fontWeight: '700', color: colors.brand.plum, marginBottom: E.stats.valueMarginBottom },
  statLabel: { fontSize: E.statsPanel.labelSize, color: colors.text.secondary },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: board.search.field.gap, padding: board.search.field.padding,
    borderRadius: board.search.field.radius, backgroundColor: board.search.field.background, minHeight: board.search.field.minHeight,
    marginTop: board.listRow.paddingY,
  },
  input: { flex: 1, fontSize: board.search.field.fontSize, color: colors.brand.plum, padding: 0 },
  filter: { alignSelf: 'flex-start', paddingVertical: board.listRow.paddingY },
  filterText: { ...board.small, color: colors.brand.violet },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: board.settings.row.gap, minHeight: board.settings.row.minHeight,
    paddingVertical: board.listRow.paddingY, borderBottomWidth: 1, borderBottomColor: board.settings.row.border,
  },
  name: { fontSize: board.settings.row.titleSize, fontWeight: '600', color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  byName: { marginVertical: board.listRow.paddingY },
  note: { marginTop: board.inlineGap },
});
