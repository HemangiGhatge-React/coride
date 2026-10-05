import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useAuth } from '../auth/AuthContext';
import { styles } from './authFormStyles';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;
type Notice = { tone: 'info' | 'error'; text: string };

export default function Login({ navigation }: Props) {
  const { state, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(
    state.status === 'signedOut' && state.reason === 'expired'
      ? { tone: 'info', text: 'Your session has expired. Please log in again.' }
      : null,
  );

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setNotice(null);
    // Email is trimmed but not lowercased: lookups are exact, and existing accounts
    // may have been registered with mixed case.
    const result = await signIn(email.trim(), password);
    if (!result.ok) setNotice({ tone: 'error', text: result.message });
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Welcome back</Text>
      <Text style={styles.subheading}>Log in to find and share rides.</Text>

      {notice && (
        <View style={[styles.notice, notice.tone === 'error' ? styles.noticeError : styles.noticeInfo]}>
          <Text style={styles.noticeText}>{notice.text}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!busy}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        editable={!busy}
        onSubmitEditing={onSubmit}
      />

      <TouchableOpacity
        style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Log in</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Signup')} disabled={busy}>
        <Text style={styles.linkText}>New to CoRide? Create an account</Text>
      </TouchableOpacity>
    </View>
  );
}
