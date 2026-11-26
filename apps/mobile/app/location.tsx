import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Crosshair, Globe, MapPin, Search as SearchIcon, type LucideIcon } from 'lucide-react-native';
import { Screen, Text, TopBar } from '@/components/ui';
import { AuthIntro, authStyles } from '@/features/auth/AuthParts';
import { useExploreCity } from '@/features/explore/useExploreCity';
import { useServices } from '@/services/ServicesProvider';
import { board, colors, icon } from '@/theme';

const L = board.location;

function Row({ Icon, title, subtitle, onPress, selected }: {
  Icon: LucideIcon; title: string; subtitle: string; onPress: () => void; selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.symbol}>
        <Icon size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.small}>{subtitle}</Text>
      </View>
      <ChevronRight size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
    </Pressable>
  );
}

/**
 * E02 Location selection — board figure "E02". "Near me" is mocked: no device
 * location is read; it returns Explore to the account's home city. Choosing a
 * city changes the places Explore, Search and Filters work with.
 */
export default function Location() {
  const router = useRouter();
  const services = useServices();
  const { homeCity, city, isNearMe, choose } = useExploreCity();
  const destinations = useQuery({ queryKey: ['catalog', 'destinations'], queryFn: () => services.catalog.destinations() });
  const dream = useQuery({ queryKey: ['catalog', 'dream'], queryFn: () => services.catalog.dreamDestinations() });
  const recent = useQuery({ queryKey: ['locations', 'recent'], queryFn: () => services.places.recentCities() });
  const [query, setQuery] = React.useState('');

  const countryOf = (c: string) => destinations.data?.find((d) => d.city === c)?.country ?? '';
  const pick = async (c: string | null) => {
    await choose(c);
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/explore');
  };

  const q = query.trim().toLowerCase();
  const matches = q
    ? (destinations.data ?? []).filter((d) => `${d.city} ${d.country}`.toLowerCase().includes(q))
    : [];

  return (
    <Screen contentStyle={authStyles.screen}>
      <TopBar title="Explore" />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AuthIntro tight title={'Where do you\nwant to explore?'} />
        <Text style={[styles.small, styles.introGap]}>Somewhere nearby. Somewhere new.</Text>

        <Row
          Icon={Crosshair}
          title="Near me"
          subtitle={`${homeCity ?? ''} · Use my current area`}
          selected={isNearMe}
          onPress={() => void pick(null)}
        />

        <View style={styles.field}>
          <SearchIcon size={icon.md} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search cities or areas"
            placeholderTextColor={board.field.placeholder}
            accessibilityLabel="Search cities or areas"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        {q ? (
          <>
            <Text style={styles.eyebrow}>CITIES</Text>
            {matches.length === 0 ? (
              <Text style={styles.small}>No city matches that yet.</Text>
            ) : (
              matches.map((d) => (
                <Row key={d.city} Icon={MapPin} title={d.city} subtitle={d.country} selected={d.city === city} onPress={() => void pick(d.city)} />
              ))
            )}
          </>
        ) : (
          <>
            {(recent.data ?? []).length > 0 ? <Text style={styles.eyebrow}>RECENT DESTINATIONS</Text> : null}
            {(recent.data ?? []).map((c) => (
              <Row key={c} Icon={MapPin} title={c} subtitle={countryOf(c)} selected={c === city} onPress={() => void pick(c)} />
            ))}
            <Text style={[styles.eyebrow, styles.dreamEyebrow]}>SOMEWHERE TO DREAM ABOUT</Text>
            {(dream.data ?? []).map((d) => (
              <Row key={d.city} Icon={Globe} title={d.city} subtitle={d.country} selected={d.city === city} onPress={() => void pick(d.city)} />
            ))}
          </>
        )}
        <View style={styles.spacer} />
        <Text style={styles.tiny}>Your preferences come with you.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: board.listRow.paddingY },
  small: { ...board.small, color: colors.text.secondary },
  introGap: { marginTop: -board.h2MarginBottom },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: L.row.gap, paddingVertical: L.row.paddingY,
    minHeight: L.row.minHeight, borderBottomWidth: 1, borderBottomColor: L.row.border,
  },
  symbol: {
    width: L.row.symbol, height: L.row.symbol, borderRadius: board.create.symbol.radius,
    backgroundColor: L.row.symbolBackground, alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: L.row.titleSize, fontWeight: '700', color: colors.brand.plum, marginBottom: L.row.titleMarginBottom },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: board.search.field.gap, padding: board.search.field.padding,
    borderRadius: board.search.field.radius, backgroundColor: board.search.field.background,
    minHeight: board.search.field.minHeight, marginTop: board.search.field.marginTop, marginBottom: board.search.field.marginBottom,
  },
  input: { flex: 1, fontSize: board.search.field.fontSize, color: colors.brand.plum, padding: 0 },
  eyebrow: { ...board.home.eyebrow, color: colors.brand.violet },
  dreamEyebrow: { marginTop: L.dreamMarginTop },
  spacer: { flex: 1, minHeight: board.listRow.paddingY },
  tiny: { ...board.tinyCenter, textAlign: 'center', marginTop: board.listRow.paddingY },
});
