import * as React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VoyaLogo } from '@/components/brand';
import { AvatarStack, EmptyState, ErrorState, LoadingState, Text } from '@/components/ui';
import { PHOTO_TINT } from '@/features/explore/PlaceCard';
import {
  PLAN_LABEL, greeting, headcount, memberNames, rowWhen, shortWhen,
} from '@/features/home/planFormat';
import { useServices } from '@/services/ServicesProvider';
import type { Plan } from '@/services';
import { useSession } from '@/stores/session';
import { board, colors, icon, layout } from '@/theme';

const H = board.home;

const tint = (plan: Plan) => PHOTO_TINT[plan.coverPhoto ?? plan.type] ?? colors.surface.sunken;

/** 01 Home — measurements from the board's Home figure (440pt artboard). */
export default function Home() {
  const router = useRouter();
  const services = useServices();
  const account = useSession((s) => s.account);

  const plans = useQuery({ queryKey: ['plans', 'upcoming'], queryFn: () => services.plans.listUpcoming() });
  const past = useQuery({ queryKey: ['plans', 'past'], queryFn: () => services.plans.listPast() });
  const unread = useQuery({ queryKey: ['activity', 'unread'], queryFn: () => services.notifications.unreadCount() });

  const upNext = plans.data?.[0];
  const rest = plans.data?.slice(1) ?? [];
  const recent = past.data?.[0];
  const open = (p: Plan) => router.push(`/plan/${p.id}`);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={plans.isRefetching} onRefresh={() => void plans.refetch()} />
        }
      >
        <View style={styles.brandRow}>
          <VoyaLogo width={H.brandHeight * board.emblemAspect * board.logoAspect} />
          {/* KNOWN GAP: Activity (38) is not built yet, so the bell opens Profile. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Activity"
            hitSlop={layout.minTouchTarget / 4}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Bell size={icon.lg} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
            {(unread.data ?? 0) > 0 ? <View style={styles.dot} /> : null}
          </Pressable>
        </View>
        <Text style={styles.greeting}>{`${greeting()}, ${account?.firstName ?? 'there'}`}</Text>

        {plans.isPending ? (
          <LoadingState label="Loading your plans" />
        ) : plans.isError ? (
          <ErrorState onRetry={() => void plans.refetch()} />
        ) : !upNext ? (
          <EmptyState
            title="Nothing planned yet"
            body="Create a trip, hangout or event and it will show up here."
            actionLabel="Create a plan"
            onAction={() => router.push('/create')}
          />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Up Next</Text>
            <Pressable accessibilityRole="button" onPress={() => open(upNext)} style={styles.upNext}>
              <View style={[styles.upNextPhoto, { backgroundColor: tint(upNext) }]} />
              <View style={styles.between}>
                <Text style={styles.eyebrow}>{PLAN_LABEL[upNext.type].toUpperCase()}</Text>
                <Text style={styles.small}>{shortWhen(upNext)}</Text>
              </View>
              <Text style={styles.upNextTitle} numberOfLines={2}>{upNext.title}</Text>
              <View style={[styles.between, styles.upNextFooter]}>
                <AvatarStack names={memberNames(upNext)} />
                <Text style={styles.small}>{headcount(upNext)}</Text>
              </View>
            </Pressable>

            {rest.length > 0 ? <Text style={styles.sectionTitle}>Upcoming</Text> : null}
            {rest.map((p, i) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => open(p)}
                style={[styles.row, i === rest.length - 1 && styles.rowLast]}
              >
                <View style={[styles.thumb, { backgroundColor: tint(p) }]} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={styles.small} numberOfLines={1}>{rowWhen(p)}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {recent ? (
          <Pressable accessibilityRole="button" onPress={() => open(recent)} style={styles.recent}>
            <Text style={styles.recentTitle}>Recent</Text>
            <Text style={styles.recentBody}>{`${recent.title} · ${PLAN_LABEL[recent.type]}`}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base },
  content: {
    paddingHorizontal: board.screenPaddingX,
    // Room for the floating + so the last row is never covered.
    paddingBottom: board.fab.size + board.fab.bottomAboveTabBar * 2,
  },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: H.brandMarginTop, marginBottom: H.brandMarginBottom, height: H.brandHeight,
  },
  dot: {
    position: 'absolute', top: 0, right: 0, width: board.badgeDot, height: board.badgeDot,
    borderRadius: board.badgeDot / 2, backgroundColor: colors.brand.peach,
  },
  greeting: { ...board.small, color: colors.text.secondary, marginBottom: H.greetingMarginBottom },
  sectionTitle: { ...H.sectionTitle, color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: board.inlineGap },
  upNext: {
    padding: H.upNext.padding, borderRadius: H.upNext.radius, backgroundColor: H.upNext.background,
    marginTop: H.upNext.marginTop - H.sectionTitle.marginBottom, marginBottom: H.upNext.marginBottom,
  },
  upNextPhoto: { height: H.upNext.photoHeight, borderRadius: board.photoRadius, marginBottom: H.upNext.photoMarginBottom },
  eyebrow: { ...H.eyebrow, color: colors.brand.violet },
  upNextTitle: { ...H.title, color: colors.brand.plum, marginTop: H.upNext.titleMarginTop, marginBottom: board.h2MarginBottom },
  upNextFooter: { marginTop: H.upNext.avatarsMarginTop },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: board.listRow.gap,
    paddingVertical: board.listRow.paddingY,
    borderBottomWidth: 1, borderBottomColor: board.listRow.borderColor,
  },
  rowLast: { borderBottomWidth: 0 },
  thumb: { width: board.thumb.width, height: board.thumb.height, borderRadius: board.thumb.radius },
  rowText: { flex: 1 },
  rowTitle: {
    fontSize: H.rowTitle.fontSize, fontWeight: '700', color: colors.brand.plum, marginBottom: H.rowTitle.marginBottom,
  },
  recent: { marginTop: H.recent.marginTop },
  recentTitle: {
    fontSize: H.recent.titleSize, fontWeight: '600', color: colors.brand.plum, marginBottom: H.recent.titleMarginBottom,
  },
  recentBody: { ...board.small, color: H.recent.bodyColor },
});
