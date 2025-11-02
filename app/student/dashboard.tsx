// app/student/dashboard.tsx
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebaseConfig';

export default function StudentDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🔍 DEBUG: Log user on mount
  useEffect(() => {
    console.log('=== DASHBOARD MOUNTED ===');
    console.log('User from context:', user);
    console.log('User UID:', user?.uid);
    console.log('========================');
  }, []);

  // 🔥 Real-time listener for classes
  useEffect(() => {
    if (!user?.uid) {
      console.log('⚠️ User not loaded yet');
      setLoading(false);
      return;
    }

    console.log('🔥 Setting up real-time listener for student:', user.uid);

    const q = query(
      collection(db, 'classes'),
      where('students', 'array-contains', user.uid)
    );

    // Real-time listener
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        console.log('🔄 Real-time update! Classes found:', querySnapshot.size);
        
        const classesData = querySnapshot.docs.map(doc => {
          console.log('  - Class:', doc.id, doc.data().className);
          return {
            id: doc.id,
            ...doc.data()
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
      console.log('🧹 Cleaning up listener');
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

  const onRefresh = async () => {
    setRefreshing(true);
    // Real-time listener will automatically update, just toggle refreshing state
    setTimeout(() => setRefreshing(false), 500);
  };

  const renderClassCard = ({ item }) => (
    <View style={styles.classCard}>
      <Text style={styles.className}>{item.className}</Text>
      {item.description && (
        <Text style={styles.classDescription}>{item.description}</Text>
      )}
      <Text style={styles.classCode}>Code: {item.classCode}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome, Student!</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity 
            onPress={async () => {
              // 🔍 DEBUG BUTTON
              const allClasses = await getDocs(collection(db, 'classes'));
              console.log('=== ALL CLASSES IN DB ===');
              allClasses.forEach(doc => {
                console.log('Class:', doc.id);
                console.log('Data:', doc.data());
                console.log('Students:', doc.data().students);
              });
              console.log('My UID:', user.uid);
              console.log('========================');
              Alert.alert('Check console for debug info');
            }}
            style={[styles.logoutButton, { backgroundColor: '#4A90E2' }]}
          >
            <Text style={styles.logoutText}>Debug</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>My Classes</Text>

      {loading ? (
        <Text style={styles.emptyText}>Loading...</Text>
      ) : classes.length === 0 ? (
        <View>
          <Text style={styles.emptyText}>No classes yet. Join your first class!</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
          >
            <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={classes}
          renderItem={renderClassCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <TouchableOpacity
        style={styles.joinButton}
        onPress={() => router.push('/student/join-class')}
      >
        <Text style={styles.joinButtonText}>+ Join Class</Text>
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
    borderLeftColor: '#66BB6A',
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  classDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  classCode: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
  },
  refreshButton: {
    backgroundColor: '#66BB6A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 20,
  },
  refreshButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  joinButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#66BB6A',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});