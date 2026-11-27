import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Button, Screen, TopBar } from '@/components/ui';
import { SetPasswordForm } from '@/features/auth/SetPasswordForm';
import { StateHero, authStyles } from '@/features/auth/AuthParts';

/**
 * Settings → Account → Password: the A11 form, then the A12 confirmation.
 * Mock: no password is stored or sent anywhere. Real: Supabase updates it.
 */
export default function ChangePassword() {
  const router = useRouter();
  const [done, setDone] = React.useState(false);
  if (!done) return <SetPasswordForm title="Account" onDone={() => setDone(true)} />;
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Account" />
      <StateHero Icon={Check} title="Password updated" body="Your new password is ready to use." />
      <View style={authStyles.foot}>
        <Button label="Done" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
