import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, TextField, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { useServices } from '@/services/ServicesProvider';

/** A04 Forgot password — board figure "A04". The design sends a LINK, not a code. */
export default function ForgotPassword() {
  const router = useRouter();
  const services = useServices();
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setError(undefined);
    if (!email.includes('@')) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      await services.auth.requestPasswordReset(email);
      router.push({ pathname: '/(auth)/reset-sent', params: { email } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Sign in" />
      <AuthIntro title={'Reset your\npassword'} body="Enter your email and we’ll send you a reset link." />
      <TextField
        label="Email" value={email} onChangeText={setEmail} error={error}
        autoCapitalize="none" autoComplete="email" keyboardType="email-address"
      />
      <View style={authStyles.foot}>
        <Button label="Send reset link" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}
