import * as React from 'react';
import { View } from 'react-native';
import { Button, Screen, TextField, TopBar } from '@/components/ui';
import { AuthIntro, ShowToggle, authStyles } from './AuthParts';
import { useServices } from '@/services/ServicesProvider';

/**
 * A11 Set new password — board figure "A11". Shared by the reset flow and
 * Settings → Account → Password. The mock stores no password.
 */
export function SetPasswordForm({ title, onDone }: { title: string; onDone: () => void }) {
  const services = useServices();
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [errors, setErrors] = React.useState<{ password?: string; confirm?: string }>({});
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (next.password || next.confirm) return;
    setBusy(true);
    try {
      await services.auth.setNewPassword(password);
      onDone();
    } catch (e) {
      setErrors({ password: e instanceof Error ? e.message : 'Could not update the password.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title={title} />
      <AuthIntro title="Set a new password" body="Use at least 8 characters." />
      <View style={authStyles.fields}>
        <TextField
          label="New password" value={password} onChangeText={setPassword} error={errors.password}
          secureTextEntry={!show} autoComplete="new-password"
          right={<ShowToggle shown={show} onToggle={() => setShow((v) => !v)} />}
        />
        <TextField
          label="Confirm password" value={confirm} onChangeText={setConfirm} error={errors.confirm}
          secureTextEntry={!showConfirm} autoComplete="new-password"
          right={<ShowToggle shown={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />}
        />
      </View>
      <View style={authStyles.foot}>
        <Button label="Update password" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}
