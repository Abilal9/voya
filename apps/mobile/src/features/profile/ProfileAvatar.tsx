import { usePhotoAccessSheet } from '@/features/permissions/PhotoAccess';
import * as React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@/components/ui';
import { board, colors } from '@/theme';
import { avatarUri, initialsOf } from './avatar';

/**
 * A profile photo or, when there is none (or its file is gone), initials on
 * lavender — the board's `.profile-avatar`.
 */
export function ProfileAvatar({ uri, firstName, lastName, size, fontSize }: {
  uri?: string; firstName?: string; lastName?: string; size: number; fontSize: number;
}) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [uri]);
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.circle, shape]} accessibilityRole="image" accessibilityLabel="Profile photo">
      {uri && !broken ? (
        <Image source={{ uri }} style={shape} onError={() => setBroken(true)} />
      ) : (
        <Text style={[styles.initials, { fontSize, lineHeight: fontSize * 1.25 }]}>{initialsOf(firstName, lastName)}</Text>
      )}
    </View>
  );
}

export type PickResult = { uri: string } | { error: 'denied' | 'failed' } | null;

/** Opens the photo library. null = cancelled. Nothing leaves the device. */
export async function pickPhoto(): Promise<PickResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { error: 'denied' };
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return null;
    return { uri: result.assets[0].uri };
  } catch {
    return { error: 'failed' };
  }
}

/** Board `.xp-photo-edit`: avatar with a "Change photo" link. */
export function AvatarPicker({ storedRef, pending, onPicked, firstName, lastName }: {
  storedRef?: string; pending?: string; onPicked: (uri: string) => void; firstName?: string; lastName?: string;
}) {
  const P = board.photoEdit;
  const [message, setMessage] = React.useState<string | undefined>();
  const { showPhotoAccess, photoAccessSheet } = usePhotoAccessSheet();
  const change = async () => {
    setMessage(undefined);
    const picked = await pickPhoto();
    if (!picked) return;
    if ('error' in picked) {
      if (picked.error === 'denied') showPhotoAccess();
      else setMessage('That photo could not be opened. Try another.');
      return;
    }
    onPicked(picked.uri);
  };
  return (
    <View style={styles.pickerWrap}>
      <View style={styles.pickerRow}>
        <ProfileAvatar
          uri={pending ?? avatarUri(storedRef)} firstName={firstName} lastName={lastName}
          size={P.avatar} fontSize={P.avatarFontSize}
        />
        <Pressable accessibilityRole="button" onPress={() => void change()} hitSlop={board.inlineGap}>
          <Text style={styles.link}>Change photo</Text>
        </Pressable>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {photoAccessSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.brand.lavender, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontWeight: '600', color: colors.brand.violet },
  pickerWrap: { marginTop: board.photoEdit.marginTop, marginBottom: board.photoEdit.marginBottom },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: board.photoEdit.gap },
  link: { fontSize: board.form.linkSize, color: colors.brand.violet },
  message: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
