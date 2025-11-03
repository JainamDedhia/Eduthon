// app/student/dashboard.tsx
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebaseConfig';
import { downloadMaterial, formatBytes, getStorageUsage, isMaterialDownloaded } from '../../utils/storageService';


export default function StudentDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ used: 0, max: 100 * 1024 * 1024, percentage: 0 });
  const [downloadingMaterials, setDownloadingMaterials] = useState(new Set());
  const [downloadedStatus, setDownloadedStatus] = useState({});

  if (!user) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Loading user...</Text>
    </View>
  );
}
  // 🔍 DEBUG: Log user on mount
  useEffect(() => {
    console.log('=== DASHBOARD MOUNTED ===');
    console.log('User from context:', user);
    console.log('User UID:', user?.uid);
    console.log('========================');
  }, []);

  // Load storage usage and download status
  useEffect(() => {
    const loadStorageInfo = async () => {
      try {
        const usage = await getStorageUsage();
        setStorageUsage(usage);
        
        // Check download status for all materials
        const statusMap = {};
        for (const classItem of classes) {
          if (classItem.materials) {
            for (const mat of classItem.materials) {
              const isDownloaded = await isMaterialDownloaded(mat.url);
              statusMap[mat.url] = isDownloaded;
            }
          }
        }
        setDownloadedStatus(statusMap);
      } catch (error) {
        console.error('Error loading storage info:', error);
      }
    };

    if (classes.length > 0) {
      loadStorageInfo();
    }
  }, [classes]);

  // Refresh storage usage periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const usage = await getStorageUsage();
        setStorageUsage(usage);
      } catch (error) {
        console.error('Error refreshing storage:', error);
      }
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
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
    try {
      const usage = await getStorageUsage();
      setStorageUsage(usage);
      
      // Refresh download status
      const statusMap = {};
      for (const classItem of classes) {
        if (classItem.materials) {
          for (const mat of classItem.materials) {
            const isDownloaded = await isMaterialDownloaded(mat.url);
            statusMap[mat.url] = isDownloaded;
          }
        }
      }
      setDownloadedStatus(statusMap);
    } catch (error) {
      console.error('Error refreshing:', error);
    }
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleDownload = async (material, classItem) => {
    const materialKey = material.url;
    
    // Check if already downloaded
    if (downloadedStatus[materialKey]) {
      Alert.alert('Already Downloaded', 'This material is already downloaded.');
      return;
    }

    // Check if already downloading
    if (downloadingMaterials.has(materialKey)) {
      return;
    }

    setDownloadingMaterials(prev => new Set([...prev, materialKey]));

    try {
      await downloadMaterial(material, classItem);
      
      // Update status
      setDownloadedStatus(prev => ({ ...prev, [materialKey]: true }));
      
      // Refresh storage usage
      const usage = await getStorageUsage();
      setStorageUsage(usage);
      
      Alert.alert('Success', 'Material downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', error.message || 'Failed to download material');
    } finally {
      setDownloadingMaterials(prev => {
        const newSet = new Set(prev);
        newSet.delete(materialKey);
        return newSet;
      });
    }
  };

  const renderClassCard = ({ item }) => (
    <View style={styles.classCard}>
      <Text style={styles.className}>{item.className}</Text>
      {item.description && (
        <Text style={styles.classDescription}>{item.description}</Text>
      )}
      <Text style={styles.classCode}>Code: {item.classCode}</Text>
      {item.materials && item.materials.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontWeight: "bold", marginBottom: 5 }}>Materials:</Text>
          {item.materials.map((mat, i) => {
            const isDownloaded = downloadedStatus[mat.url];
            const isDownloading = downloadingMaterials.has(mat.url);
            return (
              <View key={i} style={styles.materialRow}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(mat.url)}
                  style={[
                    styles.materialButton,
                    isDownloaded && styles.materialButtonDownloaded
                  ]}
                  disabled={isDownloading}
                >
                  <Text style={[styles.materialText, isDownloaded && styles.materialTextDownloaded]}>
                    {mat.name} {isDownloaded && '✓'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDownload(mat, item)}
                  style={[
                    styles.downloadButton,
                    isDownloaded && styles.downloadButtonDownloaded,
                    isDownloading && styles.downloadButtonDownloading
                  ]}
                  disabled={isDownloading || isDownloaded}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.downloadButtonText}>
                      {isDownloaded ? '✓' : '⬇'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Welcome, Student!</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.storageIndicator}>
            <Text style={styles.storageText}>
              Storage: {formatBytes(storageUsage.used)} / {formatBytes(storageUsage.max)} ({Math.round(storageUsage.percentage)}%)
            </Text>
            <View style={styles.storageBar}>
              <View 
                style={[
                  styles.storageBarFill, 
                  { width: `${Math.min(storageUsage.percentage, 100)}%` },
                  storageUsage.percentage > 80 && styles.storageBarFillWarning
                ]} 
              />
            </View>
          </View>
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
  storageIndicator: {
    marginTop: 8,
  },
  storageText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  storageBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  storageBarFill: {
    height: '100%',
    backgroundColor: '#66BB6A',
    borderRadius: 2,
  },
  storageBarFillWarning: {
    backgroundColor: '#FFA726',
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  materialButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#E3F2FD",
    borderRadius: 6,
  },
  materialButtonDownloaded: {
    backgroundColor: "#C8E6C9",
  },
  materialText: {
    color: "#1E88E5",
    fontSize: 14,
  },
  materialTextDownloaded: {
    color: "#2E7D32",
  },
  downloadButton: {
    width: 36,
    height: 36,
    backgroundColor: "#4A90E2",
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonDownloaded: {
    backgroundColor: "#66BB6A",
  },
  downloadButtonDownloading: {
    backgroundColor: "#9E9E9E",
  },
  downloadButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: 'bold',
  },
});