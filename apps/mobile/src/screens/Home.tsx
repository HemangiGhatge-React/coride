import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

// Placeholder post-login screen: shows who is signed in so the auth flow can be
// verified end to end. Ride/booking screens replace this later.
export default function Home() {
  const { state, signOut, reloadUser } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const user = state.status === 'signedIn' ? state.user : null;

  const retry = async () => {
    setRetrying(true);
    await reloadUser().catch(() => undefined);
    setRetrying(false);
  };

  return (
    <View style={styles.container}>
      {user ? (
        <>
          <Text style={styles.heading}>Hi, {user.name}</Text>
          <Text style={styles.subheading}>{user.email}</Text>
        </>
      ) : (
        <>
          <Text style={styles.heading}>You're offline</Text>
          <Text style={styles.subheading}>You're still logged in. Reconnect to load your account.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={retry} disabled={retrying}>
            <Text style={styles.secondaryButtonText}>{retrying ? 'Retrying…' : 'Retry'}</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9', paddingHorizontal: 28, paddingTop: 120 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subheading: { fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 24 },
  secondaryButton: { paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#0DBF8C' },
  secondaryButtonText: { color: '#0DBF8C', fontSize: 15, fontWeight: '600' },
  logoutButton: { marginTop: 'auto', marginBottom: 40, paddingVertical: 16, alignItems: 'center', borderRadius: 14, backgroundColor: '#111827' },
  logoutButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
