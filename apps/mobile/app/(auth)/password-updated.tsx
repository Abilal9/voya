import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Button, Screen, TopBar } from '@/components/ui';
import { StateHero, authStyles } from '@/features/auth/AuthParts';

/** A12 Password updated — board figure "A12". */
export default function PasswordUpdated() {
  const router = useRouter();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Password reset" onBack={() => router.replace('/(auth)/sign-in')} />
      <StateHero Icon={Check} title="Password updated" body="Your new password is ready to use." />
      <View style={authStyles.foot}>
        <Button label="Sign in" onPress={() => router.replace('/(auth)/sign-in')} />
      </View>
    </Screen>
  );
}
