import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { spacing } from '@/theme';

/** A03 Sign in. */
export default function SignIn() {
  const router = useRouter();
  const services = useServices();
  const setSession = useSession((s) => s.setSession);
  const [email, setEmail] = React.useState('ahmad@example.com');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setError(undefined);
    if (!email.includes('@')) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setBusy(true);
    try {
      const session = await services.auth.signIn(email, password);
      await setSession(session);
    } catch {
      setError('We could not sign you in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <Text variant="h1">Welcome back</Text>
        <Text variant="body" tone="secondary">Sign in to pick up where you left off.</Text>
      </View>
      <View style={styles.form}>
        <TextField
          label="Email" value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com"
        />
        <TextField
          label="Password" value={password} onChangeText={setPassword}
          secureTextEntry placeholder="••••••••" error={error}
          hint="Any password of 6+ characters works in the mock."
        />
        <Button label="Sign in" onPress={submit} loading={busy} />
        <Button
          label="Forgot password?" variant="ghost"
          onPress={() => router.push('/(auth)/forgot-password')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xxs, paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  form: { gap: spacing.md },
});
