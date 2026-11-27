import * as React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, TextLink, authStyles } from '@/features/auth/AuthParts';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board, colors } from '@/theme';

const LENGTH = 6;
const C = board.code;

/**
 * A06 Verify email — board figure "A06". Six one-digit boxes backed by one
 * input, so paste and one-time-code autofill work. Mock provider: the code is
 * always 424242. Real provider: Supabase emails a 6-digit code.
 */
export default function Verify() {
  const router = useRouter();
  const services = useServices();
  const refresh = useSession((s) => s.refresh);
  const signOut = useSession((s) => s.signOut);
  const email = useSession((s) => s.account?.email);
  const input = React.useRef<TextInput>(null);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const [note, setNote] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setError(undefined);
    if (code.length < LENGTH) return setError('Enter all 6 digits.');
    setBusy(true);
    try {
      await services.auth.verifyEmailCode(code);
      await refresh(); // routes on to onboarding
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code is not correct.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setNote(undefined);
    try {
      await services.auth.resendVerificationCode();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not send a new code.');
      return;
    }
    setCode('');
    setError(undefined);
    const hint = services.auth.verificationCodeHint;
    setNote(hint ? `New code sent. In development it is always ${hint}.` : 'New code sent.');
  };

  const changeEmail = async () => {
    await services.auth.abandonSignUp();
    await signOut();
    router.replace('/(auth)/sign-up');
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Create account" onBack={() => void changeEmail()} />
      <AuthIntro tight title="Verify your email" body="Enter the code we sent to your email." />
      {email ? <Text style={styles.email}>{email}</Text> : null}

      <Pressable accessibilityLabel="Verification code" onPress={() => input.current?.focus()} style={styles.boxes}>
        {Array.from({ length: LENGTH }, (_, i) => (
          <View key={i} style={[styles.box, i === code.length && styles.boxActive]}>
            <Text style={styles.digit}>{code[i] ?? ''}</Text>
          </View>
        ))}
        <TextInput
          ref={input}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, LENGTH))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          autoFocus
          style={styles.hiddenInput}
        />
      </Pressable>

      <View style={styles.links}>
        <TextLink label="Resend code" onPress={() => void resend()} />
        <TextLink label="Change email" onPress={() => void changeEmail()} />
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {note && !error ? <Text style={styles.note}>{note}</Text> : null}

      <View style={authStyles.foot}>
        <Button label="Continue" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: { ...board.small, color: colors.text.secondary },
  boxes: { flexDirection: 'row', gap: C.gap, marginTop: C.marginTop, marginBottom: C.marginBottom },
  box: {
    flex: 1, height: C.height, borderRadius: C.radius, borderWidth: 1, borderColor: C.border,
    backgroundColor: board.field.background, alignItems: 'center', justifyContent: 'center',
  },
  boxActive: { borderColor: colors.brand.lavender },
  digit: { fontSize: C.fontSize, color: colors.brand.plum },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
  note: { ...board.small, color: colors.text.secondary, marginTop: board.inlineGap },
});
