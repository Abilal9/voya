import * as React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Button, Screen, Text, TopBar } from '@/components/ui';
import { StateHero, TextLink, authStyles } from '@/features/auth/AuthParts';

/**
 * A05 Reset link sent — board figure "A05". No email is sent in the mock;
 * "Preview reset link" opens what the link would open (A11), as on the board.
 */
export default function ResetSent() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Password reset" />
      <StateHero
        Icon={Check}
        title="Check your email"
        body={email ? <>We sent a password reset link to <Text>{email}</Text>.</> : 'We sent you a password reset link.'}
      />
      <View style={authStyles.foot}>
        <Button label="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} />
        <View style={{ alignSelf: 'center' }}>
          <TextLink label="Preview reset link" onPress={() => router.push('/(auth)/set-password')} />
        </View>
      </View>
    </Screen>
  );
}
