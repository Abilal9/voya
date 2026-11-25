import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { usePeople } from '@/features/catalog';
import { useServices } from '@/services/ServicesProvider';
import type { ActivityEntry } from '@/services';
import { board, colors } from '@/theme';

const A = board.activity;
const DAY = 24 * 60 * 60 * 1000;

function dayLabel(iso: string, now: Date) {
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startOfToday) return 'Today';
  if (d.getTime() >= startOfToday - DAY) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

function ago(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** 38 Activity — board figure "38". Opening it marks everything read. */
export default function Activity() {
  const router = useRouter();
  const services = useServices();
  const qc = useQueryClient();
  const people = usePeople();

  const list = useQuery({ queryKey: ['activity', 'list'], queryFn: () => services.notifications.list() });
  const plans = useQuery({ queryKey: ['plans', 'all-for-activity'], queryFn: async () => {
    const [up, past] = await Promise.all([services.plans.listUpcoming(), services.plans.listPast()]);
    return new Map([...up, ...past].map((p) => [p.id, p.title]));
  } });

  // Remember what was unread when the screen opened, then mark it read.
  const [unreadOnOpen, setUnreadOnOpen] = React.useState<Set<string> | null>(null);
  React.useEffect(() => {
    if (!list.data || unreadOnOpen) return;
    setUnreadOnOpen(new Set(list.data.filter((a) => !a.readAt).map((a) => a.id)));
    void services.notifications.markAllRead().then(() => qc.invalidateQueries({ queryKey: ['activity', 'unread'] }));
  }, [list.data, unreadOnOpen, services, qc]);

  const now = new Date();
  const groups: { label: string; items: ActivityEntry[] }[] = [];
  for (const entry of list.data ?? []) {
    const label = dayLabel(entry.createdAt, now);
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(entry);
    else groups.push({ label, items: [entry] });
  }

  return (
    <Screen contentStyle={styles.screen}>
      <TopBar title="Your Plans" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Activity</Text>
        <Text style={styles.intro}>A little update from everyone.</Text>
        {list.isPending ? (
          <LoadingState label="Loading activity" />
        ) : list.isError ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : groups.length === 0 ? (
          <EmptyState title="All quiet" body="Updates from your plans will show up here." />
        ) : (
          groups.map((g) => (
            <View key={g.label}>
              <Text style={styles.dayLabel}>{g.label.toUpperCase()}</Text>
              {g.items.map((a) => {
                const actor = a.actorId ? people.byId.get(a.actorId) : undefined;
                const initials = actor
                  ? `${actor.firstName[0] ?? ''}${actor.lastName?.[0] ?? actor.firstName[1] ?? ''}`.toUpperCase()
                  : '';
                const planTitle = a.planId ? plans.data?.get(a.planId) : undefined;
                return (
                  <Pressable
                    key={a.id}
                    accessibilityRole="button"
                    disabled={!a.planId}
                    onPress={() => a.planId && router.push(`/plan/${a.planId}`)}
                    style={styles.row}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.title}>{a.message}</Text>
                      {planTitle ? <Text style={styles.body}>{planTitle}</Text> : null}
                    </View>
                    <View>
                      <Text style={styles.time}>{ago(a.createdAt, now.getTime())}</Text>
                      {unreadOnOpen?.has(a.id) ? <View style={styles.dot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: board.screenPaddingX },
  h1: { ...board.h1, color: colors.brand.plum },
  intro: { fontSize: board.form.introBodySize, lineHeight: board.form.introBodySize * 1.6, color: colors.text.secondary },
  dayLabel: {
    fontSize: A.dayLabelSize, letterSpacing: A.dayLabelTracking, color: A.dayLabelColor, marginTop: A.dayLabelMarginTop,
  },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: A.rowGap, paddingVertical: A.rowPaddingY,
    borderBottomWidth: 1, borderBottomColor: board.listRow.borderColor,
  },
  avatar: {
    width: A.avatar, height: A.avatar, borderRadius: A.avatar / 2, backgroundColor: board.avatar.tints[0],
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: board.avatar.fontSize, fontWeight: board.avatar.fontWeight, color: colors.brand.plum },
  rowText: { flex: 1 },
  title: {
    fontSize: A.titleSize, lineHeight: A.titleLineHeight, fontWeight: '600',
    color: colors.brand.plum, marginBottom: A.titleMarginBottom,
  },
  body: { fontSize: A.bodySize, lineHeight: A.bodyLineHeight, color: colors.text.secondary },
  time: { fontSize: A.timeSize, color: A.timeColor, paddingTop: board.inlineGap / 2 },
  dot: {
    width: A.dot, height: A.dot, borderRadius: A.dot / 2, backgroundColor: colors.brand.lavender,
    alignSelf: 'center', marginTop: board.h2MarginBottom,
  },
});
