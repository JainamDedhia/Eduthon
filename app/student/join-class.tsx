// app/student/join-class.tsx
import { useRouter } from 'expo-router';
import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

export default function JoinClass() {
  const router = useRouter();
  const [classCode, setClassCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoinClass = async () => {
    if (!classCode.trim()) {
      Alert.alert('Error', 'Please enter a class code');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      const code = classCode.trim().toUpperCase();

      // 🔍 DEBUG
      console.log('=== JOIN CLASS DEBUG ===');
      console.log('User ID:', user.uid);
      console.log('Class Code:', code);
      console.log('=======================');

      // Check if class exists
      const classRef = doc(db, 'classes', code);
      const classDoc = await getDoc(classRef);

      if (!classDoc.exists()) {
        console.log('❌ Class not found'); // 🔍 DEBUG
        Alert.alert('Error', 'Invalid class code. Please check and try again.');
        setLoading(false);
        return;
      }

      const classData = classDoc.data();
      console.log('✅ Class found:', classData); // 🔍 DEBUG

      // Check if already enrolled
      if (classData.students?.includes(user.uid)) {
        console.log('⚠️ Already enrolled'); // 🔍 DEBUG
        Alert.alert('Already Enrolled', 'You are already enrolled in this class.');
        setLoading(false);
        return;
      }

      // Add student to class
      console.log('🔄 Attempting to join...'); // 🔍 DEBUG
      await updateDoc(classRef, {
        students: arrayUnion(user.uid)
      });
      console.log('✅ Successfully joined!'); // 🔍 DEBUG

      Alert.alert(
        'Success!',
        `You've joined ${classData.className}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back - real-time listener will auto-update
              router.back();
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Join a Class</Text>
      <Text style={styles.subtitle}>Enter the class code shared by your teacher</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter 6-digit class code"
        value={classCode}
        onChangeText={(text) => setClassCode(text.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
      />

      <TouchableOpacity 
        style={styles.button}
        onPress={handleJoinClass}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Join Class</Text>
        )}
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Ask your teacher for the class code. It's a 6-character code like "ABC123".
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    color: '#66BB6A',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#FFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 4,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  button: {
    backgroundColor: '#66BB6A',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#388E3C',
    lineHeight: 20,
  },
});