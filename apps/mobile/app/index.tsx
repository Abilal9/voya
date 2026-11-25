import { Redirect } from 'expo-router';

/** Root redirect. The real decision happens in _layout's useProtectedRoute. */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
