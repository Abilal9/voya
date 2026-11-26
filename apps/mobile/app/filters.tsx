import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text } from '@/components/ui';
import { useCategories } from '@/features/catalog';
import {
  DISTANCE_OPTIONS, EMPTY_FILTERS, PRICE_OPTIONS, RATING_OPTIONS, TAG_OPTIONS,
  toggle, useExploreFilters, type ExploreFilters,
} from '@/features/explore/filters';
import type { PlaceCategory } from '@/services';
import { board, colors } from '@/theme';

const F = board.filters;

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

/**
 * E07 Filters sheet — board figure "E07". Edits a draft; "Show places"
 * applies it and closes, swiping the sheet away discards it.
 */
export default function Filters() {
  const router = useRouter();
  const categories = useCategories();
  const applied = useExploreFilters((s) => s.filters);
  const setFilters = useExploreFilters((s) => s.setFilters);
  const [draft, setDraft] = React.useState<ExploreFilters>(applied);
  const patch = (p: Partial<ExploreFilters>) => setDraft((d) => ({ ...d, ...p }));

  const apply = () => {
    setFilters(draft);
    router.back();
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text style={styles.h1}>Filters</Text>
        <Pressable accessibilityRole="button" onPress={() => setDraft(EMPTY_FILTERS)} hitSlop={board.inlineGap}>
          <Text style={styles.clear}>Clear all</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Section title="Category">
          {(categories.data ?? []).map((c) => (
            <Option
              key={c} label={c} selected={draft.categories.includes(c)}
              onPress={() => patch({ categories: toggle<PlaceCategory>(draft.categories, c) })}
            />
          ))}
        </Section>
        <Section title="Price">
          {PRICE_OPTIONS.map((p) => (
            <Option key={p} label={p} selected={draft.prices.includes(p)} onPress={() => patch({ prices: toggle(draft.prices, p) })} />
          ))}
        </Section>
        <Section title="Distance">
          {DISTANCE_OPTIONS.map((d) => (
            <Option key={d} label={d} selected={draft.distance === d} onPress={() => patch({ distance: d })} />
          ))}
        </Section>
        <Section title="Rating">
          {RATING_OPTIONS.map((r) => (
            <Option
              key={r} label={r} selected={draft.rating === r}
              onPress={() => patch({ rating: draft.rating === r ? undefined : r })}
            />
          ))}
        </Section>
        <View style={[styles.section, styles.row]}>
          <Text style={[styles.sectionTitle, styles.noMargin]}>Open now</Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Open now"
            accessibilityState={{ checked: draft.openNow }}
            onPress={() => patch({ openNow: !draft.openNow })}
            style={[styles.switch, draft.openNow && styles.switchOn]}
          >
            <View style={[styles.knob, draft.openNow && styles.knobOn]} />
          </Pressable>
        </View>
        <Section title="A little more you">
          {TAG_OPTIONS.map((t) => (
            <Option key={t} label={t} selected={draft.tags.includes(t)} onPress={() => patch({ tags: toggle(draft.tags, t) })} />
          ))}
        </Section>
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Show places" onPress={apply} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base, paddingHorizontal: F.paddingX },
  handle: {
    width: F.handle.width, height: F.handle.height, borderRadius: F.handle.radius, backgroundColor: F.handle.color,
    alignSelf: 'center', marginTop: F.handle.marginTop, marginBottom: F.handle.marginBottom,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: F.headerMarginBottom },
  h1: { ...board.h1, marginBottom: 0, color: colors.brand.plum },
  clear: { fontSize: board.subtleControl.fontSize, color: colors.brand.violet },
  body: { paddingBottom: F.sectionMarginBottom },
  section: { marginBottom: F.sectionMarginBottom },
  sectionTitle: { fontSize: F.titleSize, fontWeight: '600', color: colors.brand.plum, marginBottom: F.titleMarginBottom },
  noMargin: { marginBottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: F.option.gap },
  option: {
    minHeight: F.option.minHeight, justifyContent: 'center', borderWidth: 1, borderColor: F.option.border,
    borderRadius: F.option.radius, paddingVertical: F.option.paddingY, paddingHorizontal: F.option.paddingX,
  },
  optionSelected: { backgroundColor: F.option.selectedBackground, borderColor: colors.brand.lavender },
  optionText: { fontSize: F.option.fontSize, color: colors.brand.plum },
  optionTextSelected: { color: colors.brand.violet },
  switch: {
    width: F.switch.width, height: F.switch.height, borderRadius: F.switch.height / 2,
    backgroundColor: F.switch.off, justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.brand.violet },
  knob: {
    width: F.switch.knob, height: F.switch.knob, borderRadius: F.switch.knob / 2,
    backgroundColor: colors.surface.base, marginLeft: F.switch.inset,
  },
  knobOn: { marginLeft: F.switch.width - F.switch.knob - F.switch.inset },
  footer: { paddingTop: board.listRow.paddingY + 1, paddingBottom: board.listRow.paddingY },
});
