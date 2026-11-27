import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Screen, Text } from '@/components/ui';
import { simulation, resetAll, resetWorld, setCurrentAccountId } from '@/mocks';
import { people } from '@/mocks/fixtures';
import { useSession } from '@/stores/session';
import { spacing } from '@/theme';

/**
 * Development-only scenario menu. Compiled out of production builds via __DEV__.
 * Never ships: see docs/frontend-integration-notes.md.
 */
export default function DevMenu() {
  const router = useRouter();
  const qc = useQueryClient();
  const boot = useSession((s) => s.boot);
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  // Simulator scripting by deep link: `/dev?reseed=plans` reseeds the shared plans;
  // `/dev?as=p-khaled&to=/event/plan-wedding` switches to a seeded account (or back
  // to `dev-ahmad`) and opens a route. Neither changes any plan.
  const { reseed, as, to } = useLocalSearchParams<{ reseed?: string; as?: string; to?: string }>();
  const reseedPlans = React.useCallback(async () => {
    await resetWorld();
    qc.clear();
    router.replace('/(tabs)');
  }, [qc, router]);
  React.useEffect(() => {
    if (__DEV__ && reseed === 'plans') void reseedPlans();
  }, [reseed, reseedPlans]);
  React.useEffect(() => {
    if (!__DEV__ || !as || !(as === 'dev-ahmad' || people.some((p) => p.id === as))) return;
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
