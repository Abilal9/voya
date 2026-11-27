import * as React from 'react';
import { ImageOff } from 'lucide-react-native';
import { PermissionState } from '@/components/ui/States';
import { BottomSheet } from '@/features/settings/SettingsParts';

/**
 * S05 for photo access: shown when the system says Voya may not read the
 * photo library. "Open Settings" goes to the app's page in iOS Settings.
 */
export function usePhotoAccessSheet() {
  const [visible, setVisible] = React.useState(false);
  const sheet = (
    <BottomSheet visible={visible} onClose={() => setVisible(false)}>
      <PermissionState
        icon={ImageOff}
        title="Photo access is off"
        body="Turn on photo access for Voya in Settings to choose a picture."
        onNotNow={() => setVisible(false)}
      />
    </BottomSheet>
  );
  return { showPhotoAccess: () => setVisible(true), photoAccessSheet: sheet };
}
