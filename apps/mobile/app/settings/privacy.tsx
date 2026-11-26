import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { SettingsRow } from '@/features/settings/SettingsParts';
import { board } from '@/theme';

/**
 * V05 Privacy & Safety. What each row says is what the app does today:
 * plans are only visible to the people on them, location is only the city
 * you choose (no device location is read), and nobody can be blocked yet.
 * Data & privacy and the Terms & Privacy Policy pages are not published yet,
 * so those rows say so instead of opening nothing.
 */
export default function Privacy() {
  const router = useRouter();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Settings" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Privacy & Safety" />
        <SettingsRow title="Profile visibility" subtitle="People you plan with" />
        <SettingsRow title="Location usage" subtitle="Used for nearby discoveries" onPress={() => router.push('/settings/discovery')} />
        <SettingsRow title="Blocked users" subtitle="No blocked users" />
        <SettingsRow title="Data & privacy" subtitle="Available when accounts go live" />
        <SettingsRow title="Terms & Privacy Policy" subtitle="Published before launch" />
        <View style={styles.spacer} />
        <Text style={styles.tiny}>Your preferences stay in your control.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  tiny: { ...board.tinyCenter, paddingVertical: board.listRow.paddingY },
});
