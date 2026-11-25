import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, Heart, Map as MapIcon, Rows3, X } from 'lucide-react-native';
import {
  Chip, EmptyState, ErrorState, IconButton, LoadingState, Text,
} from '@/components/ui';
import { SwipeDeck, type SwipeDeckHandle } from '@/features/explore/SwipeDeck';
import { PlaceCard } from '@/features/explore/PlaceCard';
import { useServices } from '@/services/ServicesProvider';
import { CITIES, INTERESTS } from '@/mocks/fixtures';
import type { Place, PlaceCategory } from '@/services';
import { colors, icon, layout, radius, spacing } from '@/theme';

type ExploreView = 'deck' | 'list';

/** E01–E07 Explore. Map view arrives with the provider milestone — see docs. */
export default function Explore() {
  const router = useRouter();
  const services = useServices();
  const qc = useQueryClient();
  const deck = React.useRef<SwipeDeckHandle>(null);

  const [city, setCity] = React.useState<string>(CITIES[0]);
  const [category, setCategory] = React.useState<PlaceCategory | 'All'>('All');
  const [view, setView] = React.useState<ExploreView>('deck');

  const places = useQuery({
    queryKey: ['places', city, category],
    queryFn: () => services.places.discover({ city, category }),
  });

  const onSwipe = React.useCallback(
    async (place: Place, direction: 'like' | 'dislike') => {
      await services.places.setSignal(place.id, direction === 'like' ? 'like' : 'dislike');
      if (direction === 'like') await services.saved.save(place.id);
      void qc.invalidateQueries({ queryKey: ['saved'] });
    },
    [services, qc],
  );

  const results = places.data ?? [];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text variant="overline" tone="tertiary">EXPLORE</Text>
          <Text variant="h2">{city}</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            label={view === 'deck' ? 'Switch to list' : 'Switch to cards'}
            tone="surface"
            onPress={() => setView(view === 'deck' ? 'list' : 'deck')}
          >
            {view === 'deck' ? (
              <Rows3 size={icon.md} color={colors.text.primary} strokeWidth={icon.strokeWidth} />
            ) : (
              <MapIcon size={icon.md} color={colors.text.primary} strokeWidth={icon.strokeWidth} />
            )}
          </IconButton>
          <IconButton label="Saved places" tone="surface" onPress={() => router.push('/saved')}>
            <Bookmark size={icon.md} color={colors.text.primary} strokeWidth={icon.strokeWidth} />
          </IconButton>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {CITIES.map((c) => (
          <Chip key={c} label={c} selected={c === city} onPress={() => setCity(c)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <Chip label="All" selected={category === 'All'} onPress={() => setCategory('All')} />
        {INTERESTS.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={category === c}
            onPress={() => setCategory(c as PlaceCategory)}
          />
        ))}
      </ScrollView>

      <View style={styles.body}>
        {places.isPending ? (
          <LoadingState label="Finding places" />
        ) : places.isError ? (
          <ErrorState onRetry={() => void places.refetch()} />
        ) : results.length === 0 ? (
          <EmptyState
            title="No places here yet"
            body="Try another city or category."
            actionLabel="Reset filters"
            onAction={() => {
              setCategory('All');
              setCity(CITIES[0]);
            }}
          />
        ) : view === 'deck' ? (
          <>
            <SwipeDeck ref={deck} places={results} onSwipe={onSwipe} />
            <View style={styles.deckActions}>
              <IconButton label="Skip" tone="surface" onPress={() => deck.current?.dislike()}>
                <X size={icon.lg} color={colors.status.danger} strokeWidth={icon.strokeWidth} />
              </IconButton>
              <IconButton label="Save" tone="surface" onPress={() => deck.current?.like()}>
                <Heart size={icon.lg} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
              </IconButton>
            </View>
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {results.map((p) => (
              <View key={p.id} style={styles.listItem}>
                <PlaceCard place={p} />
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding, paddingTop: spacing.xs,
  },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  filters: { paddingHorizontal: layout.screenPadding, gap: spacing.xs, paddingVertical: spacing.xs },
  body: { flex: 1, paddingHorizontal: layout.screenPadding, paddingBottom: 140 },
  deckActions: {
    position: 'absolute', bottom: 150, alignSelf: 'center',
    flexDirection: 'row', gap: spacing.xl,
  },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  listItem: { height: 320, borderRadius: radius.xl },
});
