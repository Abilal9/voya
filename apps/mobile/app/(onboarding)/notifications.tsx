import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { Button, Screen, Text, TopBar } from '@/components/ui';
import { StateHero, authStyles } from '@/features/auth/AuthParts';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board, colors } from '@/theme';

/**
 * A10 Notification permission — board figure "A10", the last onboarding step.
 * Mocked: no OS prompt is shown and nothing is registered for push.
 */
export default function OnboardingNotifications() {
  const services = useServices();
  const refresh = useSession((s) => s.refresh);
  const [busy, setBusy] = React.useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      await services.profile.completeOnboardingStep('notifications');
      await refresh(); // the session guard takes the user Home
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="One last thing" />
      <StateHero
        Icon={CalendarDays}
        title="Stay in the loop"
        body="Know when friends join, someone suggests a place, or an itinerary is ready. We’ll also keep you up to date when plans or event details change."
      />
      <Text style={styles.note}>Choose what you hear about in Settings.</Text>
      <View style={authStyles.foot}>
        <Button label="Turn on notifications" onPress={() => void finish()} loading={busy} />
        <Button label="Not now" variant="ghost" onPress={() => void finish()} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { ...board.small, color: colors.text.secondary, marginTop: board.stateHero.paddingTop * 2 },
});
