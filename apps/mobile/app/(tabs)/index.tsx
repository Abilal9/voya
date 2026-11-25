import * as React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VoyaLogo } from '@/components/brand';
import {
  Card, EmptyState, ErrorState, IconButton, LoadingState, Text,
} from '@/components/ui';
import { PlanCard } from '@/features/home/PlanCard';
import { useServices } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { colors, icon, layout, spacing } from '@/theme';

/** 01 Home. */
export default function Home() {
  const router = useRouter();
  const services = useServices();
  const account = useSession((s) => s.account);

  const plans = useQuery({ queryKey: ['plans', 'upcoming'], queryFn: () => services.plans.listUpcoming() });
  const unread = useQuery({ queryKey: ['activity', 'unread'], queryFn: () => services.notifications.unreadCount() });

  const upNext = plans.data?.[0];
  const rest = plans.data?.slice(1) ?? [];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <View style={styles.header}>
        <VoyaLogo width={96} />
        <IconButton label="Activity" onPress={() => router.push('/(tabs)/profile')}>
          <Bell size={icon.lg} color={colors.text.primary} strokeWidth={icon.strokeWidth} />
          {(unread.data ?? 0) > 0 ? <View style={styles.dot} /> : null}
        </IconButton>
      </View>

      {plans.isPending ? (
        <LoadingState label="Loading your plans" />
      ) : plans.isError ? (
        <ErrorState onRetry={() => void plans.refetch()} />
      ) : (plans.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="Nothing planned yet"
          body="Create a trip, hangout or event and it will show up here."
          actionLabel="Create a plan"
          onAction={() => router.push('/create')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={plans.isRefetching} onRefresh={() => void plans.refetch()} />
          }
        >
          <Text variant="h1" style={styles.greeting}>
            {`Hi ${account?.firstName ?? 'there'}`}
          </Text>

          {upNext ? (
            <View style={styles.section}>
              <Text variant="overline" tone="tertiary">UP NEXT</Text>
              <PlanCard plan={upNext} onPress={() => router.push(`/plan/${upNext.id}`)} />
            </View>
          ) : null}

          {rest.length > 0 ? (
            <View style={styles.section}>
              <Text variant="overline" tone="tertiary">UPCOMING</Text>
              <View style={styles.list}>
                {rest.map((p) => (
                  <PlanCard key={p.id} plan={p} onPress={() => router.push(`/plan/${p.id}`)} />
                ))}
              </View>
            </View>
          ) : null}

          <Card tone="accent" onPress={() => router.push('/(tabs)/explore')}>
            <Text variant="title">Find somewhere new</Text>
            <Text variant="footnote" tone="secondary">
              Swipe through places picked for your interests.
            </Text>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding, paddingVertical: spacing.xs,
  },
  dot: {
    position: 'absolute', top: 10, right: 10, width: 8, height: 8,
    borderRadius: 4, backgroundColor: colors.brand.peach,
  },
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: 140, gap: spacing.lg },
  greeting: { marginTop: spacing.xs },
  section: { gap: spacing.xs },
  list: { gap: spacing.sm },
});
