import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, Text, TextField, TopBar } from '@/components/ui';
import { AuthIntro, ShowToggle, SocialSignIn, TextLink, authStyles } from '@/features/auth/AuthParts';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board, colors } from '@/theme';

/** A03 Sign in — board figure "A03". */
export default function SignIn() {
  const router = useRouter();
  const services = useServices();
  const setSession = useSession((s) => s.setSession);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [show, setShow] = React.useState(false);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not sign you in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Welcome back" />
      <AuthIntro title="Good to see you." body="Your next good plan is waiting." />
      <SocialSignIn />
      <View style={authStyles.fields}>
        <TextField
          label="Email" value={email} onChangeText={setEmail}
          autoCapitalize="none" autoComplete="email" keyboardType="email-address"
        />
        <TextField
          label="Password" value={password} onChangeText={setPassword}
          secureTextEntry={!show} autoComplete="password" error={error}
          right={<ShowToggle shown={show} onToggle={() => setShow((v) => !v)} />}
        />
        <TextLink label="Forgot password?" onPress={() => router.push('/(auth)/forgot-password')} />
      </View>
      <View style={authStyles.foot}>
        <Button label="Sign in" onPress={submit} loading={busy} />
        <Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/sign-up')}>
          <Text style={[authStyles.legal, { marginTop: board.listRow.paddingY }]}>
            New to Voya? <Text style={[authStyles.legal, { color: colors.brand.violet }]}>Create account</Text>
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
