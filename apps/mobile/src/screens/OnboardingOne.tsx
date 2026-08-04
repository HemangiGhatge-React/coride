import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingOne'>;

export default function OnboardingOne({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.illustrationRow}>
        <View style={[styles.iconCircle, { backgroundColor: '#F1F5F9' }]}>
          <Text style={styles.iconEmoji}>👥</Text>
        </View>
        <View style={[styles.iconCircle, { backgroundColor: '#2E8FE0' }]}>
          <Text style={styles.iconEmoji}>🎫</Text>
        </View>
      </View>

      <Text style={styles.heading}>Find people going{'\n'}your way</Text>
      <Text style={styles.subheading}>
        Connect with verified riders and drivers in your community for safe, affordable rides
      </Text>

      <TouchableOpacity style={styles.nextButton} onPress={() => navigation.navigate('OnboardingTwo')}>
        <Text style={styles.nextButtonText}>Next  →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9', paddingHorizontal: 28, paddingTop: 100, alignItems: 'center' },
  illustrationRow: { flexDirection: 'row', marginBottom: 48 },
  iconCircle: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
  iconEmoji: { fontSize: 28 },
  heading: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 16, color: '#111827' },
  subheading: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 48 },
  nextButton: { backgroundColor: '#0DBF8C', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 14, marginTop: 'auto', marginBottom: 40, width: '100%', alignItems: 'center' },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});