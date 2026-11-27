import * as React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronRight } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TextField, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { Segments, eventStyles, range24 } from '@/features/event/EventParts';
import { alignEnd } from '@/features/event/WhenPicker';
import { useEvent } from '@/features/event/useEvent';
import { BottomSheet, sheetText } from '@/features/settings/SettingsParts';
import { ScheduleItemError, normaliseScheduleItem, sortSchedule } from '@/services/eventRules';
import { ServiceError, type EventScheduleItem } from '@/services';
import { board, colors, icon } from '@/theme';

const E = board.event;

type Draft = Partial<EventScheduleItem> & { key: string; startsAt: string };
type Field = 'Start time' | 'End time';
const VISIBILITY = ['All guests', 'Hosts only'] as const;

let draftSeq = 0;
const toDraft = (i: EventScheduleItem): Draft => ({ ...i, key: i.id });

/**
 * 23 Edit schedule, with EV06 Add / Edit schedule item as a sheet. Edits stay
 * in a draft until "Save schedule"; leaving with unsaved edits asks first.
 * The service refuses a save made over someone else's newer save, and this
 * screen then offers to load the latest schedule (it never overwrites it).
 *
 * Items are listed in time order: the board's drag handles are not shown,
 * because the schedule is ordered by each item's start time.
 */
