import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { Button, Screen, Text, TopBar } from '@/components/ui';
import { StateHero, authStyles } from '@/features/auth/AuthParts';
import { useServices } from '@/services/ServicesProvider';
import { board, colors } from '@/theme';

/**
 * A09 Location permission — board figure "A09". Mocked: no OS prompt is shown
 * and no location is read. Declining is not an error; onboarding continues.
 */
export default function OnboardingLocation() {
  const router = useRouter();
  const services = useServices();

  const next = async () => {
    await services.profile.completeOnboardingStep('location');
    router.push('/(onboarding)/notifications');
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Nearby discoveries" />
      <StateHero
        Icon={MapPin}
        title={'Find good things\nnearby'}
        body="Voya can use your location to recommend places and experiences around you."
      />
      <Text style={styles.note}>You can also choose a city yourself.</Text>
      <View style={authStyles.foot}>
        <Button label="Allow location" onPress={() => void next()} />
        <Button label="Not now" variant="ghost" onPress={() => void next()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { ...board.small, color: colors.text.secondary, marginTop: board.stateHero.paddingTop * 2 },
});
