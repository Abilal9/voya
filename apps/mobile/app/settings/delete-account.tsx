import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Button, Screen, Text, TextField, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board, colors, icon } from '@/theme';

const S = board.settings;

/**
 * V10 Delete account. Mock deletion: removes this account's local data and
 * signs out; shared plans stay consistent for their other members. Nothing
 * is deleted on any server — there is none yet.
 */
export default function DeleteAccount() {
  const router = useRouter();
  const services = useServices();
  const signOut = useSession((s) => s.signOut);
  const [word, setWord] = React.useState('');
  const [understood, setUnderstood] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const ready = word.trim() === 'DELETE' && understood;

  const remove = async () => {
    if (!ready) return;
    setError(undefined);
    setBusy(true);
    try {
      await services.auth.deleteAccount();
      await signOut(); // clears the session store; the guard shows Welcome
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not delete your account.');
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Account" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title={'Delete your\naccount?'} body="Take a moment before you go." />
        <View style={styles.note}>
          <Text style={styles.noteText}>
            Deleting your account removes your access to Voya and deletes or anonymizes relevant personal account data under
            Voya’s account policy. Required records may be retained as described in that policy.
          </Text>
        </View>
        <Text style={styles.muted}>This action is permanent. You won’t be able to restore your account.</Text>
        <View style={authStyles.fields}>
          <TextField
            label="Type DELETE to confirm" value={word} onChangeText={setWord}
            autoCapitalize="characters" autoCorrect={false}
          />
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: understood }}
          onPress={() => setUnderstood((v) => !v)}
          style={styles.check}
        >
          <View style={[styles.box, understood && styles.boxOn]}>
            {understood ? <Check size={S.check.icon} color={colors.text.inverse} strokeWidth={icon.strokeWidth} /> : null}
          </View>
          <Text style={styles.checkText}>I understand that my account cannot be restored.</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={authStyles.foot}>
          <Button label="Delete account" variant="danger" onPress={() => void remove()} disabled={!ready} loading={busy} />
          <Button label="Keep my account" variant="ghost" onPress={() => router.back()} disabled={busy} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  note: { padding: S.note.padding, backgroundColor: S.note.background, borderRadius: S.note.radius, marginVertical: S.note.marginY },
  noteText: { fontSize: S.note.fontSize, lineHeight: S.note.lineHeight, color: colors.brand.plum },
  muted: { ...board.small, color: colors.text.secondary },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: S.check.gap, marginVertical: S.check.marginY },
  box: {
    width: S.check.box, height: S.check.box, borderRadius: S.check.boxRadius, borderWidth: 1,
    borderColor: board.field.placeholder, alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.brand.violet, borderColor: colors.brand.violet },
  checkText: { flex: 1, fontSize: S.check.fontSize, lineHeight: S.check.lineHeight, color: colors.brand.plum },
  error: { ...board.small, color: colors.status.danger },
});
