import { Linking } from 'react-native';
import Constants from 'expo-constants';

export const SUPPORT_EMAIL = 'support@voya.events';

/** The real app version from app config (not the board's placeholder "1.0"). */
export function appVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

/**
 * Opens a draft to support in the user's mail app. Returns false when no mail
 * app can handle it (e.g. the simulator), so the screen can show the address
 * instead. Nothing is sent by Voya itself.
 */
export async function emailSupport(subject: string): Promise<boolean> {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  try {
    if (!(await Linking.canOpenURL(url))) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
