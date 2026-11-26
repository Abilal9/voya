import * as React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Check } from 'lucide-react-native';
import { Button, EmptyState, LoadingState, Screen, Text, TextField, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { useHangout } from '@/features/hangout/useHangout';
import { BottomSheet, sheetText } from '@/features/settings/SettingsParts';
import { EDIT_TEMPLATES } from '@/services/hangoutRules';
import { board, colors, icon } from '@/theme';

/**
 * H02 Edit hangout (organizer only). The template can only change while
 * planning; changing it keeps suggestions for the slots that remain.
 */
export default function EditHangout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useHangout(id);
  const hangout = h.hangout;
  const [title, setTitle] = React.useState<string>();
  const [when, setWhen] = React.useState<Date>();
  const [city, setCity] = React.useState<string>();
  const [template, setTemplate] = React.useState<string>();
  const [sheet, setSheet] = React.useState<'date' | 'time' | 'template' | null>(null);

  if (h.isPending) return <Screen><LoadingState /></Screen>;
  if (!hangout || !h.isOrganizer) return <Screen><TopBar /><EmptyState title="Only the organizer can edit this hangout" /></Screen>;

  const t = title ?? hangout.title;
  const w = when ?? new Date(hangout.startsAt!);
  const c = city ?? hangout.city;
  const tpl = template ?? hangout.template;
  const templates = [...new Set([hangout.template, ...EDIT_TEMPLATES])];

  const save = async () => {
    const ok = await h.run(() => h.services.hangouts.update(hangout.id, {
      title: t, city: c.trim(), startsAt: w.toISOString(), template: tpl,
    }));
    if (ok) router.back();
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Hangout settings" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Edit hangout" />
        <View style={authStyles.fields}>
          <TextField label="Name" value={t} onChangeText={setTitle} maxLength={40} />
          <View style={styles.pair}>
            <Pressable accessibilityRole="button" style={styles.flex} onPress={() => setSheet('date')}>
              <View pointerEvents="none"><TextField label="Date" value={w.toLocaleDateString()} editable={false} /></View>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.flex} onPress={() => setSheet('time')}>
              <View pointerEvents="none"><TextField label="Time" value={w.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} editable={false} /></View>
            </Pressable>
          </View>
          <TextField label="City / location" value={c} onChangeText={setCity} maxLength={60} />
          <Pressable accessibilityRole="button" disabled={hangout.finalized} onPress={() => setSheet('template')}>
            <View pointerEvents="none">
              <TextField label="Hangout template" value={tpl} editable={false} hint={hangout.finalized ? 'The plan is final, so its parts can’t change.' : undefined} />
            </View>
          </Pressable>
        </View>
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
        <View style={authStyles.foot}>
          <Button label="Save changes" onPress={() => void save()} loading={h.busy} />
        </View>
      </ScrollView>

      <BottomSheet visible={sheet === 'date' || sheet === 'time'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>{sheet === 'date' ? 'Date' : 'Time'}</Text>
        <DateTimePicker
          value={w} mode={sheet === 'time' ? 'time' : 'date'} display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minuteInterval={15} onChange={(_, d) => d && setWhen(d)} textColor={colors.brand.plum}
        />
        <Button label="Done" onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'template'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Hangout template</Text>
        {templates.map((x) => (
          <Pressable key={x} accessibilityRole="button" onPress={() => { setTemplate(x); setSheet(null); }} style={styles.row}>
            <Text style={[styles.rowText, styles.flex]}>{x}</Text>
            {x === tpl ? <Check size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} /> : null}
          </Pressable>
        ))}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  flex: { flex: 1 },
  pair: { flexDirection: 'row', gap: board.inlineGap },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: board.listRow.paddingY, borderBottomWidth: 1, borderBottomColor: board.listRow.borderColor },
  rowText: { fontSize: board.settings.row.titleSize, color: colors.brand.plum },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
