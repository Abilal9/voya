import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { SettingsRow } from '@/features/settings/SettingsParts';
import { useSession } from '@/stores/session';

/**
 * V03 Account. Password opens the shared Set new password form (A11/A12).
 * Email and Account security have no designed destination, so they show
 * their value without a chevron. Changing email arrives with real accounts.
 */
export default function Account() {
  const router = useRouter();
  const account = useSession((s) => s.account);
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Settings" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Account" />
        <SettingsRow title="Email" subtitle={account?.email ?? ''} />
        <SettingsRow title="Password" subtitle="Change your password" onPress={() => router.push('/settings/password')} />
        <SettingsRow title="Account security" subtitle="Password sign-in" />
        <View style={styles.spacer} />
        <SettingsRow
          danger
          title="Delete account"
          subtitle="Permanently close your account"
          onPress={() => router.push('/settings/delete-account')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  spacer: { flex: 1 },
});
