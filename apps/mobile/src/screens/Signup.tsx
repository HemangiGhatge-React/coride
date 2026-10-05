import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useAuth } from '../auth/AuthContext';
import { styles } from './authFormStyles';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

// Mirrors RegisterDto on the backend so most mistakes are caught before a round trip.
const MIN_PASSWORD_LENGTH = 8;

export default function Signup({ navigation }: Props) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length > 0 && !busy;

  const onSubmit = async () => {
    if (!canSubmit) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await signUp(name.trim(), email.trim(), password);
    // On success AuthContext switches to the signed-in stack; this screen unmounts.
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Create your account</Text>
      <Text style={styles.subheading}>Join CoRide to share rides and split fuel costs.</Text>

      {error && (
        <View style={[styles.notice, styles.noticeError]}>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        editable={!busy}
      />
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
        placeholder={`Password (min. ${MIN_PASSWORD_LENGTH} characters)`}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!busy}
        onSubmitEditing={onSubmit}
      />

      <TouchableOpacity
        style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Create account</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Auth')} disabled={busy}>
        <Text style={styles.linkText}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </View>
  );
}
