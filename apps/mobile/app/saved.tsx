import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react-native';
import {
  Card, EmptyState, IconButton, LoadingState, Screen, Text,
} from '@/components/ui';
import { useServices } from '@/services/ServicesProvider';
import { colors, icon, spacing } from '@/theme';

/** 39 Saved Places. */
export default function Saved() {
  const router = useRouter();
  const services = useServices();
  const qc = useQueryClient();

  const saved = useQuery({ queryKey: ['saved'], queryFn: () => services.saved.list() });
  const places = useQuery({
    queryKey: ['saved', 'hydrated', saved.data?.length],
    enabled: !!saved.data,
    queryFn: async () =>
      Promise.all((saved.data ?? []).map((s) => services.places.getPlace(s.placeId))),
  });

  const remove = async (id: string) => {
    await services.saved.unsave(id);
    void qc.invalidateQueries({ queryKey: ['saved'] });
  };

  return (
    <Screen>
      <Text variant="h1" style={styles.title}>Saved</Text>
      {saved.isPending || places.isPending ? (
        <LoadingState />
      ) : (places.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          body="Swipe right on a place in Explore and it lands here."
          actionLabel="Open Explore"
          onAction={() => router.replace('/(tabs)/explore')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {(places.data ?? []).map((p) => (
            <Card key={p.id}>
              <View style={styles.row}>
                <View style={styles.text}>
                  <Text variant="title" numberOfLines={1}>{p.name}</Text>
                  <Text variant="footnote" tone="secondary" numberOfLines={1}>
                    {[p.type, p.area, p.city].filter(Boolean).join(' · ')}
                  </Text>
                  {p.rating === undefined ? (
                    <Text variant="caption" tone="tertiary">No rating yet</Text>
                  ) : null}
                </View>
                <IconButton label={`Remove ${p.name}`} onPress={() => void remove(p.id)}>
                  <Trash2 size={icon.md} color={colors.status.danger} strokeWidth={icon.strokeWidth} />
                </IconButton>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1, gap: 2 },
});
