import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Search as SearchIcon } from 'lucide-react-native';
import { EmptyState, LoadingState, Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { useSavedPlaces } from '@/features/explore/useSavedPlaces';
import { tintFor } from '@/features/hangout/HangoutParts';
import { useHangout } from '@/features/hangout/useHangout';
import { SLOT_CATEGORIES, currentSlot, slotForCategory, slotsFor } from '@/services/hangoutRules';
import type { Place } from '@/services';
import { board, colors, icon } from '@/theme';

const SEG = board.segment;
const TABS = ['Search', 'Explore', 'Saved Places', 'Recent'] as const;
type Tab = (typeof TABS)[number];

/**
 * H06 Suggest a place — Search, Explore picks for this hangout's city, your
 * Saved places, or places from your recent searches. The same shared
 * suggestion list as Explore's Add to Plan.
 */
export default function SuggestPlace() {
  const { id, slot: slotParam } = useLocalSearchParams<{ id: string; slot?: string }>();
  const router = useRouter();
  const h = useHangout(id);
  const saved = useSavedPlaces();
  const hangout = h.hangout;
  const [tab, setTab] = React.useState<Tab>('Explore');
  const [text, setText] = React.useState('');
  const [query, setQuery] = React.useState('');
  const city = hangout?.city;
  const slot = slotParam && hangout && slotsFor(hangout.template).includes(slotParam) ? slotParam : undefined;

  const list = useQuery({
    queryKey: ['suggest', id, tab, query, city, saved.data?.length],
    enabled: !!hangout,
    queryFn: async (): Promise<Place[]> => {
      const svc = h.services.places;
      if (tab === 'Search') return query ? svc.search({ query, city }) : [];
      if (tab === 'Explore') return svc.discover({ city, categories: slot ? SLOT_CATEGORIES[slot] : undefined });
      if (tab === 'Saved Places') return Promise.all((saved.data ?? []).map((s) => svc.getPlace(s.placeId)));
      const terms = await svc.recentSearches();
      const hits = await Promise.all(terms.map((q) => svc.search({ query: q, city })));
      return [...new Map(hits.flat().map((p) => [p.id, p])).values()];
    },
  });

  if (h.isPending) return <Screen><LoadingState /></Screen>;
  if (!hangout) return <Screen><TopBar /><EmptyState title="This hangout isn’t available" /></Screen>;

  const targetSlot = (p: Place) => slot ?? slotForCategory(hangout.template, p.category) ?? currentSlot(hangout)!;
  const already = (p: Place) => hangout.suggestions.some((s) => s.placeId === p.id && s.slot === targetSlot(p));
  const suggest = async (p: Place) => {
    if (already(p)) return;
    const ok = await h.run(() => h.services.hangouts.suggestPlace(hangout.id, p.id, targetSlot(p)));
    if (ok) router.back();
  };

  return (
    <Screen contentStyle={authStyles.screen}>
      <TopBar title={hangout.title} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AuthIntro tight title="Suggest a place" body="A good idea can come from anywhere." />
        <View style={styles.field}>
          <SearchIcon size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
          <TextInput
            value={text} onChangeText={setText} placeholder="Search places" placeholderTextColor={board.field.placeholder}
            onSubmitEditing={() => { setQuery(text.trim()); setTab('Search'); }}
            returnKeyType="search" accessibilityLabel="Search places" style={styles.input}
          />
          <Pressable accessibilityRole="button" onPress={() => { setQuery(text.trim()); setTab('Search'); }} hitSlop={board.inlineGap}>
            <Text style={styles.link}>Search</Text>
          </Pressable>
        </View>
        <View style={styles.seg}>
          {TABS.map((t) => (
            <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: t === tab }} onPress={() => setTab(t)} style={[styles.segItem, t === tab && styles.segOn]}>
              <Text style={[styles.segText, t === tab && styles.segTextOn]} numberOfLines={1}>{t}</Text>
            </Pressable>
          ))}
        </View>
        {list.isPending ? (
          <LoadingState />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState title="Nothing here yet" body={tab === 'Search' ? 'Search for a place by name or kind.' : 'Try another tab.'} />
        ) : (
          (list.data ?? []).map((p) => {
            const done = already(p);
            return (
              <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={done ? `${p.name}, already suggested` : `Suggest ${p.name}`} disabled={done || h.busy} onPress={() => void suggest(p)} style={styles.row}>
                <View style={[styles.thumb, { backgroundColor: tintFor(p) }]} />
                <View style={styles.flex}>
                  <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.small} numberOfLines={1}>{done ? `Already suggested for ${targetSlot(p).toLowerCase()}` : [p.type, p.city].filter(Boolean).join(' · ')}</Text>
                </View>
                {done ? <Check size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} /> : <ChevronRight size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />}
              </Pressable>
            );
          })
        )}
        {h.error ? <Text style={styles.error}>{h.error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: board.search.field.gap, padding: board.search.field.padding,
    borderRadius: board.search.field.radius, backgroundColor: board.search.field.background, minHeight: board.search.field.minHeight,
    marginTop: board.search.field.marginTop - board.form.fieldsMarginTop,
  },
  input: { flex: 1, fontSize: board.search.field.fontSize, color: colors.brand.plum, padding: 0 },
  link: { fontSize: board.subtleControl.fontSize, color: colors.brand.violet },
  seg: { flexDirection: 'row', gap: SEG.gap, padding: SEG.padding, borderRadius: SEG.radius, backgroundColor: SEG.background, marginTop: SEG.marginTop, marginBottom: SEG.marginBottom },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: SEG.itemPaddingY, borderRadius: SEG.itemRadius },
  segOn: { backgroundColor: colors.surface.base },
  segText: { fontSize: SEG.fontSize - 1, color: colors.brand.plum },
  segTextOn: { color: colors.brand.violet, fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: board.listRow.gap, paddingVertical: board.listRow.paddingY,
    borderBottomWidth: 1, borderBottomColor: board.listRow.borderColor,
  },
  thumb: { width: board.thumb.width, height: board.thumb.height, borderRadius: board.thumb.radius },
  name: { fontSize: board.home.rowTitle.fontSize, fontWeight: '700', color: colors.brand.plum, marginBottom: board.home.rowTitle.marginBottom },
  small: { ...board.small, color: colors.text.secondary },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
});
