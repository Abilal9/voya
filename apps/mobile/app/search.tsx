import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Heart, History, Search as SearchIcon, SlidersHorizontal } from 'lucide-react-native';
import { Button, ErrorState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, StateHero, ToggleChip, authStyles } from '@/features/auth/AuthParts';
import { useCities } from '@/features/catalog';
import { PHOTO_TINT, ratingLine } from '@/features/explore/PlaceCard';
import { activeFilterCount, toQuery, useExploreFilters } from '@/features/explore/filters';
import { useSavedPlaces } from '@/features/explore/useSavedPlaces';
import { useServices } from '@/services/ServicesProvider';
import { board, colors, icon } from '@/theme';

const S = board.search;

/**
 * E10 Search, E11 Search results, E12 No search results — board figures
 * "E10"–"E12". Results use the same Explore filters (E07) and city.
 */
export default function Search() {
  const router = useRouter();
  const services = useServices();
  const qc = useQueryClient();
  const cities = useCities();
  const chosenCity = useExploreFilters((s) => s.city);
  const filters = useExploreFilters((s) => s.filters);
  const city = chosenCity ?? cities.data?.[0];

  const [text, setText] = React.useState('');
  const [submitted, setSubmitted] = React.useState<string | null>(null);

  const recent = useQuery({ queryKey: ['search', 'recent'], queryFn: () => services.places.recentSearches() });
  const popular = useQuery({ queryKey: ['catalog', 'popular'], queryFn: () => services.catalog.popularSearches() });
  const saved = useSavedPlaces();
  const results = useQuery({
    queryKey: ['search', submitted, city, filters],
    queryFn: () => services.places.search({ query: submitted ?? '', city, ...toQuery(filters) }),
    enabled: !!submitted,
  });

  const run = async (q: string) => {
    const query = q.trim();
    if (!query) return;
    setText(query);
    setSubmitted(query);
    await services.places.rememberSearch(query);
    void qc.invalidateQueries({ queryKey: ['search', 'recent'] });
  };

  const clear = () => {
    setText('');
    setSubmitted(null);
  };

  const field = (
    <View style={styles.field}>
      <SearchIcon size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => void run(text)}
        placeholder="Search places and experiences"
        placeholderTextColor={board.field.placeholder}
        accessibilityLabel="Search places and experiences"
        returnKeyType="search"
        autoCorrect={false}
        autoFocus={!submitted}
        style={styles.input}
      />
      <Pressable accessibilityRole="button" onPress={() => void run(text)} hitSlop={board.inlineGap}>
        <Text style={styles.searchLink}>Search</Text>
      </Pressable>
    </View>
  );

  // E10 — before searching
  if (!submitted) {
    return (
      <Screen contentStyle={authStyles.screen}>
        <TopBar title="Explore" />
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthIntro tight title={'Find your\nnext good idea.'} />
          {field}
          {(recent.data ?? []).length > 0 ? <Text style={styles.group}>RECENT SEARCHES</Text> : null}
          {(recent.data ?? []).map((q) => (
            <Pressable key={q} accessibilityRole="button" onPress={() => void run(q)} style={styles.row}>
              <History size={S.row.icon} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
              <Text style={styles.rowText} numberOfLines={1}>{q}</Text>
              <ChevronRight size={S.row.icon} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
            </Pressable>
          ))}
          <Text style={styles.group}>POPULAR NEAR YOU</Text>
          <View style={styles.chips}>
            {(popular.data ?? []).map((q) => (
              <ToggleChip key={q} label={q} selected={false} onPress={() => void run(q)} />
            ))}
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const list = results.data ?? [];

  // E12 — nothing matches
  if (results.isSuccess && list.length === 0) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']} contentStyle={authStyles.screen}>
        <TopBar title="Search" onBack={clear} />
        {field}
        <StateHero
          Icon={SearchIcon}
          title={'Nothing quite\nmatches that'}
          body={activeFilterCount(filters) ? 'Try another search, fewer filters, or explore what’s nearby.' : 'Try another search or explore what’s nearby.'}
        />
        <View style={authStyles.foot}>
          <Button label="Clear search" onPress={clear} />
          <Button label="Explore nearby" variant="ghost" onPress={() => router.replace('/(tabs)/explore')} />
        </View>
      </Screen>
    );
  }

  // E11 — results
  return (
    <Screen contentStyle={authStyles.screen}>
      <TopBar title="Search" onBack={clear} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {field}
        <View style={styles.resultsHeader}>
          <Text style={styles.h2} numberOfLines={2}>{submitted}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/filters')} style={styles.filtersLink}>
            <SlidersHorizontal size={icon.sm} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
            <Text style={styles.searchLink}>
              {activeFilterCount(filters) ? `Filters (${activeFilterCount(filters)})` : 'Filters'}
            </Text>
          </Pressable>
        </View>
        {city ? <Text style={styles.muted}>{`Places around ${city}`}</Text> : null}
        {results.isPending ? (
          <LoadingState label="Searching" />
        ) : results.isError ? (
          <ErrorState onRetry={() => void results.refetch()} />
        ) : (
          list.map((p) => {
            const isSaved = saved.isSaved(p.id);
            const km = services.places.distanceKm(p);
            return (
              <View key={p.id} style={styles.result}>
                <View style={[styles.photo, { backgroundColor: PHOTO_TINT[p.photo ?? ''] ?? board.explore.card.placeholder }]} />
                <View style={styles.resultText}>
                  <Text style={styles.resultTitle} numberOfLines={2}>{p.name}</Text>
                  {p.type ? <Text style={styles.line} numberOfLines={1}>{p.type}</Text> : null}
                  <Text style={styles.line} numberOfLines={1}>
                    {[p.area, km !== undefined ? `${km} km` : undefined].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.line}>{ratingLine(p)}</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push(`/place/${p.id}`)} style={styles.viewLink}>
                    <Text style={styles.searchLink}>View place</Text>
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isSaved ? `Remove ${p.name} from Saved` : `Save ${p.name}`}
                  accessibilityState={{ selected: isSaved }}
                  onPress={() => void saved.toggle(p.id)}
                  hitSlop={board.inlineGap}
                >
                  <Heart
                    size={board.saved.card.heart} color={colors.brand.violet}
                    fill={isSaved ? colors.brand.lavender : 'transparent'} strokeWidth={icon.strokeWidth}
                  />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: S.field.gap, padding: S.field.padding,
    borderRadius: S.field.radius, backgroundColor: S.field.background, minHeight: S.field.minHeight,
    marginTop: S.field.marginTop, marginBottom: S.field.marginBottom,
  },
  input: { flex: 1, fontSize: S.field.fontSize, color: colors.brand.plum, padding: 0 },
  searchLink: { fontSize: board.subtleControl.fontSize, color: colors.brand.violet },
  group: {
    fontSize: S.group.fontSize, letterSpacing: S.group.tracking, color: S.group.color,
    marginTop: S.group.marginTop, marginBottom: S.group.marginBottom,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.row.gap, minHeight: S.row.minHeight,
    paddingVertical: S.row.paddingY, borderBottomWidth: 1, borderBottomColor: S.row.border,
  },
  rowText: { flex: 1, fontSize: S.row.fontSize, fontWeight: '500', color: colors.brand.plum },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: board.chips.gap, marginTop: board.chips.marginTop - board.h2MarginBottom },
  resultsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: board.inlineGap,
    marginTop: S.resultsHeader.marginTop - S.field.marginBottom, marginBottom: S.resultsHeader.marginBottom,
  },
  h2: { ...board.home.title, flex: 1, color: colors.brand.plum },
  filtersLink: { flexDirection: 'row', alignItems: 'center', gap: board.inlineGap / 2 },
  muted: { ...board.small, color: colors.text.secondary },
  result: {
    flexDirection: 'row', alignItems: 'flex-start', gap: S.result.gap, paddingVertical: S.result.paddingY,
    borderBottomWidth: 1, borderBottomColor: S.row.border,
  },
  photo: { width: S.result.photoWidth, height: S.result.photoHeight, borderRadius: board.photoRadius },
  resultText: { flex: 1 },
  resultTitle: { fontSize: S.result.titleSize, fontWeight: '600', color: colors.brand.plum, marginBottom: S.result.titleMarginBottom },
  line: { fontSize: S.result.lineSize, color: colors.text.secondary, marginBottom: S.result.lineMarginBottom },
  viewLink: { alignSelf: 'flex-start', paddingVertical: board.form.linkPaddingY / 2 },
});
