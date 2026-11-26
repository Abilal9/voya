import * as React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Check, ChevronRight } from 'lucide-react-native';
import { AvatarStack, Button, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { usePeople } from '@/features/catalog';
import { useExploreCity } from '@/features/explore/useExploreCity';
import { Pill, defaultTitle, whenLabel } from '@/features/hangout/HangoutParts';
import { BottomSheet, Switch, sheetText } from '@/features/settings/SettingsParts';
import { CREATE_TEMPLATES, FULL_HANGOUT } from '@/services/hangoutRules';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board, colors, icon } from '@/theme';

const H = board.hangout;

/** Next Friday at 7:30 PM, the board's example, as the starting suggestion. */
function nextFridayEvening() {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  d.setHours(19, 30, 0, 0);
  return d;
}

function Row({ label, value, onPress, right }: { label: string; value: string; onPress: () => void; right?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${value}`} onPress={onPress} style={styles.formRow}>
      <View style={styles.flex}>
        <Text style={styles.formLabel}>{label}</Text>
        <Text style={styles.formValue}>{value}</Text>
      </View>
      {right ?? <ChevronRight size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />}
    </Pressable>
  );
}

/** 13 Create Hangout — board figure "13". */
export default function NewHangout() {
  const router = useRouter();
  const services = useServices();
  const qc = useQueryClient();
  const account = useSession((s) => s.account);
  const me = account?.personId ?? account?.id;
  const people = usePeople();
  const { city: exploreCity } = useExploreCity();
  const destinations = useQuery({ queryKey: ['catalog', 'destinations'], queryFn: () => services.catalog.destinations() });

  const [template, setTemplate] = React.useState(FULL_HANGOUT);
  const [when, setWhen] = React.useState(nextFridayEvening);
  const [city, setCity] = React.useState<string | undefined>();
  const [invitees, setInvitees] = React.useState<string[]>([]);
  const [sheet, setSheet] = React.useState<'when' | 'where' | 'who' | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  const where = city ?? exploreCity ?? '';
  const friends = (people.data ?? []).filter((p) => p.id !== me);
  const inviteeNames = invitees.map((id) => people.byId.get(id)?.displayName).filter((n): n is string => !!n);

  const start = async () => {
    if (busy) return; // no duplicate hangouts from repeated taps
    setError(undefined);
    if (when.getTime() < Date.now()) return setError('Choose a time in the future.');
    if (!where) return setError('Choose where.');
    setBusy(true);
    try {
      const h = await services.plans.createHangout({
        title: defaultTitle(when.toISOString()), city: where, template, startsAt: when.toISOString(), invitees,
      });
      await qc.invalidateQueries({ queryKey: ['plans'] });
      router.replace(`/hangout/${h.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The hangout could not be created.');
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="New hangout" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="What's the plan?" body="A great night, without the group-chat chaos." />
        <View style={styles.templates}>
          {CREATE_TEMPLATES.map((t) => {
            const on = t === template;
            const label = t === FULL_HANGOUT ? 'Full Hangout' : t;
            return (
              <Pressable
                key={t} accessibilityRole="button" accessibilityState={{ selected: on }}
                onPress={() => setTemplate(t)} style={[styles.template, on && styles.templateOn]}
              >
                <Text style={[styles.templateText, on && styles.templateTextOn]}>{on && t === FULL_HANGOUT ? `${label} ✓` : label}</Text>
              </Pressable>
            );
          })}
        </View>
        {template === FULL_HANGOUT ? <Pill label={FULL_HANGOUT} /> : null}

        <Row label="When?" value={whenLabel(when.toISOString())} onPress={() => setSheet('when')} />
        <Row label="Where?" value={where || 'Choose a city'} onPress={() => setSheet('where')} />
        <Row
          label="Who's coming?"
          value={invitees.length ? `${invitees.length} ${invitees.length === 1 ? 'friend' : 'friends'}` : 'Invite friends'}
          onPress={() => setSheet('who')}
          right={inviteeNames.length ? <AvatarStack names={[account?.displayName ?? '', ...inviteeNames]} /> : undefined}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={authStyles.foot}>
          <Button label="Start planning" onPress={() => void start()} loading={busy} />
        </View>
      </ScrollView>

      <BottomSheet visible={sheet === 'when'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>When?</Text>
        <DateTimePicker
          value={when}
          mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          minuteInterval={15}
          onChange={(_, d) => d && setWhen(d)}
          textColor={colors.brand.plum}
        />
        <Button label="Done" onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'where'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Where?</Text>
        {(destinations.data ?? []).map((d) => (
          <Pressable key={d.city} accessibilityRole="button" onPress={() => { setCity(d.city); setSheet(null); }} style={styles.pickRow}>
            <View style={styles.flex}>
              <Text style={styles.formValue}>{d.city}</Text>
              <Text style={styles.formLabelMuted}>{d.country}</Text>
            </View>
            {d.city === where ? <Check size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} /> : null}
          </Pressable>
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'who'} onClose={() => setSheet(null)}>
        <Text style={sheetText.title}>Who&apos;s coming?</Text>
        {friends.map((p) => {
          const on = invitees.includes(p.id);
          return (
            <View key={p.id} style={styles.pickRow}>
              <Text style={[styles.formValue, styles.flex]}>{p.displayName}</Text>
              <Switch
                label={`Invite ${p.displayName}`} value={on}
                onChange={(v) => setInvitees((list) => (v ? [...list, p.id] : list.filter((x) => x !== p.id)))}
              />
            </View>
          );
        })}
        <Button label="Done" onPress={() => setSheet(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  flex: { flex: 1 },
  templates: { flexDirection: 'row', flexWrap: 'wrap', gap: H.templateChip.gap, marginTop: H.templateChip.marginTop, marginBottom: board.listRow.paddingY },
  template: {
    width: '47.5%', minHeight: H.templateChip.minHeight, justifyContent: 'center', borderWidth: 1, borderColor: H.templateChip.border,
    borderRadius: H.templateChip.radius, paddingVertical: H.templateChip.paddingY, paddingHorizontal: H.templateChip.paddingX,
  },
  templateOn: { backgroundColor: H.templateChip.selectedBackground, borderColor: colors.brand.lavender },
  templateText: { fontSize: H.templateChip.fontSize, color: colors.brand.plum },
  templateTextOn: { color: colors.brand.violet, fontWeight: '600' },
  formRow: {
    flexDirection: 'row', alignItems: 'center', gap: board.inlineGap,
    paddingVertical: H.formRow.paddingY, borderBottomWidth: 1, borderBottomColor: H.formRow.border,
  },
  formLabel: { fontSize: H.formRow.labelSize, color: colors.brand.violet, marginBottom: H.formRow.labelMarginBottom },
  formLabelMuted: { ...board.small, color: colors.text.secondary },
  formValue: { fontSize: H.formRow.fontSize, color: colors.brand.plum },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: board.inlineGap, paddingVertical: board.listRow.paddingY,
    borderBottomWidth: 1, borderBottomColor: board.listRow.borderColor,
  },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
