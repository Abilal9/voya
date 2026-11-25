import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, FlaskConical, Heart, History, LogOut, type LucideIcon } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import type { PlanType } from '@/services';
import { useSession } from '@/stores/session';
import { board, colors, icon } from '@/theme';

const P = board.profile;

function initials(first?: string, last?: string) {
  if (!first) return '';
  return `${first[0] ?? ''}${last?.[0] ?? first[1] ?? ''}`.toUpperCase();
}

/**
 * 03 Profile — board figure "03".
 * KNOWN GAP: Edit profile (V01), Settings (V02) and Manage interests (V13) are
 * not built, so their controls are not shown yet. Log out lives here until
 * Settings exists (the board puts it under V02 → V09).
 */
export default function Profile() {
  const router = useRouter();
  const services = useServices();
  const account = useSession((s) => s.account);
  const signOut = useSession((s) => s.signOut);

  const upcoming = useQuery({ queryKey: ['plans', 'upcoming'], queryFn: () => services.plans.listUpcoming() });
  const past = useQuery({ queryKey: ['plans', 'past'], queryFn: () => services.plans.listPast() });
  const all = [...(upcoming.data ?? []), ...(past.data ?? [])];
  const count = (t: PlanType) => all.filter((p) => p.type === t).length;

  const links: { Icon: LucideIcon; label: string; onPress: () => void; danger?: boolean }[] = [
    { Icon: Heart, label: 'Saved places', onPress: () => router.push('/saved') },
    { Icon: History, label: 'Past Plans', onPress: () => router.push('/past-plans') },
    ...(__DEV__ ? [{ Icon: FlaskConical, label: 'Developer menu', onPress: () => router.push('/dev') }] : []),
    { Icon: LogOut, label: 'Log out', onPress: () => void signOut(), danger: true },
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Profile</Text>
        <View style={styles.avatar} accessibilityRole="image" accessibilityLabel={account?.displayName}>
          <Text style={styles.avatarText}>{initials(account?.firstName, account?.lastName)}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{account?.firstName ?? ''}</Text>
        {account?.city ? <Text style={styles.city}>{account.city}</Text> : null}

        <View style={styles.stats}>
          {([['trip', 'Trips'], ['hangout', 'Hangouts'], ['event', 'Events']] as const).map(([t, label]) => (
            <View key={t} style={styles.stat}>
              <Text style={styles.statValue}>{count(t)}</Text>
              <Text style={styles.small}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h3}>Your preferences</Text>
        <Text style={styles.small}>You seem to like</Text>
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
  avatar: {
    width: P.avatar.size, height: P.avatar.size, borderRadius: P.avatar.size / 2,
    alignSelf: 'center', marginTop: P.avatar.marginTop, marginBottom: P.avatar.marginBottom,
    backgroundColor: colors.brand.lavender, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: P.avatar.fontSize, lineHeight: P.avatar.lineHeight, fontWeight: '600', color: colors.brand.violet },
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
