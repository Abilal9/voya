import * as React from 'react';
import { useRouter } from 'expo-router';
import { SetPasswordForm } from '@/features/auth/SetPasswordForm';

/** A11 Set new password, reached from the reset link (A05 → Preview reset link). */
export default function SetPassword() {
  const router = useRouter();
  return <SetPasswordForm title="Password reset" onDone={() => router.replace('/(auth)/password-updated')} />;
}
