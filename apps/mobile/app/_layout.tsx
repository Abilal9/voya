import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServicesProvider } from '@/services/ServicesProvider';
import { useSession } from '@/stores/session';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

/**
 * Sends the user to the right place from the account's actual state.
 * A returning, fully onboarded user never sees onboarding again.
 */
function useProtectedRoute() {
  const status = useSession((s) => s.status);
  const step = useSession((s) => s.account?.onboardingStep);
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'booting') return;
    const group = segments[0];
    const inAuth = group === '(auth)';
    const inOnboarding = group === '(onboarding)';
    const onVerify = inAuth && segments[1] === 'verify';

    if (status === 'signed-out' && !inAuth) {
      router.replace('/(auth)/welcome');
    } else if (status === 'verifying' && !onVerify) {
      router.replace('/(auth)/verify');
    } else if (status === 'onboarding' && !inOnboarding) {
      // Resume where the account left off.
      const resume = step && step !== 'done' ? step : 'profile';
      router.replace(`/(onboarding)/${resume}`);
    } else if (status === 'ready' && (inAuth || inOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [status, step, segments, router]);
}

function RootNavigator() {
  const status = useSession((s) => s.status);
  const boot = useSession((s) => s.boot);

  React.useEffect(() => {
    void boot();
  }, [boot]);

  React.useEffect(() => {
    if (status !== 'booting') void SplashScreen.hideAsync();
  }, [status]);

  useProtectedRoute();

  if (status === 'booting') {
    return <View style={styles.boot} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface.base } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create" />
      <Stack.Screen name="past-plans" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="search" />
      <Stack.Screen name="location" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="interests" />
      <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
      <Stack.Screen name="add-to-plan/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="place/[id]" />
      <Stack.Screen name="hangout/new" />
      <Stack.Screen name="event/new" />
      <Stack.Screen name="event/[id]/index" />
      <Stack.Screen name="event/[id]/invitation" />
      <Stack.Screen name="hangout/[id]/index" />
      <Stack.Screen name="hangout/[id]/change" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: false }} />
      <Stack.Screen name="dev" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ServicesProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </ServicesProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  boot: { flex: 1, backgroundColor: colors.surface.base },
});
