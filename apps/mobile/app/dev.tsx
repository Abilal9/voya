import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Screen, Text } from '@/components/ui';
import { simulation, resetAll, resetWorld, setCurrentAccountId } from '@/mocks';
import { people } from '@/mocks/fixtures';
import { setTestClock } from '@/features/trip/devClock';
import { runtimeConfig } from '@/config/runtime';
import { useSession } from '@/stores/session';
import { spacing } from '@/theme';

/**
 * Development-only scenario menu. Compiled out of production builds via __DEV__.
 * Never ships: see docs/frontend-integration-notes.md.
 */
/** Real Supabase auth: a real identity must never be swapped for a seeded mock one. */
const CAN_SWITCH_USERS = runtimeConfig.authProvider === 'mock';

export default function DevMenu() {
  const router = useRouter();
  const qc = useQueryClient();
  const boot = useSession((s) => s.boot);
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  // Simulator scripting by deep link: `/dev?reseed=plans` reseeds the shared plans;
  // `/dev?as=p-khaled&to=/event/plan-wedding` switches to a seeded account (or back
  // to `dev-ahmad`) and opens a route. Neither changes any plan.
  // `/dev?clock=2026-12-16T11:00&to=/trip/plan-florence/today` sets an in-memory test clock for Today.
  // `/dev?offline=on|off`, `/dev?fail=next`, `/dev?latency=3000` drive the simulated states (S01, S03, S04).
  const { reseed, as, to, clock, offline, fail, latency } = useLocalSearchParams<{
    reseed?: string; as?: string; to?: string; clock?: string; offline?: string; fail?: string; latency?: string;
  }>();
  React.useEffect(() => {
    if (!__DEV__ || (offline === undefined && fail === undefined && latency === undefined)) return;
    if (offline !== undefined) simulation.offline = offline === 'on';
    if (fail === 'next') simulation.failNext = true;
    if (latency !== undefined && /^\d{1,5}$/.test(latency)) simulation.latencyMs = Number(latency);
    qc.clear();
    if (!as && clock === undefined) router.replace((to?.startsWith('/') ? to : '/(tabs)') as never);
  }, [offline, fail, latency, as, clock, to, qc, router]);
  React.useEffect(() => {
    if (!__DEV__ || clock === undefined) return;
    setTestClock(clock === 'off' ? null : clock);
    if (!as) router.replace((to?.startsWith('/') ? to : '/(tabs)') as never);
  }, [clock, as, to, router]);
  const reseedPlans = React.useCallback(async () => {
    await resetWorld();
    qc.clear();
    router.replace('/(tabs)');
  }, [qc, router]);
  React.useEffect(() => {
    if (__DEV__ && reseed === 'plans') void reseedPlans();
  }, [reseed, reseedPlans]);
  React.useEffect(() => {
    if (!__DEV__ || !CAN_SWITCH_USERS || !as || !(as === 'dev-ahmad' || people.some((p) => p.id === as))) return;
    void (async () => {
      await setCurrentAccountId(as);
      qc.clear();
      await boot();
      router.replace((to?.startsWith('/') ? to : '/(tabs)') as never);
    })();
  }, [as, to, qc, boot, router]);

  if (!__DEV__) {
    return (
      <Screen>
        <Text variant="body">Not available in this build.</Text>
      </Screen>
    );
  }

  const switchTo = async (id: string) => {
    await setCurrentAccountId(id);
    qc.clear();
    await boot();
    router.replace('/(tabs)');
  };

  const reset = async () => {
    await resetAll();
    qc.clear();
    await boot();
    router.replace('/(auth)/welcome');
  };

  const toggle = (key: 'offline' | 'failNext' | 'emptyResults') => {
    simulation[key] = !simulation[key];
    force();
  };

  return (
    <Screen scroll>
      <Text variant="h1" style={styles.title}>Developer menu</Text>

      <Card>
        <Text variant="overline" tone="tertiary">SWITCH SEEDED USER</Text>
        {CAN_SWITCH_USERS ? (
          <View style={styles.group}>
            {people.map((p) => (
              <Button
                key={p.id}
                label={p.displayName}
                variant="secondary"
                onPress={() => void switchTo(p.id)}
              />
            ))}
          </View>
        ) : (
          <Text variant="body" tone="secondary">
            Real sign-in is on (EXPO_PUBLIC_VOYA_AUTH=supabase). Seeded users are mock identities and are not available.
          </Text>
        )}
      </Card>

      <Card>
        <Text variant="overline" tone="tertiary">SIMULATE</Text>
        <View style={styles.group}>
          <Button
            label={`Offline: ${simulation.offline ? 'on' : 'off'}`}
            variant="secondary" onPress={() => toggle('offline')}
          />
          <Button
            label={`Fail next request: ${simulation.failNext ? 'armed' : 'off'}`}
            variant="secondary" onPress={() => toggle('failNext')}
          />
          <Button
            label={`Latency: ${simulation.latencyMs}ms`}
            variant="secondary"
            onPress={() => {
              simulation.latencyMs = simulation.latencyMs === 250 ? 1200 : 250;
              force();
            }}
          />
        </View>
      </Card>

      <Card>
        <Text variant="overline" tone="tertiary">DATA</Text>
        <View style={styles.group}>
          <Button label="Reseed shared plans" variant="secondary" onPress={() => void reseedPlans()} />
          <Button label="Reset all mock data" variant="danger" onPress={() => void reset()} />
        </View>
      </Card>

      <Button label="Close" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  group: { gap: spacing.xs, marginTop: spacing.xs },
});
