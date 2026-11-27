import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { board, colors } from '@/theme';
import { Text } from './Text';

const F = board.feedback;
const ToastContext = React.createContext<(message: string) => void>(() => {});

/**
 * S08 Success toast: a short plum bar near the bottom. Callers show it only
 * after the service confirmed the change. A new toast replaces the current
 * one, so repeated taps never stack.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = React.useCallback((m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(m);
    timer.current = setTimeout(() => setMessage(null), F.toastDuration);
  }, []);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <View pointerEvents="none" style={[styles.toast, { bottom: insets.bottom + F.toastBottom }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={styles.text}>{message}</Text>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => React.useContext(ToastContext);

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', left: board.screenPaddingX, right: board.screenPaddingX, padding: F.toastPadding,
    borderRadius: F.toastRadius, backgroundColor: colors.brand.plum,
  },
  text: { fontSize: F.toastFontSize, color: colors.surface.base, textAlign: 'center' },
});
