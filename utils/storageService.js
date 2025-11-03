// utils/storageService.js
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'downloaded_materials';
const MAX_STORAGE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

/**
 * Get all downloaded materials metadata
 */
export const getDownloadedMaterials = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting downloaded materials:', error);
    return [];
  }
};

/**
 * Save download metadata to AsyncStorage
 */
const saveDownloadMetadata = async (material) => {
  try {
    const downloads = await getDownloadedMaterials();
    downloads.push(material);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(downloads));
  } catch (error) {
    console.error('Error saving download metadata:', error);
    throw error;
  }
};

/**
 * Remove download metadata from AsyncStorage
 */
const removeDownloadMetadata = async (materialId) => {
  try {
    const downloads = await getDownloadedMaterials();
    const filtered = downloads.filter(d => d.id !== materialId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing download metadata:', error);
    throw error;
  }
};

/**
 * Calculate total storage used by downloads
 */
export const getStorageUsage = async () => {
  try {
    const downloads = await getDownloadedMaterials();
    let totalSize = 0;
    
    for (const download of downloads) {
      if (download.localPath) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(download.localPath);
          if (fileInfo.exists && fileInfo.size) {
            totalSize += fileInfo.size;
          } else if (download.size) {
            // Fallback to stored size if file doesn't exist
            totalSize += download.size;
          }
        } catch (error) {
          // If file doesn't exist, use stored size
          if (download.size) {
            totalSize += download.size;
          }
        }
      } else if (download.size) {
        totalSize += download.size;
      }
    }
    
    return {
      used: totalSize,
      max: MAX_STORAGE_SIZE,
      percentage: (totalSize / MAX_STORAGE_SIZE) * 100,
    };
  } catch (error) {
    console.error('Error calculating storage usage:', error);
    return { used: 0, max: MAX_STORAGE_SIZE, percentage: 0 };
  }
};

/**
 * Format bytes to human readable format
 */
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Download file from URL and save to local storage
 */
export const downloadMaterial = async (material, classInfo) => {
  try {
    // Check if already downloaded
    const downloads = await getDownloadedMaterials();
    const existing = downloads.find(d => d.url === material.url);
    if (existing) {
      throw new Error('Material already downloaded');
    }

    // Check storage space
    const storageUsage = await getStorageUsage();
    if (storageUsage.used >= MAX_STORAGE_SIZE) {
      throw new Error('Storage limit reached (100MB). Please delete some files.');
    }

    // Get file info first to check size
    const response = await fetch(material.url, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    const fileSize = contentLength ? parseInt(contentLength, 10) : null;

    // Check if adding this file would exceed limit
    if (fileSize && storageUsage.used + fileSize > MAX_STORAGE_SIZE) {
      throw new Error(`File is too large. Only ${formatBytes(MAX_STORAGE_SIZE - storageUsage.used)} available.`);
    }

    // Create downloads directory if it doesn't exist
    const downloadsDir = FileSystem.documentDirectory + 'downloads/';
    const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
    }

    // Generate unique filename
    const fileExtension = material.name.split('.').pop() || 'bin';
    const sanitizedName = material.name.replace(/[^a-z0-9.-]/gi, '_');
    const timestamp = Date.now();
    const fileName = `${timestamp}_${sanitizedName}`;
    const localPath = downloadsDir + fileName;

    // Download file
    const downloadResult = await FileSystem.downloadAsync(material.url, localPath);
    
    if (!downloadResult.uri) {
      throw new Error('Download failed: No file received');
    }

    // Get actual file size
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    const actualSize = fileInfo.size || fileSize || 0;

    // Save metadata
    const materialData = {
      id: `${material.url}_${timestamp}`,
      name: material.name,
      url: material.url,
      localPath: localPath,
      size: actualSize,
      downloadDate: new Date().toISOString(),
      classCode: classInfo.id || classInfo.classCode,
      className: classInfo.className || 'Unknown Class',
    };

    await saveDownloadMetadata(materialData);

    return materialData;
  } catch (error) {
    console.error('Error downloading material:', error);
    throw error;
  }
};

/**
 * Check if a material is already downloaded
 */
export const isMaterialDownloaded = async (materialUrl) => {
  try {
    const downloads = await getDownloadedMaterials();
    return downloads.some(d => d.url === materialUrl);
  } catch (error) {
    console.error('Error checking download status:', error);
    return false;
  }
};

/**
 * Delete downloaded material
 */
export const deleteDownloadedMaterial = async (materialId) => {
  try {
    const downloads = await getDownloadedMaterials();
    const material = downloads.find(d => d.id === materialId);
    
    if (!material) {
      throw new Error('Material not found');
    }

    // Delete file from file system
    if (material.localPath) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(material.localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(material.localPath, { idempotent: true });
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        // Continue even if file deletion fails
      }
    }

    // Remove from metadata
    await removeDownloadMetadata(materialId);

    return true;
  } catch (error) {
    console.error('Error deleting material:', error);
    throw error;
  }
};

/**
 * Open downloaded file
 */
export const openDownloadedFile = async (localPath) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (!fileInfo.exists) {
      throw new Error('File not found');
    }
    
    // For React Native, we can use Linking to open files
    // This will work with the system's default handlers
    // Note: Import Linking at the top level would be better, but keeping require for now
    // as we only need it when opening files
    const Linking = require('react-native').Linking;
    
    // Try to open the file URI
    const fileUri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
    await Linking.openURL(fileUri);
  } catch (error) {
    console.error('Error opening file:', error);
    throw error;
  }
};

