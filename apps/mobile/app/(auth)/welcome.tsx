import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Apple, Mail } from 'lucide-react-native';
import { VoyaLogo } from '@/components/brand';
import { Button, Screen, Text } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { colors, icon, spacing } from '@/theme';

/** A01 Welcome. */
export default function Welcome() {
  const router = useRouter();
  const services = useServices();
  const setSession = useSession((s) => s.setSession);
  const [busy, setBusy] = React.useState<string | null>(null);

  const social = async (provider: 'apple' | 'google') => {
    setBusy(provider);
    try {
      const session =
        provider === 'apple'
          ? await services.auth.signInWithApple()
          : await services.auth.signInWithGoogle();
      await setSession(session);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <VoyaLogo width={200} />
        <Text variant="h2" center tone="secondary" style={styles.tagline}>
          Plan less. Live more.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Create account" onPress={() => router.push('/(auth)/sign-up')} />
        <Button
          label="Continue with Apple"
          variant="secondary"
          loading={busy === 'apple'}
          onPress={() => social('apple')}
          icon={<Apple size={icon.md} color={colors.text.primary} strokeWidth={icon.strokeWidth} />}
        />
        <Button
          label="Continue with Google"
          variant="secondary"
          loading={busy === 'google'}
          onPress={() => social('google')}
          icon={<Mail size={icon.md} color={colors.text.primary} strokeWidth={icon.strokeWidth} />}
        />
        <Button label="Sign in" variant="ghost" onPress={() => router.push('/(auth)/sign-in')} />
        <Text variant="caption" tone="tertiary" center>
          Simulated sign-in. No real account is created.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  tagline: { marginTop: spacing.xs },
  actions: { gap: spacing.sm, paddingBottom: spacing.xl },
});
