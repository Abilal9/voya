import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { spacing } from '@/theme';

/** A07 Basic profile. */
export default function OnboardingProfile() {
  const router = useRouter();
  const services = useServices();
  const [firstName, setFirstName] = React.useState('');
  const [city, setCity] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const next = async () => {
    setBusy(true);
    try {
      await services.profile.updateProfile({ firstName: firstName || 'Ahmad', city: city || 'Riyadh' });
      await services.profile.completeOnboardingStep('profile');
      router.push('/(onboarding)/interests');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <Text variant="overline" tone="tertiary">STEP 1 OF 4</Text>
        <Text variant="h1">Tell us about you</Text>
      </View>
      <View style={styles.form}>
        <TextField label="First name" value={firstName} onChangeText={setFirstName} placeholder="Ahmad" />
        <TextField label="City" value={city} onChangeText={setCity} placeholder="Riyadh" />
        <Button label="Continue" onPress={next} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xxs, paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  form: { gap: spacing.md },
});
