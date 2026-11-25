import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, ToggleChip, authStyles } from '@/features/auth/AuthParts';
import { useInterests } from '@/features/catalog';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board, colors } from '@/theme';

/** A08 Interests — board figure "A08". */
export default function OnboardingInterests() {
  const router = useRouter();
  const services = useServices();
  const interests = useInterests();
  const existing = useSession((s) => s.account?.interests);
  const [picked, setPicked] = React.useState<string[]>(existing ?? []);
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const toggle = (i: string) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const next = async () => {
    setError(undefined);
    if (picked.length === 0) return setError('Pick at least one.');
    setBusy(true);
    try {
      await services.profile.setInterests(picked);
      await services.profile.completeOnboardingStep('interests');
      router.push('/(onboarding)/location');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Your taste" />
      <AuthIntro tight title="What are you into?" body="This helps Voya find places that feel more like you." />
      <View style={styles.chips}>
        {(interests.data ?? []).map((i) => (
          <ToggleChip key={i} label={i} selected={picked.includes(i)} onPress={() => toggle(i)} />
        ))}
      </View>
      <Text style={error ? styles.error : styles.hint}>{error ?? 'Pick a few. You can change these anytime.'}</Text>
      <View style={authStyles.foot}>
        <Button label="Continue" onPress={next} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: board.chips.gap,
    marginTop: board.chips.marginTop, marginBottom: board.chips.marginBottom,
  },
  hint: { ...board.small, color: colors.text.secondary },
  error: { ...board.small, color: colors.status.danger },
});
