// app/student/downloads.tsx
import { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { deleteDownloadedMaterial, formatBytes, getDownloadedMaterials, getStorageUsage, openDownloadedFile } from '../../utils/storageService';

export default function Downloads() {
  const [downloads, setDownloads] = useState([]);
  const [storageUsage, setStorageUsage] = useState({ used: 0, max: 100 * 1024 * 1024, percentage: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDownloads = async () => {
    try {
      const downloadedMaterials = await getDownloadedMaterials();
      setDownloads(downloadedMaterials);
      
      const usage = await getStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error('Error loading downloads:', error);
      Alert.alert('Error', 'Failed to load downloads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDownloads();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDownloads();
  };

  const handleDelete = async (materialId, materialName) => {
    Alert.alert(
      'Delete Material',
      `Are you sure you want to delete "${materialName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDownloadedMaterial(materialId);
              await loadDownloads();
              Alert.alert('Success', 'Material deleted successfully');
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete material');
            }
          },
        },
      ]
    );
  };

  const handleOpen = async (localPath, materialName) => {
    try {
      await openDownloadedFile(localPath);
    } catch (error) {
      console.error('Open error:', error);
      Alert.alert('Error', `Failed to open ${materialName}`);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderDownloadItem = ({ item }) => (
    <View style={styles.downloadCard}>
      <View style={styles.downloadInfo}>
        <Text style={styles.downloadName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.downloadClass}>{item.className}</Text>
        <View style={styles.downloadMeta}>
          <Text style={styles.downloadSize}>{formatBytes(item.size || 0)}</Text>
          <Text style={styles.downloadDate}>{formatDate(item.downloadDate)}</Text>
        </View>
      </View>
      <View style={styles.downloadActions}>
        <TouchableOpacity
          style={styles.openButton}
          onPress={() => handleOpen(item.localPath, item.name)}
        >
          <Text style={styles.openButtonText}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id, item.name)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Downloads</Text>
      </View>

      {/* Storage Usage Card */}
      <View style={styles.storageCard}>
        <View style={styles.storageHeader}>
          <Text style={styles.storageTitle}>Storage Usage</Text>
          <Text style={styles.storagePercentage}>
            {Math.round(storageUsage.percentage)}%
          </Text>
        </View>
        <View style={styles.storageBar}>
          <View 
            style={[
              styles.storageBarFill, 
              { width: `${Math.min(storageUsage.percentage, 100)}%` },
              storageUsage.percentage > 80 && styles.storageBarFillWarning,
              storageUsage.percentage >= 100 && styles.storageBarFillError
            ]} 
          />
        </View>
        <Text style={styles.storageText}>
          {formatBytes(storageUsage.used)} / {formatBytes(storageUsage.max)}
        </Text>
        {storageUsage.percentage > 80 && (
          <Text style={styles.storageWarning}>
            {storageUsage.percentage >= 100 
              ? 'Storage full! Delete files to download more.' 
              : 'Storage almost full. Consider deleting old files.'}
          </Text>
        )}
      </View>

      {/* Downloads List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : downloads.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>📥</Text>
          <Text style={styles.emptyText}>No downloads yet</Text>
          <Text style={styles.emptySubtext}>
            Download materials from your classes to access them offline
          </Text>
        </View>
      ) : (
        <FlatList
          data={downloads}
          renderItem={renderDownloadItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  storageCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  storageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  storagePercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  storageBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  storageBarFill: {
    height: '100%',
    backgroundColor: '#66BB6A',
    borderRadius: 4,
  },
  storageBarFillWarning: {
    backgroundColor: '#FFA726',
  },
  storageBarFillError: {
    backgroundColor: '#EF5350',
  },
  storageText: {
    fontSize: 12,
    color: '#666',
  },
  storageWarning: {
    fontSize: 12,
    color: '#FFA726',
    marginTop: 4,
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  downloadCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#66BB6A',
  },
  downloadInfo: {
    marginBottom: 12,
  },
  downloadName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  downloadClass: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  downloadMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  downloadSize: {
    fontSize: 12,
    color: '#999',
  },
  downloadDate: {
    fontSize: 12,
    color: '#999',
  },
  downloadActions: {
    flexDirection: 'row',
    gap: 8,
  },
  openButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  openButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

