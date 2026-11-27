import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Plane, Plus, Users } from 'lucide-react-native';
import { Button, EmptyState, ErrorState, LoadingState, Text } from '@/components/ui';
import { PLAN_LABEL, shortWhen } from '@/features/home/planFormat';
import { useServices } from '@/services/ServicesProvider';
import type { Plan } from '@/services';
import { board, colors, icon } from '@/theme';

const A = board.addToPlan;

function planMeta(plan: Plan) {
  const when = shortWhen(plan).split(' · ')[0];
  return [PLAN_LABEL[plan.type], when, plan.type === 'hangout' ? plan.city : undefined].filter(Boolean).join(' · ');
}

/**
 * E09 Add place to Plan — board figure "E09". Lists upcoming hangouts and trips
 * the user can add to; the place becomes a hangout suggestion or a trip Must Do.
 * The row turns into a check once added, so nothing is added twice.
 */
export default function AddToPlan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const services = useServices();
  const qc = useQueryClient();
  const place = useQuery({ queryKey: ['place', id], queryFn: () => services.places.getPlace(id!), enabled: !!id });
  const targets = useQuery({ queryKey: ['add-targets', id], queryFn: () => services.plans.addTargets(id!), enabled: !!id });
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | undefined>();

  const add = async (plan: Plan) => {
    setError(undefined);
    setBusy(plan.id);
    try {
      await services.plans.addPlace(plan.id, id!);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['add-targets', id] }),
        qc.invalidateQueries({ queryKey: ['plan', plan.id] }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the place.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <View style={styles.handle} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Add to a Plan</Text>
        <Text style={styles.muted} numberOfLines={1}>
          {place.data ? `${place.data.name} · Bring a good idea along.` : 'Bring a good idea along.'}
        </Text>

        {targets.isPending ? (
          <LoadingState label="Finding your plans" />
        ) : targets.isError ? (
          <ErrorState onRetry={() => void targets.refetch()} error={targets.error} />
        ) : (targets.data ?? []).length === 0 ? (
          <EmptyState title="No plans to add to yet" body="Create a hangout or trip and add this place to it." />
        ) : (
          <>
            <Text style={styles.eyebrow}>UPCOMING PLANS</Text>
            {(targets.data ?? []).map(({ plan, alreadyAdded }) => {
              const Icon = plan.type === 'trip' ? Plane : Users;
              return (
                <Pressable
                  key={plan.id}
                  accessibilityRole="button"
                  accessibilityLabel={alreadyAdded ? `${plan.title}, added` : `Add to ${plan.title}`}
                  accessibilityState={{ disabled: alreadyAdded, busy: busy === plan.id }}
                  disabled={alreadyAdded || !!busy}
                  onPress={() => void add(plan)}
                  style={styles.pick}
                >
                  <View style={styles.symbol}>
                    <Icon size={board.create.symbol.icon} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
                  </View>
                  <View style={styles.pickText}>
                    <Text style={styles.pickTitle} numberOfLines={1}>{plan.title}</Text>
                    <Text style={styles.muted}>{alreadyAdded ? 'Added' : planMeta(plan)}</Text>
                  </View>
                  {alreadyAdded ? (
                    <Check size={icon.lg} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />
                  ) : (
                    <Plus size={icon.lg} color={colors.brand.plum} strokeWidth={icon.strokeWidth} />
                  )}
                </Pressable>
              );
            })}
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.note}>Places are added as suggestions for your group.</Text>
        <Button
          label="Create a new Plan"
          variant="secondary"
          icon={<Plus size={icon.md} color={colors.brand.violet} strokeWidth={icon.strokeWidth} />}
          onPress={() => router.push('/create')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base, paddingHorizontal: board.screenPaddingX },
  handle: {
    width: board.filters.handle.width, height: board.filters.handle.height, borderRadius: board.filters.handle.radius,
    backgroundColor: board.filters.handle.color, alignSelf: 'center', marginTop: A.paddingTop, marginBottom: board.filters.handle.marginBottom,
  },
  h1: { ...board.h1, fontSize: A.titleSize, color: colors.brand.plum },
  muted: { ...board.small, color: colors.text.secondary },
  eyebrow: { ...board.home.eyebrow, color: colors.brand.violet, marginTop: A.eyebrowMarginTop },
  pick: {
    flexDirection: 'row', alignItems: 'center', gap: A.pick.gap, paddingVertical: A.pick.paddingY,
    borderBottomWidth: 1, borderBottomColor: A.pick.border,
  },
  symbol: {
    width: board.create.symbol.size, height: board.create.symbol.size, borderRadius: board.create.symbol.radius,
    backgroundColor: board.create.symbol.background, alignItems: 'center', justifyContent: 'center',
  },
  pickText: { flex: 1 },
  pickTitle: { fontSize: A.pick.titleSize, fontWeight: '600', color: colors.brand.plum, marginBottom: A.pick.titleMarginBottom },
  error: { ...board.small, color: colors.status.danger, marginTop: board.inlineGap },
  note: { fontSize: board.explore.note.fontSize, color: board.explore.note.color, marginTop: A.noteMarginTop, marginBottom: board.inlineGap },
});
