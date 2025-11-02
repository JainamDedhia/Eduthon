// app/teacher/dashboard.tsx
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebaseConfig';

export default function TeacherDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔥 Real-time listener for teacher's classes
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    console.log('🔥 Setting up real-time listener for teacher:', user.uid);

    const q = query(
      collection(db, 'classes'),
      where('teacherId', '==', user.uid)
    );

    // Real-time listener
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        console.log('🔄 Real-time update! Teacher classes found:', querySnapshot.size);
        
        const classesData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log(`  - Class: ${doc.id} | Students: ${data.students?.length || 0}`);
          return {
            id: doc.id,
            ...data
          };
        });
        
        setClasses(classesData);
        setLoading(false);
      },
      (error) => {
        console.error('❌ Listener error:', error);
        Alert.alert('Error', 'Failed to load classes: ' + error.message);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('🧹 Cleaning up teacher listener');
      unsubscribe();
    };
  }, [user?.uid]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const renderClassCard = ({ item }) => (
  <View style={styles.classCard}>
    <Text style={styles.className}>{item.className}</Text>
    {item.description && (
      <Text style={styles.classDescription}>{item.description}</Text>
    )}
    <Text style={styles.classCode}>Code: {item.classCode}</Text>

    <TouchableOpacity
      style={[styles.uploadButton, { backgroundColor: "#4A90E2" }]}
      onPress={() =>
        router.push(`/teacher/upload-material?classCode=${item.classCode}`)
      }
    >
      <Text style={styles.uploadButtonText}>Upload Material</Text>
    </TouchableOpacity>
  </View>
);


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome, Teacher!</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>My Classes</Text>

      {loading ? (
        <Text style={styles.emptyText}>Loading...</Text>
      ) : classes.length === 0 ? (
        <Text style={styles.emptyText}>No classes yet. Create your first class!</Text>
      ) : (
        <FlatList
          data={classes}
          renderItem={renderClassCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push('/teacher/create-class')}
      >
        <Text style={styles.createButtonText}>+ Create New Class</Text>
      </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  listContainer: {
    paddingBottom: 100,
  },
  classCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  classCode: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '600',
    marginBottom: 4,
  },
  studentCount: {
    fontSize: 12,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
  },
  createButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButton: {
  marginTop: 8,
  paddingVertical: 10,
  borderRadius: 6,
  alignItems: "center",
},
uploadButtonText: {
  color: "#FFF",
  fontWeight: "600",
},

});