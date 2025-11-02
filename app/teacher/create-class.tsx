// app/teacher/create-class.tsx
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

// Generate random 6-character alphanumeric code
const generateClassCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function CreateClass() {
  const router = useRouter();
  const [className, setClassName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateClass = async () => {
    if (!className.trim()) {
      Alert.alert('Error', 'Please enter a class name');
      return;
    }

    setLoading(true);
    try {
      const classCode = generateClassCode();
      const user = auth.currentUser;
      
      if (!user) throw new Error('No user logged in');

      // Create class document with classCode as document ID
      await setDoc(doc(db, 'classes', classCode), {
        className: className.trim(),
        description: description.trim(),
        classCode,
        teacherId: user.uid,
        students: [],
        createdAt: new Date().toISOString(),
      });

      Alert.alert(
        'Success!',
        `Class created with code: ${classCode}\nShare this code with your students.`,
        [
          {
            text: 'OK',
            onPress: () => router.back()
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

      <Text style={styles.title}>Create New Class</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Class Name (e.g., Math Grade 10)"
        value={className}
        onChangeText={setClassName}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity 
        style={styles.button}
        onPress={handleCreateClass}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Create Class</Text>
        )}
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 A unique class code will be generated automatically. Share it with your students to let them join.
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
    color: '#4A90E2',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#FFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#4A90E2',
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
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
});