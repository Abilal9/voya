import * as React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board, colors } from '@/theme';

const F = board.form;

/** Board `.xp-intro`: h1 then a 13px muted line. */
export function AuthIntro({ title, body, tight }: { title: string; body: string; tight?: boolean }) {
  return (
    <View style={{ marginBottom: tight ? F.fieldsMarginTop : F.introMarginBottom }}>
      <Text style={styles.h1}>{title}</Text>
      <Text style={styles.introBody}>{body}</Text>
    </View>
  );
}

/** Board `.flow-social` (mock Apple / Google) followed by the "or" divider. */
export function SocialSignIn() {
  const services = useServices();
  const setSession = useSession((s) => s.setSession);
  const [busy, setBusy] = React.useState<'apple' | 'google' | null>(null);

  const go = async (provider: 'apple' | 'google') => {
    setBusy(provider);
    try {
      const session =
        provider === 'apple' ? await services.auth.signInWithApple() : await services.auth.signInWithGoogle();
      await setSession(session);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <View style={styles.social}>
        <Button
          variant="secondary"
          label="Continue with Apple"
          loading={busy === 'apple'}
          onPress={() => void go('apple')}
          style={styles.socialButton}
          labelStyle={styles.socialLabel}
          icon={<Ionicons name="logo-apple" size={F.social.icon} color={colors.brand.plum} />}
        />
        <Button
          variant="secondary"
          label="Continue with Google"
          loading={busy === 'google'}
          onPress={() => void go('google')}
          style={styles.socialButton}
          labelStyle={styles.socialLabel}
          icon={<Ionicons name="logo-google" size={F.social.icon} color={colors.brand.violet} />}
        />
      </View>
      <Text style={styles.or}>or</Text>
    </>
  );
}

/** Board `.xp-text`: small violet text button. */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

/** Board "Show" toggle inside a password field. */
export function ShowToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={shown ? 'Hide password' : 'Show password'} onPress={onToggle} hitSlop={8}>
      <Text style={styles.toggle}>{shown ? 'Hide' : 'Show'}</Text>
    </Pressable>
  );
}

export const authStyles = StyleSheet.create({
  screen: { paddingHorizontal: board.screenPaddingX },
  fields: { gap: F.fieldsGap, marginTop: F.fieldsMarginTop, marginBottom: F.fieldsMarginBottom },
  foot: { marginTop: 'auto', paddingTop: board.listRow.paddingY + 2 },
  legal: { fontSize: F.legalSize, lineHeight: F.legalSize * 1.7, textAlign: 'center', color: colors.text.secondary, marginBottom: board.listRow.paddingY },
  center: { textAlign: 'center' },
});

const styles = StyleSheet.create({
  h1: { ...board.h1, color: colors.brand.plum },
  introBody: { fontSize: F.introBodySize, lineHeight: F.introBodySize * 1.6, color: colors.text.secondary },
  social: { gap: F.social.gap, marginTop: F.social.marginTop, marginBottom: F.social.marginBottom },
  socialButton: { minHeight: F.social.minHeight, paddingVertical: 0 },
  socialLabel: { fontSize: F.social.fontSize },
  or: { textAlign: 'center', fontSize: F.orSize, color: F.orColor, marginVertical: 2 },
  link: { paddingVertical: F.linkPaddingY, alignSelf: 'flex-start' },
  linkText: { fontSize: F.linkSize, color: colors.brand.violet },
  toggle: { fontSize: board.field.toggleSize, color: colors.brand.violet, paddingVertical: board.inlineGap },
});
