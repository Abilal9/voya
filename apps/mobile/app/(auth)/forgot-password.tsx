import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { spacing } from '@/theme';

/** A04 Forgot password — the frozen design sends a LINK, not a code. */
export default function ForgotPassword() {
  const router = useRouter();
  const services = useServices();
  const [email, setEmail] = React.useState('ahmad@example.com');
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await services.auth.requestPasswordReset(email);
      router.push('/(auth)/reset-sent');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <Text variant="h1">Reset your password</Text>
        <Text variant="body" tone="secondary">
          Enter your email and we'll send you a reset link.
        </Text>
      </View>
      <View style={styles.form}>
        <TextField
          label="Email" value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address"
        />
        <Button label="Send reset link" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xxs, paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  form: { gap: spacing.md },
});
