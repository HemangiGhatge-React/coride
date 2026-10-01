import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import type { VippsLoginErrorCode, VippsLoginResult } from '../auth/vippsLogin';

type Notice = { tone: 'info' | 'error'; text: string };

const CANCELLED: Notice = { tone: 'info', text: 'Vipps login was cancelled. Tap the button to try again.' };
const UNKNOWN_ERROR: Notice = { tone: 'error', text: 'Something went wrong. Please try again.' };
const ERROR_TEXT: Record<VippsLoginErrorCode, string> = {
  vipps_error: "Vipps couldn't complete the login. Please try again.",
  email_conflict: 'The email on your Vipps profile already belongs to another CoRide account.',
  expired: 'The login took too long and expired. Please try again.',
  network: "Can't reach CoRide. Check your internet connection and try again.",
  not_configured: "Vipps login isn't available right now.",
};

function noticeFor(result: VippsLoginResult): Notice | null {
  if (result.type === 'success') return null;
  if (result.type === 'cancelled') return CANCELLED;
  return { tone: 'error', text: ERROR_TEXT[result.code] };
}

export default function Login() {
  const { state, signInWithVipps } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(
    state.status === 'signedOut' && state.reason === 'expired'
      ? { tone: 'info', text: 'Your session has expired. Please log in again.' }
      : null,
  );

  const onPress = async () => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice(noticeFor(await signInWithVipps()));
    } catch {
      setNotice(UNKNOWN_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Welcome to CoRide</Text>
      <Text style={styles.subheading}>Log in with Vipps to find and share rides.</Text>

      {notice && (
        <View style={[styles.notice, notice.tone === 'error' ? styles.noticeError : styles.noticeInfo]}>
          <Text style={styles.noticeText}>{notice.text}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.vippsButton, busy && styles.vippsButtonBusy]}
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Log in with Vipps"
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.vippsButtonText}>Log in with Vipps</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9', paddingHorizontal: 28, paddingTop: 120 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 12 },
  subheading: { fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 32 },
  notice: { borderRadius: 12, padding: 14, marginBottom: 24 },
  noticeInfo: { backgroundColor: '#ECFDF5' },
  noticeError: { backgroundColor: '#FEF2F2' },
  noticeText: { fontSize: 14, color: '#111827', lineHeight: 20 },
  vippsButton: { backgroundColor: '#FF5B24', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 'auto', marginBottom: 40 },
  vippsButtonBusy: { opacity: 0.7 },
  vippsButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
