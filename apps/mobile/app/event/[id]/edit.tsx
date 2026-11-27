import * as React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, EmptyState, LoadingState, Screen, Text, TextField, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { Cover, CoverButton, eventStyles, pickCover } from '@/features/event/EventParts';
import { WhenSheet, type WhenField } from '@/features/event/WhenPicker';
import { useEvent } from '@/features/event/useEvent';
import { BottomSheet, sheetText } from '@/features/settings/SettingsParts';
import { board } from '@/theme';

const E = board.event;

/**
 * EV02 Edit event: cover, name, date, start and end time, location and
 * description (the board's fields). Needs the "details" permission.
 * Leaving with unsaved changes asks first.
 */
export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useEvent(id);
  const event = h.event;
  const [title, setTitle] = React.useState<string>();
  const [start, setStart] = React.useState<Date>();
  const [end, setEnd] = React.useState<Date | null>();
  const [venue, setVenue] = React.useState<string>();
  const [description, setDescription] = React.useState<string>();
  const [cover, setCover] = React.useState<string>();
  const [when, setWhen] = React.useState<WhenField | null>(null);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  if (h.isPending) return <Screen><LoadingState /></Screen>;
  if (!event || !h.can.edit || h.closed) return <Screen><TopBar /><EmptyState title="You can’t edit this event" /></Screen>;

  const t = title ?? event.title;
  const s = start ?? new Date(event.startsAt!);
  const e = end === undefined ? (event.endsAt ? new Date(event.endsAt) : undefined) : end ?? undefined;
  const v = venue ?? event.venue ?? '';
  const d = description ?? event.description ?? '';
  const changed = !saved && (title !== undefined || start !== undefined || end !== undefined || venue !== undefined || description !== undefined || cover !== undefined);

  const chooseCover = async () => {
    const picked = await pickCover();
    if (!picked) return;
    if ('error' in picked) return h.setError(picked.error);
    setCover(picked.uri);
  };
  const save = async () => {
    const ok = await h.run(() => h.services.events.update(event.id, {
      title: t, venue: v, description: d, startsAt: s.toISOString(), endsAt: e ? e.toISOString() : '', coverUri: cover,
    }));
    if (ok) {
      setSaved(true);
      router.back();
    }
  };
  const leave = () => (changed ? setConfirmLeave(true) : router.back());

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <Stack.Screen options={{ gestureEnabled: !changed }} />
      <TopBar title="Event settings" onBack={leave} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <AuthIntro tight title="Edit event" />
          <View style={styles.coverWrap}>
            <Cover event={event} pendingUri={cover} style={styles.cover} />
            <CoverButton label="Change cover" onPress={() => void chooseCover()} inset={E.coverEdit.inset} />
          </View>
          <View style={styles.fields}>
            <TextField label="Event name" value={t} onChangeText={setTitle} maxLength={80} />
            <Pressable accessibilityRole="button" onPress={() => setWhen('Date')}>
              <View pointerEvents="none"><TextField label="Date" value={s.toLocaleDateString()} editable={false} /></View>
            </Pressable>
            <View style={styles.pair}>
              <Pressable accessibilityRole="button" style={styles.flex} onPress={() => setWhen('Start time')}>
                <View pointerEvents="none"><TextField label="Start time" value={s.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} editable={false} /></View>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.flex} onPress={() => setWhen('End time')}>
                <View pointerEvents="none"><TextField label="End time" value={e ? e.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'None'} editable={false} /></View>
              </Pressable>
            </View>
            <TextField label="Location" value={v} onChangeText={setVenue} maxLength={120} />
            <TextField label="Description" value={d} onChangeText={setDescription} multiline maxLength={1000} style={styles.description} />
          </View>
          {h.error ? <Text style={eventStyles.error}>{h.error}</Text> : null}
          <View style={authStyles.foot}>
            <Button label="Save changes" onPress={() => void save()} loading={h.busy} disabled={!changed} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <WhenSheet
        visible={!!when} initial={when ?? 'Date'} onClose={() => setWhen(null)} start={s} end={e}
        onChange={(ns, ne) => { setStart(ns); setEnd(ne ?? null); }}
      />

      <BottomSheet visible={confirmLeave} onClose={() => setConfirmLeave(false)}>
        <Text style={sheetText.title}>Discard your changes?</Text>
        <Text style={sheetText.body}>The event stays as it was.</Text>
        <Button label="Discard changes" variant="danger" onPress={() => { setConfirmLeave(false); setSaved(true); router.back(); }} />
        <Button label="Keep editing" variant="ghost" onPress={() => setConfirmLeave(false)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  coverWrap: { marginBottom: E.coverEdit.marginBottom },
  cover: { height: E.coverEdit.height },
  fields: { gap: board.inlineGap },
  pair: { flexDirection: 'row', gap: board.inlineGap },
  description: { minHeight: board.settings.bioMinHeight / 2, textAlignVertical: 'top' },
});
