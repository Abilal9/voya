import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { PHOTO_TINT } from '@/features/explore/PlaceCard';
import { PLAN_LABEL, rowWhen } from '@/features/home/planFormat';
import { useServices } from '@/services/ServicesProvider';
import type { Plan, PlanType } from '@/services';
import { board, colors } from '@/theme';

const P = board.pastPlans;
const SEG = board.segment;
const FILTERS: { label: string; type?: PlanType }[] = [
  { label: 'All' },
  { label: 'Trips', type: 'trip' },
  { label: 'Hangouts', type: 'hangout' },
  { label: 'Events', type: 'event' },
];

/** V11 Past Plans. */
export default function PastPlans() {
  const router = useRouter();
  const services = useServices();
  const [filter, setFilter] = React.useState<PlanType | undefined>();
  const past = useQuery({ queryKey: ['plans', 'past'], queryFn: () => services.plans.listPast() });
  const shown = (past.data ?? []).filter((p) => !filter || p.type === filter);

  return (
    <Screen contentStyle={styles.screen}>
      <TopBar title="Profile" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.h1}>Past Plans</Text>
          <Text style={styles.introBody}>Good days, worth remembering.</Text>
        </View>
        <View style={styles.seg} accessibilityRole="tablist">
          {FILTERS.map((f) => {
            const active = f.type === filter;
            return (
              <Pressable
                key={f.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(f.type)}
                style={[styles.segItem, active && styles.segActive]}
              >
                <Text style={[styles.segText, active && styles.segTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {past.isPending ? (
          <LoadingState label="Loading past plans" />
        ) : past.isError ? (
          <ErrorState onRetry={() => void past.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState title="Nothing here yet" body="Finished plans will be kept here." />
        ) : (
          shown.map((p: Plan) => (
            <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/plan/${p.id}`)} style={styles.card}>
              <View style={[styles.photo, { backgroundColor: PHOTO_TINT[p.coverPhoto ?? ''] ?? colors.surface.sunken }]} />
              <Text style={styles.title} numberOfLines={2}>{p.title}</Text>
              <Text style={styles.small}>{`${PLAN_LABEL[p.type]} · ${rowWhen(p).split(' · ')[0]}`}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: board.screenPaddingX },
  intro: { marginBottom: P.introMarginBottom },
  h1: { ...board.h1, color: colors.brand.plum },
  introBody: { fontSize: P.introBodySize, lineHeight: P.introBodySize * 1.6, color: colors.text.secondary },
  seg: {
    flexDirection: 'row', gap: SEG.gap, padding: SEG.padding, borderRadius: SEG.radius,
    backgroundColor: SEG.background, marginTop: SEG.marginTop, marginBottom: SEG.marginBottom,
  },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: SEG.itemPaddingY, borderRadius: SEG.itemRadius },
  segActive: { backgroundColor: colors.surface.base },
  segText: { fontSize: SEG.fontSize, color: colors.brand.plum },
  segTextActive: { color: colors.brand.violet, fontWeight: '600' },
  card: { marginBottom: P.cardMarginBottom },
  photo: { height: P.photoHeight, borderRadius: board.photoRadius, marginBottom: P.photoMarginBottom },
  title: { fontSize: P.titleSize, fontWeight: '600', color: colors.brand.plum, marginBottom: board.home.rowTitle.marginBottom },
  small: { ...board.small, color: colors.text.secondary },
});
