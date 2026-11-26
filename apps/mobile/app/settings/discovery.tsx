import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Slider from '@react-native-community/slider';
import { Button, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { BottomSheet, GroupLabel, SettingsRow, ToggleRow, sheetText } from '@/features/settings/SettingsParts';
import { useSettings } from '@/features/settings/useSettings';
import { useExploreCity } from '@/features/explore/useExploreCity';
import { useServices } from '@/services/ServicesProvider';
import { board, colors } from '@/theme';

/**
 * V06 Location & Discovery. Default location opens the E02 picker. "Use
 * precise location" and the radius are saved per account; no device location
 * is read in the mock. Reset forgets likes and skips after a confirmation.
 */
export default function Discovery() {
  const router = useRouter();
  const services = useServices();
  const qc = useQueryClient();
  const settings = useSettings();
  const { city } = useExploreCity();
  const [radius, setRadius] = React.useState<number | null>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [resetDone, setResetDone] = React.useState(false);

  const reset = async () => {
    await services.profile.resetRecommendations();
    await qc.invalidateQueries({ queryKey: ['places'] });
    setConfirmReset(false);
    setResetDone(true);
  };

  const shown = radius ?? settings.data?.discoveryRadiusKm ?? 15;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Settings" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <AuthIntro tight title={'Location &\nDiscovery'} body="Make Explore feel closer to you." />
        {!settings.data ? (
          <LoadingState />
        ) : (
          <>
            <SettingsRow title="Default location" subtitle={city ?? ''} onPress={() => router.push('/location')} />
            <ToggleRow
              title="Use precise location"
              value={settings.data.preciseLocation}
              onChange={(v) => settings.update({ preciseLocation: v })}
            />
            <GroupLabel>Discovery radius</GroupLabel>
            <View style={styles.radiusRow}>
              <Text style={styles.radiusLabel}>Places within</Text>
              <Text style={styles.radiusValue}>{`${shown} km`}</Text>
            </View>
            <Slider
              accessibilityLabel="Discovery radius"
              minimumValue={1}
              maximumValue={50}
              step={1}
              value={settings.data.discoveryRadiusKm}
              onValueChange={setRadius}
              onSlidingComplete={(v) => {
                settings.update({ discoveryRadiusKm: v });
                setRadius(null);
              }}
              minimumTrackTintColor={colors.brand.violet}
              maximumTrackTintColor={board.settings.switch.off}
              thumbTintColor={colors.brand.violet}
              style={styles.slider}
            />
            <SettingsRow title="Manage interests" onPress={() => router.push('/interests')} />
            <SettingsRow
              title="Reset recommendation preferences"
              subtitle={resetDone ? 'Done — your likes and skips are cleared' : 'Start fresh with your discoveries'}
              onPress={() => setConfirmReset(true)}
            />
          </>
        )}
      </ScrollView>

      <BottomSheet visible={confirmReset} onClose={() => setConfirmReset(false)}>
        <Text style={sheetText.title}>Start fresh?</Text>
        <Text style={sheetText.body}>Places you liked or skipped will show up again in Explore. Saved places stay saved.</Text>
        <Button label="Reset" onPress={() => void reset()} />
        <Button label="Cancel" variant="ghost" onPress={() => setConfirmReset(false)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  radiusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: board.place.section.paddingY },
  radiusLabel: { fontSize: board.settings.row.titleSize, color: colors.brand.plum },
  radiusValue: { fontSize: board.settings.row.titleSize, fontWeight: '700', color: colors.brand.plum },
  slider: { marginVertical: board.settings.rangeMarginY },
});
