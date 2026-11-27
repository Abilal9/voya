import { usePhotoAccessSheet } from '@/features/permissions/PhotoAccess';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Screen, Text, TopBar } from '@/components/ui';
import { authStyles } from '@/features/auth/AuthParts';
import { usePeople } from '@/features/catalog';
import { Cover, CoverButton, FormRow, clockRange, eventStyles, longDate, pickCover } from '@/features/event/EventParts';
import { WhenSheet } from '@/features/event/WhenPicker';
import { BottomSheet, Switch, sheetText } from '@/features/settings/SettingsParts';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board, colors } from '@/theme';

const E = board.event;
const H = board.hangout;

/** Two Saturdays out at 7:00 PM, the board's example, as a starting suggestion. */
function suggestedStart() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7) + 7);
  d.setHours(19, 0, 0, 0);
  return d;
}

/** 18 Create Event. Cover, name, date & time, location, hosts, details. */
export default function NewEvent() {
  const router = useRouter();
  const { showPhotoAccess, photoAccessSheet } = usePhotoAccessSheet();
  const services = useServices();
  const qc = useQueryClient();
  const account = useSession((s) => s.account);
  const me = account?.personId ?? account?.id;
  const people = usePeople();

  const [cover, setCover] = React.useState<string | undefined>();
  const [title, setTitle] = React.useState('');
  const [start, setStart] = React.useState(suggestedStart);
  const [end, setEnd] = React.useState<Date | undefined>();
  const [venue, setVenue] = React.useState('');
  const [hosts, setHosts] = React.useState<string[]>([]);
  const [details, setDetails] = React.useState('');
  const [sheet, setSheet] = React.useState<'when' | 'hosts' | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  const firstName = (id?: string) => (id ? people.byId.get(id)?.firstName : undefined) ?? '';
  const hostNames = [account?.firstName ?? firstName(me), ...hosts.map(firstName)].filter(Boolean);
  const hostLabel = hostNames.length > 1 ? `${hostNames.slice(0, -1).join(', ')} & ${hostNames[hostNames.length - 1]}` : hostNames[0] ?? 'You';

  const chooseCover = async () => {
    const picked = await pickCover();
    if (!picked) return;
    if ('error' in picked) return picked.denied ? showPhotoAccess() : setError(picked.error);
    setCover(picked.uri);
  };

  const create = async () => {
    if (busy) return; // no duplicate events from repeated taps
    setError(undefined);
    if (!title.trim()) return setError('Give your event a name.');
    if (!venue.trim()) return setError('Add where it happens.');
    if (start.getTime() < Date.now()) return setError('Choose a date that hasn’t passed.');
    setBusy(true);
    try {
      const e = await services.plans.createEvent({
        title, venue, startsAt: start.toISOString(), endsAt: end?.toISOString(),
        description: details, coverUri: cover, hosts,
      });
      await qc.invalidateQueries({ queryKey: ['plans'] });
      
      router.replace(`/event/${e.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The event could not be created.');
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="New event" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View>
            <Cover pendingUri={cover} style={styles.cover} />
            <CoverButton label={cover ? 'Change cover' : '+ Add cover'} onPress={() => void chooseCover()} inset={E.createCover.inset} />
          </View>
          <FormRow label="Event name">
            <TextInput
              value={title} onChangeText={setTitle} placeholder="Name your event" placeholderTextColor={board.field.placeholder}
              maxLength={80} accessibilityLabel="Event name" style={styles.input}
            />
          </FormRow>
          <FormRow label="Date & time" onPress={() => setSheet('when')}>
            <Text style={styles.value}>{longDate(start.toISOString())}</Text>
            <Text style={styles.muted}>{clockRange(start.toISOString(), end?.toISOString())}</Text>
          </FormRow>
          <FormRow label="Location">
            <TextInput
              value={venue} onChangeText={setVenue} placeholder="Where is it?" placeholderTextColor={board.field.placeholder}
              maxLength={120} accessibilityLabel="Location" style={styles.input}
            />
          </FormRow>
          <FormRow label="Hosts" onPress={() => setSheet('hosts')}>{hostLabel}</FormRow>
          <FormRow label="Event details" last>
            <TextInput
              value={details} onChangeText={setDetails} placeholder="Dress code, a little note, anything to know…"
              placeholderTextColor={board.field.placeholder} multiline maxLength={1000}
              accessibilityLabel="Event details" style={[styles.input, styles.details]}
            />
          </FormRow>
          {error ? <Text style={eventStyles.error}>{error}</Text> : null}
          <View style={authStyles.foot}>
            <Button label="Create event" onPress={() => void create()} loading={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <WhenSheet visible={sheet === 'when'} onClose={() => setSheet(null)} start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />

      <BottomSheet visible={sheet === 'hosts'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Hosts</Text>
        <Text style={sheetText.body}>Hosts can edit the event, manage guests and the schedule. You can add co-hosts later.</Text>
        {(people.data ?? []).filter((p) => p.id !== me).map((p) => (
          <View key={p.id} style={styles.pickRow}>
            <Text style={[styles.value, styles.flex]}>{p.displayName}</Text>
            <Switch
              label={`Host with ${p.displayName}`} value={hosts.includes(p.id)}
              onChange={(v) => setHosts((l) => (v ? [...l, p.id] : l.filter((x) => x !== p.id)))}
            />
          </View>
        ))}
        <Button label="Done" onPress={() => setSheet(null)} />
      </BottomSheet>
      {photoAccessSheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  cover: { height: E.createCover.height, marginBottom: board.inlineGap },
  input: { fontSize: H.formRow.fontSize, color: colors.brand.plum, padding: 0 },
  details: { minHeight: board.settings.bioMinHeight / 2, textAlignVertical: 'top' },
  value: { fontSize: H.formRow.fontSize, color: colors.brand.plum },
  muted: { ...board.small, color: colors.text.secondary },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: board.inlineGap, paddingVertical: board.listRow.paddingY,
    borderBottomWidth: 1, borderBottomColor: board.listRow.borderColor,
  },
});
