import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react-native';
import { EmptyState, ErrorState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { PHOTO_TINT, ratingLine } from '@/features/explore/PlaceCard';
import { useServices } from '@/services/ServicesProvider';
import type { Place } from '@/services';
import { board, colors, icon } from '@/theme';

const S = board.saved;

/**
 * 39 Saved Places — board figure "39".
 * KNOWN GAP: "Add to Plan" (E09) is not built, so only "View" is offered.
 * The heart removes the place from Saved.
 */
export default function Saved() {
  const router = useRouter();
  const services = useServices();
  const qc = useQueryClient();
  const [city, setCity] = React.useState('All');

  const saved = useQuery({ queryKey: ['saved'], queryFn: () => services.saved.list() });
  const places = useQuery({
    queryKey: ['saved', 'hydrated', saved.data?.map((s) => s.placeId).join(',')],
    enabled: !!saved.data,
    queryFn: async () => Promise.all((saved.data ?? []).map((s) => services.places.getPlace(s.placeId))),
  });

  const all = places.data ?? [];
  const cities = ['All', ...Array.from(new Set(all.map((p) => p.city)))];
  const shown = all.filter((p) => city === 'All' || p.city === city);

  const remove = async (p: Place) => {
    await services.saved.unsave(p.id);
    void qc.invalidateQueries({ queryKey: ['saved'] });
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.screen}>
      <TopBar title="Your places" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Saved</Text>
        <Text style={styles.small}>Places you want to remember</Text>

        {saved.isPending || (saved.data && places.isPending) ? (
          <LoadingState />
        ) : saved.isError || places.isError ? (
          <ErrorState onRetry={() => void saved.refetch()} />
        ) : all.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            body="Tap Save on a place in Explore and it lands here."
            actionLabel="Open Explore"
            onAction={() => router.replace('/(tabs)/explore')}
          />
        ) : (
          <>
            <View style={styles.filters}>
              {cities.map((c) => {
                const selected = c === city;
                return (
                  <Pressable
                    key={c}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setCity(c)}
                    style={[styles.filter, selected && styles.filterSelected]}
                  >
                    <Text style={styles.filterText}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
            {shown.map((p) => (
              <View key={p.id} style={styles.card}>
                <View style={[styles.photo, { backgroundColor: PHOTO_TINT[p.photo ?? ''] ?? board.explore.card.placeholder }]} />
                <View style={styles.cardText}>
                  <Text style={styles.title} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.line} numberOfLines={1}>{[p.category, p.city].join(' · ')}</Text>
                  <Text style={styles.line}>{ratingLine(p)}</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push(`/place/${p.id}`)} style={styles.action}>
                    <Text style={styles.actionText}>View</Text>
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${p.name} from Saved`}
                  hitSlop={S.card.heart}
                  onPress={() => void remove(p)}
                  style={styles.heart}
                >
                  <Heart size={S.card.heart} color={colors.brand.violet} fill={colors.brand.lavender} strokeWidth={icon.strokeWidth} />
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <Text style={styles.tiny}>A good idea now. A great Plan later.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: board.screenPaddingX },
  scroll: { flexGrow: 1 },
  h1: { ...board.h1, color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  filters: {
    flexDirection: 'row', flexWrap: 'wrap', gap: S.filters.gap,
    marginTop: S.filters.marginTop + board.h2MarginBottom, marginBottom: S.filters.marginBottom,
  },
  filter: {
    minHeight: S.filters.minHeight, justifyContent: 'center',
    paddingVertical: S.filters.paddingY, paddingHorizontal: S.filters.paddingX,
    borderRadius: S.filters.radius, borderWidth: 1, borderColor: S.filters.border,
  },
  filterSelected: { backgroundColor: colors.brand.lavender, borderColor: colors.brand.lavender },
  filterText: { fontSize: S.filters.fontSize, color: colors.brand.plum },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: S.card.gap,
    marginBottom: S.card.marginBottom, paddingBottom: S.card.paddingBottom,
    borderBottomWidth: 1, borderBottomColor: board.listRow.borderColor,
  },
  photo: { width: S.card.photoWidth, height: S.card.photoHeight, borderRadius: S.card.photoRadius },
  cardText: { flex: 1 },
  title: {
    fontSize: S.card.titleSize, fontWeight: '600', color: colors.brand.plum,
    marginTop: S.card.titleMarginTop, marginBottom: S.card.titleMarginBottom,
  },
  line: { fontSize: S.card.lineSize, color: colors.text.secondary, marginBottom: S.card.lineMarginBottom },
  action: { alignSelf: 'flex-start', paddingVertical: S.card.actionPaddingY, marginTop: S.card.actionMarginTop },
  actionText: { ...board.small, color: colors.brand.violet },
  heart: { paddingTop: S.card.heartPaddingTop },
  tiny: { ...board.tinyCenter, textAlign: 'center', paddingVertical: board.listRow.paddingY },
});
