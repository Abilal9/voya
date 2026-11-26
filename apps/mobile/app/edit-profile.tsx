import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Screen, Text, TextField, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { AvatarPicker } from '@/features/profile/ProfileAvatar';
import { BottomSheet, SettingsRow, sheetText } from '@/features/settings/SettingsParts';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { board } from '@/theme';

const MAX_NAME = 40;
const MAX_CITY = 60;
const MAX_BIO = 160;

/**
 * V01 Edit profile. Changes are kept in the form until "Save changes";
 * leaving with unsaved changes asks first. The photo is copied into app
 * storage on save (mock upload).
 */
export default function EditProfile() {
  const router = useRouter();
  const navigation = useNavigation();
  const services = useServices();
  const qc = useQueryClient();
  const account = useSession((s) => s.account);
  const refresh = useSession((s) => s.refresh);

  const initial = React.useMemo(() => ({
    first: account?.firstName ?? '', last: account?.lastName ?? '', city: account?.city ?? '', bio: account?.bio ?? '',
  }), [account]);
  const [form, setForm] = React.useState(initial);
  const [photo, setPhoto] = React.useState<string | undefined>();
  const [errors, setErrors] = React.useState<{ first?: string; save?: string }>({});
  const [busy, setBusy] = React.useState(false);
  const [leaving, setLeaving] = React.useState<null | (() => void)>(null);
  const saved = React.useRef(false);

  const dirty = !!photo || form.first !== initial.first || form.last !== initial.last
    || form.city !== initial.city || form.bio !== initial.bio;

  // Ask before discarding unsaved edits (back button, swipe back).
  React.useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (!dirty || saved.current) return;
    e.preventDefault();
    setLeaving(() => () => navigation.dispatch(e.data.action));
  }), [navigation, dirty]);

  const save = async () => {
    const first = form.first.trim();
    const last = form.last.trim();
    if (!first) return setErrors({ first: 'Enter your first name.' });
    setErrors({});
    setBusy(true);
    try {
      if (photo) await services.profile.setAvatar(photo);
      await services.profile.updateProfile({
        firstName: first, lastName: last || undefined, displayName: `${first} ${last}`.trim(),
        city: form.city.trim() || undefined, bio: form.bio.trim() || undefined,
      });
      await refresh();
      await qc.invalidateQueries({ queryKey: ['catalog', 'people'] });
      saved.current = true;
      router.back();
    } catch (e) {
      setErrors({ save: e instanceof Error ? e.message : 'Your changes could not be saved.' });
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
      <TopBar title="Profile" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Edit profile" />
        <AvatarPicker
          storedRef={account?.avatarRef} pending={photo} onPicked={setPhoto}
          firstName={form.first} lastName={form.last}
        />
        <View style={authStyles.fields}>
          <TextField label="First name" value={form.first} onChangeText={set('first')} maxLength={MAX_NAME} error={errors.first} autoComplete="given-name" />
          <TextField label="Last name" value={form.last} onChangeText={set('last')} maxLength={MAX_NAME} autoComplete="family-name" />
          <TextField label="City" value={form.city} onChangeText={set('city')} maxLength={MAX_CITY} />
          <TextField
            label="Bio · optional" value={form.bio} onChangeText={set('bio')} maxLength={MAX_BIO}
            placeholder="A little about you" multiline style={styles.bio}
            hint={form.bio.length > MAX_BIO - 20 ? `${MAX_BIO - form.bio.length} characters left` : undefined}
          />
        </View>
        <SettingsRow title="Manage preferences" subtitle="Food, places and things you enjoy" onPress={() => router.push('/interests')} />
        {errors.save ? <Text style={styles.error}>{errors.save}</Text> : null}
        <View style={authStyles.foot}>
          <Button label="Save changes" onPress={() => void save()} loading={busy} disabled={!dirty} />
        </View>
      </ScrollView>

      <BottomSheet visible={!!leaving} onClose={() => setLeaving(null)}>
        <Text style={sheetText.title}>Discard changes?</Text>
        <Text style={sheetText.body}>Your edits to your profile haven’t been saved.</Text>
        <Button label="Discard" variant="danger" onPress={() => { const go = leaving; setLeaving(null); saved.current = true; go?.(); }} />
        <Button label="Keep editing" variant="ghost" onPress={() => setLeaving(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  bio: { minHeight: board.settings.bioMinHeight, textAlignVertical: 'top' },
  error: { ...board.small, color: board.settings.danger, marginTop: board.inlineGap },
});