export default function ScheduleEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useEvent(id);
  const event = h.event;
  const [draft, setDraft] = React.useState<Draft[] | null>(null);
  const [baseVersion, setBaseVersion] = React.useState<number>();
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [field, setField] = React.useState<Field>('Start time');
  const [itemError, setItemError] = React.useState<string>();
  const [sheet, setSheet] = React.useState<'leave' | 'conflict' | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [initial, setInitial] = React.useState('');

  const seed = React.useCallback((items: EventScheduleItem[], version: number) => {
    const d = sortSchedule(items).map(toDraft);
    setDraft(d);
    setInitial(JSON.stringify(d));
    setBaseVersion(version);
  }, []);

  React.useEffect(() => {
    if (event && draft === null) seed(event.schedule, event.version);
  }, [event, draft, seed]);

  if (h.isPending || (event && draft === null)) return <Screen><LoadingState /></Screen>;
  if (!event || !h.can.schedule || h.closed) {
    return <Screen><TopBar /><EmptyState title="Only hosts can edit this schedule" /></Screen>;
  }
  const items = draft ?? [];
  const changed = JSON.stringify(items) !== initial;

  const leave = () => (changed ? setSheet('leave') : router.back());

  const openNew = () => {
    const last = items[items.length - 1];
    const start = last ? new Date(last.endsAt ?? last.startsAt!) : new Date(event.startsAt!);
    setItemError(undefined);
    setField('Start time');
    setEditing({ key: `new-${++draftSeq}`, title: '', startsAt: start.toISOString(), visibility: 'all_guests' });
  };
  const saveItem = () => {
    if (!editing) return;
    try {
      const n = normaliseScheduleItem(editing);
      const next = { ...editing, ...n };
      setDraft(sortSchedule([...items.filter((i) => i.key !== editing.key), next]) as Draft[]);
      setEditing(null);
    } catch (e) {
      setItemError(e instanceof ScheduleItemError ? e.message : 'That item couldn’t be saved.');
    }
  };
  const removeItem = () => {
    if (!editing) return;
    setDraft(items.filter((i) => i.key !== editing.key));
    setEditing(null);
  };
  const reload = async () => {
    const r = await h.refetch();
    const fresh = r.data?.type === 'event' ? r.data : undefined;
    if (fresh) seed(fresh.schedule, fresh.version);
    setSheet(null);
    setError(undefined);
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const payload = items.map(({ key, ...i }) => ({ ...i, id: key.startsWith('new-') ? undefined : key }));
      await h.services.events.saveSchedule(event.id, payload, baseVersion ?? event.version);
      setInitial(JSON.stringify(items)); // saved: nothing left to discard
      await h.refetch();
      router.back();
    } catch (e) {
      if (e instanceof ServiceError && e.code === 'conflict') setSheet('conflict');
      else setError(e instanceof Error ? e.message : 'The schedule couldn’t be saved.');
    } finally {
      setSaving(false);
    }
  };

  const eventStart = new Date(event.startsAt!);
  const pickerValue = editing ? new Date((field === 'End time' ? editing.endsAt : undefined) ?? editing.startsAt ?? event.startsAt!) : eventStart;
  /** A time on the event's day; anything more than 6 hours before the start is after midnight. */
  const onEventDay = (d: Date) => {
    const t = new Date(eventStart);
    t.setHours(d.getHours(), d.getMinutes(), 0, 0);
    if (t.getTime() < eventStart.getTime() - 6 * 3600000) t.setDate(t.getDate() + 1);
    return t;
  };
  const setTime = (d: Date) => {
    if (!editing) return;
    if (field === 'Start time') {
      const s = onEventDay(d);
      setEditing({ ...editing, startsAt: s.toISOString(), endsAt: editing.endsAt ? alignEnd(s, new Date(editing.endsAt)).toISOString() : undefined });
    } else {
      setEditing({ ...editing, endsAt: alignEnd(new Date(editing.startsAt ?? event.startsAt!), d).toISOString() });
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <Stack.Screen options={{ gestureEnabled: !changed }} />
      <TopBar title="Host only" onBack={leave} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Edit schedule" body="Every moment, in its place." />
        {items.length === 0 ? <Text style={styles.small}>Nothing scheduled yet.</Text> : null}
        {items.map((i) => (
          <Pressable
            key={i.key} accessibilityRole="button" accessibilityLabel={`Edit ${i.title}, ${range24(i as EventScheduleItem)}`}
            onPress={() => { setItemError(undefined); setField('Start time'); setEditing(i); }} style={styles.item}
          >
            <View style={styles.flex}>
              <Text style={styles.itemTitle}>{i.title}</Text>
              <Text style={styles.small}>{`${range24(i as EventScheduleItem)}${i.visibility === 'hosts_only' ? ' · Hosts only' : ''}`}</Text>
            </View>
            <ChevronRight size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
          </Pressable>
        ))}
        <View style={styles.tip}>
          <Text style={styles.small}>{'Tap an item to edit its time, location,\nnotes and guest visibility.'}</Text>
        </View>
        {error ? <Text style={eventStyles.error}>{error}</Text> : null}
        <View style={styles.spacer} />
        <Button label="+ Add item" onPress={openNew} />
        <Button label="Save schedule" variant="secondary" onPress={() => void save()} loading={saving} disabled={!changed} />
      </ScrollView>

      <BottomSheet visible={!!editing} onClose={() => setEditing(null)}>
        {editing ? (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={sheetText.title}>{items.some((i) => i.key === editing.key) ? 'Edit schedule item' : 'Add schedule item'}</Text>
            <View style={styles.fields}>
              <TextField label="Title" value={editing.title ?? ''} onChangeText={(t) => setEditing({ ...editing, title: t })} maxLength={60} />
              <Segments items={['Start time', 'End time'] as const} value={field} onChange={setField} />
              <Text style={styles.small}>{range24({ startsAt: editing.startsAt!, endsAt: editing.endsAt })}</Text>
              <DateTimePicker
                value={pickerValue} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} minuteInterval={5}
                onChange={(_, d) => d && setTime(d)} textColor={colors.brand.plum}
              />
              {field === 'End time' && editing.endsAt ? (
                <Pressable accessibilityRole="button" onPress={() => setEditing({ ...editing, endsAt: undefined })} style={styles.link}>
                  <Text style={styles.linkText}>No end time</Text>
                </Pressable>
              ) : null}
              <TextField label="Location / room · optional" value={editing.location ?? ''} onChangeText={(t) => setEditing({ ...editing, location: t })} maxLength={80} />
              <TextField label="Description / notes · optional" value={editing.notes ?? ''} onChangeText={(t) => setEditing({ ...editing, notes: t })} multiline maxLength={300} />
              <TextField label="Guest instructions · optional" value={editing.instructions ?? ''} onChangeText={(t) => setEditing({ ...editing, instructions: t })} multiline maxLength={200} />
              <Text style={styles.label}>Visibility</Text>
              <Segments
                items={VISIBILITY} value={editing.visibility === 'hosts_only' ? 'Hosts only' : 'All guests'}
                onChange={(v) => setEditing({ ...editing, visibility: v === 'Hosts only' ? 'hosts_only' : 'all_guests' })}
              />
            </View>
            {itemError ? <Text style={eventStyles.error}>{itemError}</Text> : null}
            <Button label="Save item" onPress={saveItem} />
            {items.some((i) => i.key === editing.key) ? <Button label="Remove item" variant="ghost" onPress={removeItem} /> : null}
          </ScrollView>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={sheet === 'leave'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Discard your changes?</Text>
        <Text style={sheetText.body}>The schedule stays as it was before you started editing.</Text>
        <Button label="Discard changes" variant="danger" onPress={() => { setSheet(null); router.back(); }} />
        <Button label="Keep editing" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'conflict'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>The schedule changed</Text>
        <Text style={sheetText.body}>Another host saved changes while you were editing, so yours weren’t saved. Load the latest schedule to see their changes, then make your edits again.</Text>
        <Button label="Load the latest schedule" onPress={() => void reload()} />
        <Button label="Keep my draft for now" variant="ghost" onPress={() => setSheet(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  flex: { flex: 1 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: E.editorItem.gap, paddingVertical: E.editorItem.paddingY,
    borderBottomWidth: 1, borderBottomColor: E.editorItem.border,
  },
  itemTitle: { fontSize: E.editorItem.titleSize, fontWeight: '700', color: colors.brand.plum, marginBottom: E.editorItem.titleMarginBottom },
  small: { ...board.small, color: colors.text.secondary },
  label: { fontSize: board.field.labelSize, color: colors.text.secondary },
  tip: {
    padding: board.hangout.selection.padding, backgroundColor: board.hangout.selection.background,
    borderRadius: board.hangout.selection.radius, marginTop: board.hangout.selection.marginY * 2,
  },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  fields: { gap: board.inlineGap, marginBottom: board.inlineGap },
  link: { alignSelf: 'center', paddingVertical: board.inlineGap },
  linkText: { fontSize: board.subtleControl.fontSize, color: colors.brand.violet },
});
