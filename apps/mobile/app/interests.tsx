import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, ToggleChip, authStyles } from '@/features/auth/AuthParts';
import { useInterests } from '@/features/catalog';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board, colors } from '@/theme';

/**
 * V13 Manage interests — the same long-lived account interests as onboarding
 * (A08), not Explore's filters. At least one must stay selected, as in A08.
 */
export default function ManageInterests() {
  const router = useRouter();
  const services = useServices();
  const options = useInterests();
  const account = useSession((s) => s.account);
  const refresh = useSession((s) => s.refresh);
  const [picked, setPicked] = React.useState<string[]>(account?.interests ?? []);
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const toggle = (i: string) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const save = async () => {
    if (picked.length === 0) return setError('Pick at least one.');
    setError(undefined);
    setBusy(true);
    try {
      await services.profile.setInterests(picked);
      await refresh();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your interests could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Your preferences" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Your interests" body="Make your suggestions feel more like you." />
        <View style={styles.chips}>
          {(options.data ?? []).map((i) => (
            <ToggleChip key={i} label={i} selected={picked.includes(i)} onPress={() => toggle(i)} />
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={authStyles.foot}>
          <Button label="Save interests" onPress={() => void save()} loading={busy} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: board.chips.gap, marginTop: board.chips.marginTop, marginBottom: board.chips.marginBottom },
  error: { ...board.small, color: colors.status.danger },
});
