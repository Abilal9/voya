import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { Button, Screen, Text } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { colors, spacing } from '@/theme';

/** A09 Location permission. Declining is NOT an error — onboarding continues. */
export default function OnboardingLocation() {
  const router = useRouter();
  const services = useServices();

  const next = async () => {
    await services.profile.completeOnboardingStep('location');
    router.push('/(onboarding)/notifications');
  };

  return (
    <Screen>
      <View style={styles.body}>
        <MapPin size={40} color={colors.brand.violet} strokeWidth={1.7} />
        <Text variant="h1" center>Discover what&apos;s near you</Text>
        <Text variant="body" tone="secondary" center>
          Voya uses your location to show nearby places. You can always pick a city manually instead.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Allow location" onPress={next} />
        <Button label="Not now" variant="ghost" onPress={next} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  actions: { gap: spacing.xs, paddingBottom: spacing.xl },
});
