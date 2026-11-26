import * as React from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Check, ChevronDown, Heart, LayoutGrid, Map as MapIcon, MapPin, Search, SlidersHorizontal, Sparkles, X,
} from 'lucide-react-native';
import { EmptyState, ErrorState, LoadingState, Text } from '@/components/ui';
import { SwipeDeck, type SwipeDeckHandle } from '@/features/explore/SwipeDeck';
import { PlaceCard } from '@/features/explore/PlaceCard';
import { useSavedPlaces } from '@/features/explore/useSavedPlaces';
import { useServices } from '@/services/ServicesProvider';
import { useCategories, useCities } from '@/features/catalog';
import { EMPTY_FILTERS, activeFilterCount, toQuery, useExploreFilters } from '@/features/explore/filters';
import type { Place, PlaceCategory } from '@/services';
import { board, colors, icon } from '@/theme';

const E = board.explore;
type ExploreView = 'deck' | 'list';

/**
 * E01 Explore — board figure "E01". Search (E10) and Filters (E07) open from
 * the header; the category chips are the Filters sheet's categories.
 * KNOWN GAPS: the map (E05/E06) and location sheet (E02) are not built; the
 * Map pill switches to a list and says so, and the city uses an action sheet.
 */
export default function Explore() {
  const router = useRouter();
  const services = useServices();
  const deck = React.useRef<SwipeDeckHandle>(null);

  const citiesQuery = useCities();
  const categoriesQuery = useCategories();
  const cities = citiesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const homeCity = cities[0] ?? '';
  const chosenCity = useExploreFilters((s) => s.city);
  const setCity = useExploreFilters((s) => s.setCity);
  const filters = useExploreFilters((s) => s.filters);
  const setFilters = useExploreFilters((s) => s.setFilters);
  const city = chosenCity ?? homeCity;
  const filterCount = activeFilterCount(filters);
  // The chip row shows "All" or the single selected category.
  const category: PlaceCategory | 'All' = filters.categories.length === 1 ? filters.categories[0]! : 'All';
  const setCategory = (c: PlaceCategory | 'All') =>
    setFilters({ ...filters, categories: c === 'All' ? [] : [c] });
  const [view, setView] = React.useState<ExploreView>('deck');
  const [top, setTop] = React.useState(0);

  const places = useQuery({
    queryKey: ['places', city, filters],
    queryFn: () => services.places.discover({ city, ...toQuery(filters) }),
    enabled: !!city,
  });
  const saved = useSavedPlaces();

  const results = places.data ?? [];
  React.useEffect(() => setTop(0), [places.data]);
  const current: Place | undefined = results[top];
  const isSaved = !!current && saved.isSaved(current.id);

  const onSwipe = React.useCallback(
    async (place: Place, direction: 'like' | 'dislike') => {
      setTop((i) => i + 1);
      await services.places.setSignal(place.id, direction);
    },
    [services],
  );

  const toggleSave = async () => {
    if (current) await saved.toggle(current.id);
  };

  const chooseCity = () => {
    const options = [...cities];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Choose a city', options: [...options, 'Cancel'], cancelButtonIndex: options.length },
        (i) => { if (i < options.length) setCity(options[i]); },
      );
    } else {
      Alert.alert('Choose a city', undefined, [
        ...options.map((c) => ({ text: c, onPress: () => setCity(c) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  const openPlace = (p: Place) => router.push(`/place/${p.id}`);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.h1}>Explore</Text>
          <Pressable
            accessibilityRole="button" accessibilityLabel="Search places"
            onPress={() => router.push('/search')} hitSlop={board.inlineGap} style={styles.searchButton}
          >
            <Search size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
          </Pressable>
        </View>
        <View style={styles.locationRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Location: ${city}. Change city`} onPress={chooseCity} style={styles.location}>
            <MapPin size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
            <Text style={styles.city}>{city}</Text>
            <Text style={styles.small}>{city === homeCity ? 'Near me' : 'Change'}</Text>
            <ChevronDown size={icon.sm} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={filterCount ? `Explore filters, ${filterCount} on` : 'Explore filters'}
            onPress={() => router.push('/filters')}
            style={styles.filterButton}
          >
            <SlidersHorizontal size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
            {filterCount ? (
              <View style={styles.filterCount}><Text style={styles.filterCountText}>{filterCount}</Text></View>
            ) : null}
          </Pressable>
        </View>
        <Text style={styles.note}>Discover places you&apos;ll love</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesRow}
          contentContainerStyle={styles.categories}
        >
          {(['All', ...categories] as const).map((c) => {
            const selected = category === c;
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCategory(c as PlaceCategory | 'All')}
                style={[styles.category, selected && styles.categorySelected]}
              >
                <Text style={styles.categoryText}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {places.isPending ? (
          <LoadingState label="Finding places" />
        ) : places.isError ? (
          <ErrorState onRetry={() => void places.refetch()} />
        ) : results.length === 0 || (view === 'deck' && !current) ? (
          <EmptyState
            title={results.length === 0 ? 'No places match' : "You've seen everything here"}
            body={filterCount ? 'Try fewer filters or another city.' : 'Try another city or category.'}
            actionLabel="Reset filters"
            onAction={() => {
              setFilters(EMPTY_FILTERS);
              setCity(undefined);
              void places.refetch();
            }}
          />
        ) : view === 'deck' ? (
          <>
            <SwipeDeck ref={deck} places={results} onSwipe={onSwipe} onOpen={openPlace} />
            <View style={styles.actions}>
              <Choice label="Not for me" background={E.actions.skipBackground} onPress={() => deck.current?.dislike()}>
                <X size={E.actions.icon} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
              </Choice>
              <Choice
                label="Save"
                accessibilityLabel={isSaved ? 'Saved. Tap to remove' : 'Save for later'}
                selected={isSaved}
                background={isSaved ? colors.brand.peach : E.actions.saveBackground}
                onPress={() => void toggleSave()}
              >
                <Heart
                  size={E.actions.icon}
                  color={isSaved ? colors.brand.plum : E.actions.saveColor}
                  fill={isSaved ? colors.brand.plum : 'transparent'}
                  strokeWidth={icon.strokeWidth}
                />
              </Choice>
              <Choice label="I like this" background={colors.brand.peach} onPress={() => deck.current?.like()}>
                <Check size={E.actions.icon} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
              </Choice>
            </View>
            <View style={styles.learning}>
              <Sparkles size={E.learning.icon} color={E.learning.color} strokeWidth={icon.strokeWidth} />
              <Text style={styles.learningText}>Your suggestions get better as you explore</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.listNote}>Map view arrives with the maps provider. Showing a list for now.</Text>
            {results.map((p) => (
              <View key={p.id} style={styles.listItem}>
                <PlaceCard place={p} onOpen={() => openPlace(p)} />
              </View>
            ))}
          </>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => setView(view === 'deck' ? 'list' : 'deck')}
          style={styles.mapToggle}
        >
          {view === 'deck' ? (
            <MapIcon size={E.mapToggle.icon} color={colors.text.inverse} strokeWidth={icon.strokeWidth} />
          ) : (
            <LayoutGrid size={E.mapToggle.icon} color={colors.text.inverse} strokeWidth={icon.strokeWidth} />
          )}
          <Text style={styles.mapToggleText}>{view === 'deck' ? 'Map' : 'Cards'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Choice({
  label, accessibilityLabel, background, selected, onPress, children,
}: {
  label: string;
  accessibilityLabel?: string;
  background: string;
  selected?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.choice}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={selected === undefined ? undefined : { selected }}
        onPress={onPress}
        style={({ pressed }) => [styles.round, { backgroundColor: background }, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
      <Text style={styles.choiceLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base },
  content: { paddingHorizontal: board.screenPaddingX, paddingBottom: board.fab.bottomAboveTabBar },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  searchButton: { marginTop: E.titleMarginTop, padding: board.h2MarginBottom },
  h1: { ...board.h1, color: colors.brand.plum, marginTop: E.titleMarginTop, marginBottom: E.titleMarginBottom },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: board.inlineGap },
  filterButton: {
    minWidth: board.filters.button.minWidth, height: board.filters.button.height, borderRadius: board.filters.button.radius,
    borderWidth: 1, borderColor: board.filters.button.border, alignItems: 'center', justifyContent: 'center',
  },
  filterCount: {
    position: 'absolute', top: board.filters.button.badgeOffset, right: board.filters.button.badgeOffset, minWidth: board.filters.button.badge, height: board.filters.button.badge,
    borderRadius: board.filters.button.badge / 2, backgroundColor: colors.brand.violet, alignItems: 'center', justifyContent: 'center',
  },
  filterCountText: { fontSize: board.filters.button.badgeFontSize, color: colors.text.inverse },
  location: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: E.location.gap, minHeight: E.location.minHeight,
    paddingVertical: E.location.paddingY, paddingHorizontal: E.location.paddingX,
    borderRadius: E.location.radius, backgroundColor: E.location.background,
  },
  city: { flex: 1, fontSize: E.location.citySize, fontWeight: '700', color: colors.brand.plum },
  small: { ...board.small, color: colors.text.secondary },
  note: { fontSize: E.note.fontSize, color: E.note.color, marginTop: E.note.marginTop },
  categoriesRow: {
    flexGrow: 0, marginHorizontal: -board.screenPaddingX,
    marginTop: E.categories.marginTop, marginBottom: E.categories.marginBottom,
  },
  categories: { gap: E.categories.gap, paddingHorizontal: board.screenPaddingX },
  category: {
    minHeight: E.categories.minHeight, justifyContent: 'center',
    paddingVertical: E.categories.paddingY, paddingHorizontal: E.categories.paddingX,
    borderRadius: E.categories.radius, borderWidth: 1, borderColor: E.categories.border,
  },
  categorySelected: { backgroundColor: colors.brand.lavender, borderColor: colors.brand.lavender },
  categoryText: { fontSize: E.categories.fontSize, color: colors.brand.plum },
  actions: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: E.actions.gap,
    marginTop: E.actions.marginTop, marginBottom: E.actions.marginBottom,
  },
  choice: { alignItems: 'center', gap: E.actions.labelGap },
  round: {
    width: E.actions.size, height: E.actions.size, borderRadius: E.actions.size / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.95 }] },
  choiceLabel: { fontSize: E.actions.labelSize, color: E.actions.labelColor },
  learning: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: E.learning.gap,
    marginTop: E.learning.marginTop, marginBottom: E.learning.marginBottom,
  },
  learningText: { fontSize: E.learning.fontSize, color: E.learning.color },
  listNote: { ...board.small, color: colors.text.secondary, marginBottom: board.listRow.paddingY },
  listItem: { height: E.card.height, marginBottom: board.listRow.paddingY },
  mapToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: E.mapToggle.gap,
    alignSelf: 'center', minHeight: E.mapToggle.minHeight, borderRadius: E.mapToggle.radius,
    paddingVertical: E.mapToggle.paddingY, paddingHorizontal: E.mapToggle.paddingX,
    backgroundColor: colors.brand.plum, marginTop: board.listRow.paddingY,
  },
  mapToggleText: { fontSize: E.mapToggle.fontSize, color: colors.text.inverse },
});
