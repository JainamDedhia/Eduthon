// app/role-select.tsx
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../firebaseConfig';

export default function RoleSelect() {
  const router = useRouter();
  const { setUserRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'teacher' | 'student' | null>(null);

  const handleRoleSelection = async () => {
    if (!selectedRole) {
      Alert.alert('Error', 'Please select a role');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: user.email?.split('@')[0] || 'User',
        email: user.email,
        role: selectedRole,
        createdAt: new Date().toISOString(),
      });

      // Update context
      setUserRole(selectedRole);

      // Navigate based on role
      if (selectedRole === 'teacher') {
        router.replace('/teacher/dashboard');
      } else {
        router.replace('/student/dashboard');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Role</Text>
      <Text style={styles.subtitle}>Choose how you'll use GyaanSetu</Text>

      <TouchableOpacity
        style={[
          styles.roleCard,
          selectedRole === 'teacher' && styles.roleCardSelected
        ]}
        onPress={() => setSelectedRole('teacher')}
      >
        <Text style={styles.roleEmoji}>👨‍🏫</Text>
        <Text style={styles.roleTitle}>Teacher</Text>
        <Text style={styles.roleDescription}>Create classes and share content</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.roleCard,
          selectedRole === 'student' && styles.roleCardSelected
        ]}
        onPress={() => setSelectedRole('student')}
      >
        <Text style={styles.roleEmoji}>👨‍🎓</Text>
        <Text style={styles.roleTitle}>Student</Text>
        <Text style={styles.roleDescription}>Join classes and access materials</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, !selectedRole && styles.buttonDisabled]}
        onPress={handleRoleSelection}
        disabled={loading || !selectedRole}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  roleCard: {
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#DDD',
  },
  roleCardSelected: {
    borderColor: '#4A90E2',
    backgroundColor: '#E3F2FD',
  },
  roleEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});