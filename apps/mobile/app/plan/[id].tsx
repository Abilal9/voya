import { ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { headcountLabel } from '@/services/planRules';
import { useServices } from '@/services/ServicesProvider';
import type { TimelineItem, Trip, VoyaEvent } from '@/services';
import { spacing } from '@/theme';

function timeOf(item: TimelineItem) {
  return new Date(item.startsAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** One timeline renderer, three variants — see docs/frontend-screen-inventory.md. */
function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <View style={styles.timeline}>
      {items.map((item) => (
        <Card key={item.id} tone="flat">
          <View style={styles.item}>
            <Text variant="footnote" tone="violet" style={styles.time}>{timeOf(item)}</Text>
            <View style={styles.itemBody}>
              <Text variant="subtitle">{item.title}</Text>
              {item.subtitle ? (
                <Text variant="footnote" tone="secondary">{item.subtitle}</Text>
              ) : null}
              {item.travelMinutes ? (
                <Text variant="caption" tone="tertiary">{`${item.travelMinutes} min travel`}</Text>
              ) : null}
            </View>
            {item.locked ? <Text variant="caption" tone="tertiary">Locked</Text> : null}
          </View>
        </Card>
      ))}
    </View>
  );
}

export default function PlanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const services = useServices();
  const plan = useQuery({ queryKey: ['plan', id], queryFn: () => services.plans.get(id!) });

  if (plan.isPending) return <Screen><LoadingState /></Screen>;
  if (plan.isError || !plan.data) {
    return <Screen><ErrorState onRetry={() => void plan.refetch()} /></Screen>;
  }

  const p = plan.data;
  if (p.type === 'hangout') return <Redirect href={`/hangout/${p.id}`} />;
  const items: TimelineItem[] =
    p.type === 'trip'
      ? (p as Trip).days.flatMap((d) => d.items)
      : (p as VoyaEvent).schedule.filter((i) => i.visibility !== 'hosts_only');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text variant="overline" tone="tertiary">{p.type.toUpperCase()}</Text>
          <Text variant="h1">{p.title}</Text>
          <Text variant="footnote" tone="secondary">
            {`${p.city} · ${headcountLabel(p)}`}
          </Text>
        </View>

        {items.length === 0 ? (
          <Card tone="accent">
            <Text variant="title">Nothing scheduled yet</Text>
            <Text variant="footnote" tone="secondary">
              This plan has no timeline. The full flows arrive in Phases 5–7.
            </Text>
          </Card>
        ) : (
          <Timeline items={items} />
        )}

        <Button label="Back" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  head: { gap: 2 },
  timeline: { gap: spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { width: 54 },
  itemBody: { flex: 1, gap: 2 },
});
