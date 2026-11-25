import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { spacing } from '@/theme';

/** A02 Create account. Verification (A06) follows. */
export default function SignUp() {
  const router = useRouter();
  const services = useServices();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setError(undefined);
    if (!email.includes('@')) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setBusy(true);
    try {
      await services.auth.signUp(email, password);
      router.push('/(auth)/verify');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <Text variant="h1">Create your account</Text>
        <Text variant="body" tone="secondary">A few details and you&apos;re in.</Text>
      </View>
      <View style={styles.form}>
        <TextField
          label="Email" value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com"
        />
        <TextField
          label="Password" value={password} onChangeText={setPassword}
          secureTextEntry placeholder="At least 6 characters" error={error}
        />
        <Button label="Continue" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xxs, paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  form: { gap: spacing.md },
});
