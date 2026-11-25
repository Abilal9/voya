import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { Button, Screen, Text } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { colors, spacing } from '@/theme';

/** A10 Notification permission — the last onboarding step. */
export default function OnboardingNotifications() {
  const services = useServices();
  const refresh = useSession((s) => s.refresh);

  const finish = async () => {
    await services.profile.completeOnboardingStep('notifications');
    await refresh();
  };

  return (
    <Screen>
      <View style={styles.body}>
        <Bell size={40} color={colors.brand.violet} strokeWidth={1.7} />
        <Text variant="h1" center>Stay in the loop</Text>
        <Text variant="body" tone="secondary" center>
          Get notified when friends vote, join or change a plan.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Turn on notifications" onPress={finish} />
        <Button label="Not now" variant="ghost" onPress={finish} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  actions: { gap: spacing.xs, paddingBottom: spacing.xl },
});
