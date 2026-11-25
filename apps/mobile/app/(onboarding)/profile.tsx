import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Screen, Text, TextField, TopBar } from '@/components/ui';
import { AuthIntro, TextLink, authStyles } from '@/features/auth/AuthParts';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board, colors } from '@/theme';

const P = board.photoEdit;

/**
 * A07 Basic profile — board figure "A07".
 * KNOWN GAP: "Change photo" needs an image picker (F4-03), so it is not shown yet.
 */
export default function OnboardingProfile() {
  const router = useRouter();
  const services = useServices();
  const account = useSession((s) => s.account);
  const signOut = useSession((s) => s.signOut);
  const [firstName, setFirstName] = React.useState(account?.firstName ?? '');
  const [lastName, setLastName] = React.useState(account?.lastName ?? '');
  const [city, setCity] = React.useState(account?.city ?? '');
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

  const advance = async (save: boolean) => {
    setError(undefined);
    if (save && !firstName.trim()) return setError('Enter your first name.');
    setBusy(true);
    try {
      if (save) {
        const first = firstName.trim();
        const last = lastName.trim();
        await services.profile.updateProfile({
          firstName: first, lastName: last, displayName: `${first} ${last}`.trim(), city: city.trim() || undefined,
        });
      }
      await services.profile.completeOnboardingStep('profile');
      router.push('/(onboarding)/interests');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      {/* Back from the first onboarding step signs out, so it never dead-ends. */}
      <TopBar title="A good place to start" onBack={() => void signOut()} />
      <AuthIntro tight title="A little about you" />
      <View style={styles.photoRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>
      <View style={authStyles.fields}>
        <TextField label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" error={error} />
        <TextField label="Last name" value={lastName} onChangeText={setLastName} autoComplete="family-name" />
        <TextField label="City" value={city} onChangeText={setCity} autoComplete="postal-address-locality" />
      </View>
      <View style={authStyles.foot}>
        <Button label="Continue" onPress={() => void advance(true)} loading={busy} />
        <View style={styles.center}>
          <TextLink label="Skip for now" onPress={() => void advance(false)} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: P.gap, marginTop: P.marginTop, marginBottom: P.marginBottom },
  avatar: {
    width: P.avatar, height: P.avatar, borderRadius: P.avatar / 2, backgroundColor: colors.brand.lavender,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: P.avatarFontSize, lineHeight: P.avatarFontSize * 1.25, fontWeight: '600', color: colors.brand.violet },
  center: { alignItems: 'center' },
});
