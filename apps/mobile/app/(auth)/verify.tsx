import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { spacing } from '@/theme';

/** A06 Verify email — the frozen design verifies with a CODE here. */
export default function Verify() {
  const services = useServices();
  const refresh = useSession((s) => s.refresh);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setError(undefined);
    setBusy(true);
    try {
      await services.auth.verifyEmailCode(code);
      await refresh();
    } catch {
      setError('That code is not correct.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <Text variant="h1">Verify your email</Text>
        <Text variant="body" tone="secondary">
          We sent you a 6-digit code. In development the code is 424242.
        </Text>
      </View>
      <View style={styles.form}>
        <TextField
          label="Verification code" value={code} onChangeText={setCode}
          keyboardType="number-pad" maxLength={6} placeholder="424242" error={error}
        />
        <Button label="Verify" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xxs, paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  form: { gap: spacing.md },
});
