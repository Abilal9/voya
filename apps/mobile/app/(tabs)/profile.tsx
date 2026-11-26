import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, FlaskConical, Heart, History, Settings2, SlidersHorizontal, type LucideIcon } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { ProfileAvatar } from '@/features/profile/ProfileAvatar';
import { avatarUri } from '@/features/profile/avatar';
import { useServices } from '@/services/ServicesProvider';
import type { PlanType } from '@/services';
import { useSession } from '@/stores/session';
import { board, colors, icon } from '@/theme';

const P = board.profile;

/**
 * 03 Profile — board figure "03". Settings (icon and row) opens V02, Edit
 * profile opens V01, Manage opens V13. Log out lives in Settings (V09).
 */
export default function Profile() {
  const router = useRouter();
  const services = useServices();
  const account = useSession((s) => s.account);

  const upcoming = useQuery({ queryKey: ['plans', 'upcoming'], queryFn: () => services.plans.listUpcoming() });
  const past = useQuery({ queryKey: ['plans', 'past'], queryFn: () => services.plans.listPast() });
  const all = [...(upcoming.data ?? []), ...(past.data ?? [])];
  const count = (t: PlanType) => all.filter((p) => p.type === t).length;

  const links: { Icon: LucideIcon; label: string; onPress: () => void; danger?: boolean }[] = [
    { Icon: Heart, label: 'Saved places', onPress: () => router.push('/saved') },
    { Icon: History, label: 'Past Plans', onPress: () => router.push('/past-plans') },
    { Icon: Settings2, label: 'Settings', onPress: () => router.push('/settings') },
    ...(__DEV__ ? [{ Icon: FlaskConical, label: 'Developer menu', onPress: () => router.push('/dev') }] : []),
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.h1}>Profile</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} hitSlop={board.inlineGap} style={styles.settingsButton}>
            <SlidersHorizontal size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
          </Pressable>
        </View>
        <View style={styles.avatar}>
          <ProfileAvatar
            uri={avatarUri(account?.avatarRef)} firstName={account?.firstName} lastName={account?.lastName}
            size={P.avatar.size} fontSize={P.avatar.fontSize}
          />
        </View>
        <Text style={styles.name} numberOfLines={2}>{account?.firstName ?? ''}</Text>
        {account?.city ? <Text style={styles.city}>{account.city}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => router.push('/edit-profile')} style={styles.editLink} hitSlop={board.inlineGap}>
          <Text style={styles.subtle}>Edit profile</Text>
        </Pressable>

        <View style={styles.stats}>
          {([['trip', 'Trips'], ['hangout', 'Hangouts'], ['event', 'Events']] as const).map(([t, label]) => (
            <View key={t} style={styles.stat}>
              <Text style={styles.statValue}>{count(t)}</Text>
              <Text style={styles.small}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.prefRow}>
          <Text style={[styles.h3, styles.noMargin]}>Your preferences</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/interests')} hitSlop={board.inlineGap}>
            <Text style={styles.subtle}>Manage</Text>
          </Pressable>
        </View>
        <Text style={styles.small}>{(account?.interests ?? []).length ? 'You seem to like' : 'Tell us what you enjoy to get better suggestions.'}</Text>
        <View style={styles.tags}>
          {(account?.interests ?? []).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        {links.map(({ Icon, label, onPress, danger }) => {
          const tone = danger ? colors.status.danger : colors.brand.plum;
          return (
            <Pressable key={label} accessibilityRole="button" onPress={onPress} style={styles.link}>
              <Icon size={icon.md} color={tone} strokeWidth={icon.strokeWidth} />
              <Text style={[styles.linkText, { color: tone }]}>{label}</Text>
              <ChevronRight size={icon.md} color={tone} strokeWidth={icon.strokeWidth} />
            </Pressable>
          );
        })}

        <Text style={styles.tiny}>The more you explore, the more it feels like you.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base },
  content: {
    paddingHorizontal: board.screenPaddingX,
    paddingBottom: board.fab.bottomAboveTabBar,
  },
  h1: { ...board.h1, color: colors.brand.plum, marginTop: P.titleMarginTop },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsButton: { marginTop: P.titleMarginTop, padding: board.h2MarginBottom / 2 },
  avatar: { alignSelf: 'center', marginTop: P.avatar.marginTop, marginBottom: P.avatar.marginBottom },
  editLink: { alignSelf: 'center', marginTop: board.subtleControl.paddingY / 2 },
  subtle: { fontSize: board.subtleControl.fontSize, color: colors.brand.violet, paddingVertical: board.subtleControl.paddingY },
  prefRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noMargin: { marginBottom: 0 },
  name: {
    ...board.home.title, fontSize: P.nameSize, textAlign: 'center',
    color: colors.brand.plum, marginBottom: board.h2MarginBottom,
  },
  city: { ...board.small, textAlign: 'center', color: colors.text.secondary },
  stats: {
    flexDirection: 'row', justifyContent: 'center', gap: P.statsGap,
    marginTop: P.statsMarginTop, marginBottom: P.statsMarginBottom,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: P.statSize, lineHeight: P.statLineHeight, fontWeight: '700', color: colors.brand.plum, marginBottom: P.statGap },
  small: { ...board.small, color: colors.text.secondary },
  h3: { ...board.home.sectionTitle, color: colors.brand.plum },
  tags: {
    flexDirection: 'row', flexWrap: 'wrap', gap: P.tags.gap,
    marginTop: P.tags.marginTop, marginBottom: P.tags.marginBottom,
  },
  tag: {
    paddingVertical: P.tags.paddingY, paddingHorizontal: P.tags.paddingX,
    borderRadius: P.tags.radius, backgroundColor: P.tags.background,
  },
  tagText: { fontSize: board.small.fontSize, color: colors.brand.plum },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: P.link.gap, paddingVertical: P.link.paddingY,
    borderBottomWidth: 1, borderBottomColor: P.link.borderColor,
  },
  linkText: { flex: 1, fontSize: P.link.fontSize },
  tiny: { ...board.tinyCenter, textAlign: 'center', marginTop: P.tags.marginBottom },
});
