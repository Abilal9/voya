import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { BottomSheet, SettingsRow, sheetText } from '@/features/settings/SettingsParts';
import { useSession } from '@/stores/session';

/** V02 Settings with the V09 Log out confirmation sheet. */
export default function Settings() {
  const router = useRouter();
  const signOut = useSession((s) => s.signOut);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const logOut = async () => {
    setBusy(true);
    try {
      await signOut(); // the session guard replaces the stack with Welcome
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Profile" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Settings" />
        <SettingsRow title="Account" subtitle="Email, password and security" onPress={() => router.push('/settings/account')} />
        <SettingsRow title="Notifications" onPress={() => router.push('/settings/notifications')} />
        <SettingsRow title="Privacy & Safety" onPress={() => router.push('/settings/privacy')} />
        <SettingsRow title="Location & Discovery" onPress={() => router.push('/settings/discovery')} />
        <SettingsRow title="Help & Support" onPress={() => router.push('/settings/help')} />
        <SettingsRow title="About Voya" onPress={() => router.push('/settings/about')} />
        <View style={styles.spacer} />
        <SettingsRow title="Log out" onPress={() => setConfirming(true)} />
      </ScrollView>

      <BottomSheet visible={confirming} onClose={() => setConfirming(false)}>
        <Text style={sheetText.title}>Log out?</Text>
        <Text style={sheetText.body}>You can sign back in whenever you’re ready.</Text>
        <Button label="Log out" onPress={() => void logOut()} loading={busy} />
        <Button label="Cancel" variant="ghost" onPress={() => setConfirming(false)} disabled={busy} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  spacer: { flex: 1 },
});
