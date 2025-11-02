// app/index.tsx
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const router = useRouter();
  const { user, userRole, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      // Redirect based on role
      if (userRole === 'teacher') {
        router.replace('/teacher/dashboard');
      } else if (userRole === 'student') {
        router.replace('/student/dashboard');
      } else {
        // User exists but no role set
        router.replace('/role-select');
      }
    }
  }, [user, userRole, loading]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GyaanSetu</Text>
      <Text style={styles.subtitle}>Offline-First Learning Platform</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push('/login')}
      >
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.buttonSecondary]}
        onPress={() => router.push('/register')}
      >
        <Text style={styles.buttonTextSecondary}>Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 48,
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  buttonTextSecondary: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
  },
});