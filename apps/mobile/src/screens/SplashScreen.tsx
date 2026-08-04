import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const AUTO_ADVANCE_MS = 1800;

export default function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('OnboardingOne');
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <LinearGradient colors={['#0DBF8C', '#2E8FE0']} style={styles.container}>
      <View style={styles.logoBox}>
        <Text style={styles.logoEmoji}>🚗</Text>
      </View>
      <Text style={styles.title}>CoRide</Text>
      <Text style={styles.tagline}>Share rides. Save money. Save planet.</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoBox: { width: 88, height: 88, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  logoEmoji: { fontSize: 40 },
  title: { fontSize: 34, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
});