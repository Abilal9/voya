import * as React from 'react';
import { View } from 'react-native';
import { Button, Screen, Text, TextField, TopBar } from '@/components/ui';
import { AuthIntro, ShowToggle, SocialSignIn, authStyles } from '@/features/auth/AuthParts';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board, colors } from '@/theme';

type Errors = Partial<Record<'first' | 'last' | 'email' | 'password' | 'confirm', string>>;

/**
 * A02 Create account — board figure "A02". Creates a separate local mock
 * account (no password is stored), then Verify (A06) follows.
 */
export default function SignUp() {
  const services = useServices();
  const refresh = useSession((s) => s.refresh);
  const [first, setFirst] = React.useState('');
  const [last, setLast] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [errors, setErrors] = React.useState<Errors>({});
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    const next: Errors = {};
    if (!first.trim()) next.first = 'Enter your first name.';
    if (!last.trim()) next.last = 'Enter your last name.';
    if (!email.includes('@')) next.email = 'Enter a valid email address.';
    if (password.length < 6) next.password = 'Password must be at least 6 characters.';
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      await services.auth.signUp(email, password, { firstName: first, lastName: last });
      // The session guard sees an unverified account and routes to Verify.
      await refresh();
    } catch (e) {
      setErrors({ email: e instanceof Error ? e.message : 'We could not create your account.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Welcome to Voya" />
      <AuthIntro tight title={'Make room for\ngood plans.'} body="Create your account to get started." />
      <SocialSignIn />
      <View style={[authStyles.fields, { gap: board.form.fieldsGapTight }]}>
        <TextField label="First name" value={first} onChangeText={setFirst} autoComplete="given-name" error={errors.first} />
        <TextField label="Last name" value={last} onChangeText={setLast} autoComplete="family-name" error={errors.last} />
        <TextField
          label="Email" value={email} onChangeText={setEmail} error={errors.email}
          autoCapitalize="none" autoComplete="email" keyboardType="email-address"
        />
        <TextField
          label="Password" value={password} onChangeText={setPassword} error={errors.password}
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
        <Text style={authStyles.legal}>
          By continuing, you agree to our{' '}
          <Text style={[authStyles.legal, { color: colors.brand.violet }]}>Terms of Service</Text> and{' '}
          <Text style={[authStyles.legal, { color: colors.brand.violet }]}>Privacy Policy</Text>.
        </Text>
        <Button label="Create account" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}
