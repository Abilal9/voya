import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Chip, Screen, Text } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { INTERESTS } from '@/mocks/fixtures';
import { spacing } from '@/theme';

/** A08 Interests. */
export default function OnboardingInterests() {
  const router = useRouter();
  const services = useServices();
  const [picked, setPicked] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  const toggle = (i: string) =>
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const next = async () => {
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
    <Screen scroll>
      <View style={styles.head}>
        <Text variant="overline" tone="tertiary">STEP 2 OF 4</Text>
        <Text variant="h1">What do you enjoy?</Text>
        <Text variant="body" tone="secondary">We use this to suggest places you&apos;ll like.</Text>
      </View>
      <View style={styles.chips}>
        {INTERESTS.map((i) => (
          <Chip key={i} label={i} selected={picked.includes(i)} onPress={() => toggle(i)} />
        ))}
      </View>
      <Button label="Continue" onPress={next} loading={busy} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xxs, paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cta: { marginTop: spacing.xl },
});
