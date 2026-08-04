import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingTwo'>;

export default function OnboardingTwo({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.mapCard}>
        <Text style={styles.mapEmoji}>🗺️</Text>
      </View>

      <Text style={styles.heading}>Smart matching{'\n'}based on your route</Text>
      <Text style={styles.subheading}>
        Our intelligent algorithm finds the best rides that match your journey
      </Text>

      <TouchableOpacity style={styles.nextButton} onPress={() => navigation.navigate('Auth')}>
        <Text style={styles.nextButtonText}>Get Started  →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9', paddingHorizontal: 28, paddingTop: 80, alignItems: 'center' },
  mapCard: { width: '100%', height: 180, borderRadius: 20, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: 48 },
  mapEmoji: { fontSize: 56 },
  heading: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 16, color: '#111827' },
  subheading: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 48 },
  nextButton: { backgroundColor: '#0DBF8C', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 14, marginTop: 'auto', marginBottom: 40, width: '100%', alignItems: 'center' },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});