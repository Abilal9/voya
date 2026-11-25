import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { spacing } from '@/theme';

/** E08 Place details. */
export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const services = useServices();
  const qc = useQueryClient();

  const place = useQuery({ queryKey: ['place', id], queryFn: () => services.places.getPlace(id!) });
  const isSaved = useQuery({
    queryKey: ['saved', 'is', id],
    queryFn: () => services.saved.isSaved(id!),
  });

  const toggle = async () => {
    if (isSaved.data) await services.saved.unsave(id!);
    else await services.saved.save(id!);
    void qc.invalidateQueries({ queryKey: ['saved'] });
  };

  if (place.isPending) return <Screen><LoadingState /></Screen>;
  if (place.isError || !place.data) {
    return <Screen><ErrorState onRetry={() => void place.refetch()} /></Screen>;
  }

  const p = place.data;
  return (
    <Screen scroll>
      <View style={styles.head}>
        <Text variant="h1">{p.name}</Text>
        {p.type ? <Text variant="body" tone="secondary">{p.type}</Text> : null}
      </View>

      <View style={styles.facts}>
        <Text variant="body">
          {p.rating !== undefined ? `${p.rating.toFixed(1)} ★` : 'No rating available'}
          {p.price ? ` · ${p.price}` : ''}
        </Text>
        <Text variant="body" tone="secondary">
          {[p.area, p.city].filter(Boolean).join(', ')}
        </Text>
        <Text variant="footnote" tone="tertiary">
          {p.permanentlyClosed
            ? 'Permanently closed'
            : p.openNow === undefined
              ? 'Opening hours unknown'
              : p.openNow
                ? 'Open now'
                : 'Closed right now'}
        </Text>
        {p.reason ? <Text variant="footnote" tone="violet">{p.reason}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Button
          label={isSaved.data ? 'Remove from Saved' : 'Save this place'}
          variant={isSaved.data ? 'secondary' : 'primary'}
          onPress={toggle}
        />
        <Button label="Close" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: spacing.lg, gap: spacing.xxs },
  facts: { paddingVertical: spacing.lg, gap: spacing.xxs },
  actions: { gap: spacing.xs, marginTop: spacing.lg },
});
