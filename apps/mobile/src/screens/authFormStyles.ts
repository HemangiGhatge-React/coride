import { StyleSheet } from 'react-native';

// Shared by the Login and Signup screens.
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9', paddingHorizontal: 28, paddingTop: 100 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 12 },
  subheading: { fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 28 },
  notice: { borderRadius: 12, padding: 14, marginBottom: 20 },
  noticeInfo: { backgroundColor: '#ECFDF5' },
  noticeError: { backgroundColor: '#FEF2F2' },
  noticeText: { fontSize: 14, color: '#111827', lineHeight: 20 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 14 },
  primaryButton: { backgroundColor: '#0DBF8C', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  linkButton: { paddingVertical: 16, alignItems: 'center' },
  linkText: { color: '#0DBF8C', fontSize: 15, fontWeight: '600' },
});
