// app/student/dashboard.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebaseConfig';

// ✅ IMPORT REAL FUNCTIONS
import { deleteFile, downloadAndStore, openFile } from '../../src/sync/downloadManager';
import { checkFileExists, deleteFileRecord, FileRecord, getOfflineFiles, getStorageStats } from '../../src/sync/offlineDB';

type ClassMaterial = { name: string; url: string; uploadedAt?: string };
type ClassItem = {
  id: string;
  className: string;
  description?: string;
  classCode: string;
  students?: string[];
  materials?: ClassMaterial[];
};

export default function StudentDashboard() {
  const router = useRouter();
  const { user, userRole } = useAuth();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(true);
  const [networkChecked, setNetworkChecked] = useState(false);
  const [storageStats, setStorageStats] = useState({
    totalFiles: 0,
    compressedFiles: 0,
    totalSpaceUsed: 0,
    spaceSaved: 0
  });

  // Header stats computed from classes data
  const stats = useMemo(() => {
    const totalMaterials = classes.reduce(
      (acc, c) => acc + (c.materials?.length || 0),
      0,
    );
    return { totalClasses: classes.length, totalMaterials };
  }, [classes]);

  // ✅ Network listener
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const state = await NetInfo.fetch();
        const online = Boolean(state.isConnected && state.isInternetReachable);
        console.log('🌐 [Dashboard] Initial network check:', online ? 'ONLINE' : 'OFFLINE');
        setIsOnline(online);
        setNetworkChecked(true);
      } catch (error) {
        console.error('❌ [Dashboard] Network check failed:', error);
        setIsOnline(true);
        setNetworkChecked(true);
      }
    };

    checkNetwork();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable);
      console.log('🌐 [Dashboard] Network change:', online ? 'ONLINE' : 'OFFLINE');
      setIsOnline(online);
      setNetworkChecked(true);
    });

    return () => unsubscribe();
  }, []);

  // Load storage stats
  const loadStorageStats = async () => {
    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    }
  };

  // Debug mount info
  useEffect(() => {
    console.log('=== STUDENT DASHBOARD MOUNTED ===');
    console.log('User from context:', user);
    console.log('User UID:', user?.uid);
    console.log('User Role:', userRole);
    console.log('Network status:', isOnline ? 'ONLINE' : 'OFFLINE');
    console.log('========================');
    
    loadStorageStats();
  }, []);

  // 🔥 Real-time Firestore listener for classes
  useEffect(() => {
    if (!user?.uid || userRole !== 'student') {
      console.log('⚠️ [Dashboard] User not loaded yet or not student');
      setLoading(false);
      return;
    }

    console.log('🔥 [Dashboard] Setting up real-time listener for student:', user.uid);

    const q = query(
      collection(db, 'classes'),
      where('students', 'array-contains', user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        console.log('🔄 [Dashboard] Real-time update! Classes found:', querySnapshot.size);
        
        const classesData: ClassItem[] = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data
          } as ClassItem;
        });
        
        setClasses(classesData);
        setLoading(false);
      },
      (error) => {
        console.error('❌ [Dashboard] Listener error:', error);
        Alert.alert('Error', 'Failed to load classes: ' + error.message);
        setLoading(false);
      },
    );

    return () => {
      console.log('🧹 [Dashboard] Cleaning up student listener');
      unsubscribe();
    };
  }, [user?.uid, userRole]);

  // ✅ Simple database test function
  const debugDatabase = async () => {
    try {
      console.log('🔍 [Dashboard] Testing database...');
      
      // Test if database is working by doing a simple operation
      const testKey = 'test_database_key';
      const testData = { test: 'Database is working!', timestamp: new Date().toISOString() };
      
      // Save test data
      await AsyncStorage.setItem(testKey, JSON.stringify(testData));
      
      // Retrieve test data
      const retrieved = await AsyncStorage.getItem(testKey);
      
      // Clean up
      await AsyncStorage.removeItem(testKey);
      
      if (retrieved) {
        console.log('✅ [Dashboard] Database working perfectly!');
        Alert.alert('Database Status', '✅ Database is working perfectly!\n\nAsyncStorage is always ready.');
      } else {
        throw new Error('Database test failed');
      }
    } catch (error: any) {
      console.error('❌ [Dashboard] Database test failed:', error);
      Alert.alert('Database Error', 'There was an issue with storage. Please restart the app.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace('/');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStorageStats();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleMaterialOpenOnline = async (material: ClassMaterial) => {
    try {
      console.log(`🌐 [Dashboard] Opening material online: ${material.name}`);
      const supported = await Linking.canOpenURL(material.url);
      if (!supported) {
        throw new Error(`Cannot open URL: ${material.url}`);
      }
      await Linking.openURL(material.url);
      console.log(`✅ [Dashboard] Successfully opened: ${material.name}`);
    } catch (error: any) {
      console.error('❌ [Dashboard] Failed to open material:', error);
      Alert.alert('Error', error.message || 'Failed to open material');
    }
  };

  // ✅ Enhanced handleSaveOffline with compression
  const handleSaveOffline = async (classCode: string, material: ClassMaterial) => {
    console.log(`💾 [Dashboard] Save offline clicked for: ${material.name}`);
    
    try {
      console.log(`🔍 [Dashboard] Step 1: Checking if file exists...`);
      
      // Check if already exists
      const exists = await checkFileExists(classCode, material.name);
      if (exists) {
        console.log(`⚠️ [Dashboard] File already exists: ${material.name}`);
        Alert.alert('Already Saved', 'This file is already available offline.');
        return;
      }

      console.log(`✅ [Dashboard] Step 1: File doesn't exist, proceeding...`);

      Alert.alert(
        'Download with Compression',
        `Download "${material.name}" with compression to save storage space?`,
        [
          { 
            text: 'Cancel', 
            style: 'cancel', 
            onPress: () => console.log('❌ [Dashboard] Download cancelled by user') 
          },
          {
            text: 'Download & Compress',
            onPress: async () => {
              try {
                console.log(`🚀 [Dashboard] User confirmed download for: ${material.name}`);
                await downloadAndStore(classCode, material);
                console.log(`✅ [Dashboard] Download completed successfully: ${material.name}`);
                
                // Reload storage stats to show updated space savings
                await loadStorageStats();
                
                Alert.alert('✅ Success', `"${material.name}" is now available offline with compression.`);
              } catch (error: any) {
                console.error('❌ [Dashboard] Download failed:', error);
                Alert.alert(
                  'Download Failed', 
                  error.message || 'Could not save file offline.',
                  [
                    { text: 'OK' },
                    { 
                      text: 'Debug', 
                      onPress: () => {
                        console.log('🔍 [Dashboard] User requested debug after download failure');
                        debugDatabase();
                      }
                    }
                  ]
                );
              }
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ [Dashboard] Save offline process failed:', error);
      Alert.alert(
        'Error', 
        error.message || 'An unexpected error occurred',
        [
          { text: 'OK' },
          { 
            text: 'Debug Database', 
            onPress: () => {
              console.log('🔍 [Dashboard] User requested debug after error');
              debugDatabase();
            }
          }
        ]
      );
    }
  };

  // 🆕 DELETE FILE FUNCTIONALITY
  const handleDeleteFile = async (file: FileRecord) => {
    console.log(`🗑️ [Dashboard] Delete file clicked for: ${file.name}`);
    
    Alert.alert(
      'Delete Offline File',
      `Are you sure you want to delete "${file.name}" from offline storage?`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => console.log('❌ [Dashboard] Delete cancelled by user')
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`🚀 [Dashboard] User confirmed deletion for: ${file.name}`);
              
              // Step 1: Delete the physical file from storage
              console.log(`🗑️ [Dashboard] Deleting physical file: ${file.localPath}`);
              await deleteFile(file.localPath);
              
              // Step 2: Delete the database record
              console.log(`🗑️ [Dashboard] Deleting database record for: ${file.name}`);
              await deleteFileRecord(file.classCode, file.name);
              
              // Step 3: Reload storage stats
              await loadStorageStats();
              
              console.log(`✅ [Dashboard] File deletion completed: ${file.name}`);
              Alert.alert('✅ Success', `"${file.name}" has been deleted from offline storage.`);
              
            } catch (error: any) {
              console.error('❌ [Dashboard] File deletion failed:', error);
              Alert.alert(
                'Deletion Failed', 
                error.message || 'Could not delete file from offline storage.',
                [
                  { text: 'OK' },
                  { 
                    text: 'Debug', 
                    onPress: () => {
                      console.log('🔍 [Dashboard] User requested debug after deletion failure');
                      debugDatabase();
                    }
                  }
                ]
              );
            }
          }
        }
      ]
    );
  };

  // ✅ Offline files display component with compression info AND DELETE BUTTON
  const OfflineFilesDisplay: React.FC<{ classCode: string }> = ({ classCode }) => {
    const [files, setFiles] = useState<FileRecord[]>([]);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
      setBusy(true);
      try {
        console.log(`📂 [Dashboard] Loading offline files for class: ${classCode}`);
        const list = await getOfflineFiles(classCode);
        setFiles(list || []);
        console.log(`✅ [Dashboard] Loaded ${list.length} offline files for ${classCode}`);
      } catch (error) {
        console.warn('❌ [Dashboard] getOfflineFiles failed', error);
        setFiles([]);
      } finally {
        setBusy(false);
      }
    }, [classCode]);

    useEffect(() => {
      load();
    }, [load]);

    useFocusEffect(
      useCallback(() => {
        load();
      }, [load]),
    );

    const openLocal = async (path: string, name: string) => {
      try {
        console.log(`📂 [Dashboard] Opening local file: ${name}`);
        await openFile(path, name);
      } catch (error: any) {
        console.error('❌ [Dashboard] Failed to open local file:', error);
        Alert.alert('Open Failed', error.message || 'Could not open local file.');
      }
    };

    const getSpaceSavedText = (file: FileRecord) => {
      if (file.isCompressed && file.compressedSize && file.originalSize) {
        const savedMB = (file.originalSize - file.compressedSize) / 1024 / 1024;
        const ratio = ((file.originalSize - file.compressedSize) / file.originalSize * 100).toFixed(0);
        return ` • Saved ${savedMB.toFixed(1)}MB (${ratio}%)`;
      }
      return '';
    };

    if (busy) {
      return (
        <View style={{ marginTop: 10, alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#666" />
          <Text style={{ color: '#666', marginTop: 8 }}>Loading offline files…</Text>
        </View>
      );
    }

    if (!files.length) {
      return (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: '#999', fontStyle: 'italic' }}>
            No offline files saved for this class.
          </Text>
        </View>
      );
    }

    return (
      <View style={{ marginTop: 10 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 6, color: '#D84315' }}>
          📴 Offline Materials (Compressed):
        </Text>
        {files.map((file, index) => (
          <View key={`${file.localPath}-${index}`} style={styles.offlineFileContainer}>
            <TouchableOpacity
              onPress={() => openLocal(file.localPath, file.name)}
              style={styles.offlineButton}
            >
              <Text style={styles.offlineText}>
                {file.isCompressed ? '🗜️' : '📂'} {file.name}
              </Text>
              <Text style={styles.offlineMeta}>
                Saved: {file.savedAt ? new Date(file.savedAt).toLocaleDateString() : 'Unknown'}
                <Text style={{color: '#4CAF50', fontSize: 11}}>
                  {getSpaceSavedText(file)}
                </Text>
              </Text>
            </TouchableOpacity>
            
            {/* 🆕 DELETE BUTTON */}
            <TouchableOpacity
              onPress={() => handleDeleteFile(file)}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  const renderClassCard = ({ item, index }: { item: ClassItem; index: number }) => (
    <View
      style={[
        styles.classCard,
        { borderLeftColor: index % 2 === 0 ? '#66BB6A' : '#4A90E2' },
      ]}
    >
      <View style={styles.classHeader}>
        <Text style={styles.className}>{item.className}</Text>
        <View style={styles.materialBadge}>
          <Text style={styles.materialBadgeText}>
            {item.materials?.length || 0} materials
          </Text>
        </View>
      </View>

      {item.description && (
        <Text style={styles.classDescription}>{item.description}</Text>
      )}

      <View style={styles.classInfo}>
        <Text style={styles.classCode}>Code: {item.classCode}</Text>
        <Text style={styles.studentCount}>{item.students?.length || 0} students</Text>
      </View>

      {/* ✅ SMART SYNC: Different UI for online/offline */}
      {isOnline ? (
        <View style={styles.materialsSection}>
          <Text style={styles.materialsTitle}>📚 Learning Materials (Online)</Text>
          {item.materials && item.materials.length > 0 ? (
            item.materials.map((material, matIndex) => (
              <View key={`${material.name}-${matIndex}`} style={{ marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => handleMaterialOpenOnline(material)}
                  style={styles.materialButton}
                >
                  <Text style={styles.materialText}>🌐 {material.name}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleSaveOffline(item.classCode, material)}
                  style={styles.downloadButton}
                >
                  <Text style={styles.downloadText}>🗜️ Save Offline (Compressed)</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={{ color: '#999', fontStyle: 'italic', marginTop: 8 }}>
              No materials available yet.
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.materialsSection}>
          <Text style={[styles.materialsTitle, { color: '#D84315' }]}>
            📴 Offline Mode Active
          </Text>
          <OfflineFilesDisplay classCode={item.classCode} />
        </View>
      )}
    </View>
  );

  // Show loading screen while user is null OR role check
  if (!user || userRole !== 'student') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#66BB6A" />
        <Text style={styles.loadingText}>Loading Student Dashboard...</Text>
        {user && userRole === null && (
          <Text style={styles.roleSelectionText}>
            Please complete role selection to continue
          </Text>
        )}
        {user && userRole && userRole !== 'student' && (
          <>
            <Text style={styles.wrongRoleText}>
              This dashboard is for students only
            </Text>
            <TouchableOpacity 
              onPress={handleLogout}
              style={styles.loadingLogoutButton}
            >
              <Text style={styles.loadingLogoutText}>Back to Home</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Welcome back! 👋</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalClasses}</Text>
              <Text style={styles.statLabel}>Classes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalMaterials}</Text>
              <Text style={styles.statLabel}>Materials</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {!networkChecked ? '⏳' : isOnline ? '🌐' : '📴'}
              </Text>
              <Text style={styles.statLabel}>
                {!networkChecked ? 'Checking' : isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, {color: '#4CAF50'}]}>
                💾
              </Text>
              <Text style={styles.statLabel}>
                {(storageStats.spaceSaved / 1024 / 1024).toFixed(0)}MB saved
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={debugDatabase}
            style={[styles.actionButton, { backgroundColor: '#4A90E2' }]}
          >
            <Text style={styles.actionButtonText}>🐛</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={async () => {
              const allClasses = await getDocs(collection(db, 'classes'));
              console.log('=== DEBUG INFO ===');
              console.log('My UID:', user.uid);
              console.log('My Role:', userRole);
              console.log('Network:', isOnline ? 'ONLINE' : 'OFFLINE');
              console.log('Network Checked:', networkChecked);
              console.log('Storage Stats:', storageStats);
              console.log('Total Classes in DB:', allClasses.size);
              allClasses.forEach(doc => {
                console.log(`Class ${doc.id}:`, doc.data());
              });
              console.log('==================');
              Alert.alert('Debug', 'Check console for details');
            }}
            style={[styles.actionButton, { backgroundColor: '#6C757D' }]}
          >
            <Text style={styles.actionButtonText}>🔧</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Storage Savings Banner */}
      {storageStats.spaceSaved > 0 && (
        <View style={styles.savingsBanner}>
          <Text style={styles.savingsBannerText}>
            💰 Storage Savings: {(storageStats.spaceSaved / 1024 / 1024).toFixed(1)}MB saved with compression!
            {storageStats.compressedFiles > 0 && ` (${storageStats.compressedFiles} files compressed)`}
          </Text>
        </View>
      )}

      {/* Network Status Banner */}
      {!networkChecked && (
        <View style={styles.loadingBanner}>
          <Text style={styles.loadingBannerText}>
            🔄 Checking network status...
          </Text>
        </View>
      )}
      
      {networkChecked && isOnline === false && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📴 You're offline. Only saved materials are available.
          </Text>
        </View>
      )}

      {/* Classes Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Classes ({classes.length})</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#66BB6A" />
          <Text style={styles.loadingStateText}>Loading your classes...</Text>
        </View>
      ) : classes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No classes yet</Text>
          <Text style={styles.emptyStateText}>
            Join your first class to get started!
          </Text>
          <TouchableOpacity 
            style={styles.emptyStateButton}
            onPress={() => router.push('/student/join-class')}
          >
            <Text style={styles.emptyStateButtonText}>+ Join Class</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={classes}
          renderItem={renderClassCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#66BB6A']}
              tintColor="#66BB6A"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Join Button */}
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
    backgroundColor: '#F8F9FA',
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  roleSelectionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  wrongRoleText: {
    fontSize: 14,
    color: '#DC3545',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingLogoutButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  loadingLogoutText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#66BB6A',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  savingsBanner: {
    backgroundColor: '#C8E6C9',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4CAF50',
  },
  savingsBannerText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingBanner: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#90CAF9',
  },
  loadingBannerText: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: '600',
    textAlign: 'center',
  },
  offlineBanner: {
    backgroundColor: '#FFE082',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD54F',
  },
  offlineBannerText: {
    fontSize: 13,
    color: '#D84315',
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    backgroundColor: '#66BB6A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  classCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  materialBadge: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  materialBadgeText: {
    fontSize: 10,
    color: '#66BB6A',
    fontWeight: '600',
  },
  classDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  classInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  classCode: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  studentCount: {
    fontSize: 12,
    color: '#666',
  },
  materialsSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  materialsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  materialButton: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  materialText: {
    color: '#1E88E5',
    fontWeight: '600',
    fontSize: 14,
  },
  downloadButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  downloadText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },
  // 🆕 NEW STYLES FOR DELETE FUNCTIONALITY
  offlineFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  offlineButton: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
    flex: 1,
    marginRight: 8,
  },
  offlineText: {
    color: '#D84315',
    fontWeight: '600',
    fontSize: 14,
  },
  offlineMeta: {
    fontSize: 11,
    color: '#8D6E63',
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: '#DC3545',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingState: {
    padding: 40,
    alignItems: 'center',
  },
  loadingStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyStateButton: {
    backgroundColor: '#66BB6A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  joinButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#66BB6A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  joinButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});