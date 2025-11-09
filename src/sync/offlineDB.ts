// src/sync/offlineDB.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// File record interface for better type safety
export interface FileRecord {
  classCode: string;
  name: string;
  localPath: string;
  url?: string;
  compressedSize?: number;
  originalSize?: number;
  isCompressed?: boolean;
  savedAt: string;
}

// AsyncStorage is always ready - no initialization needed
export const initOfflineDB = async (): Promise<void> => {
  console.log('✅ [offlineDB] AsyncStorage is always ready');
  return Promise.resolve();
};

export const saveFileRecord = async (
  classCode: string,
  name: string,
  localPath: string,
  url?: string,
  compressedSize?: number,
  originalSize?: number
): Promise<void> => {
  try {
    console.log(`💾 [offlineDB] Saving file record: ${name} for class ${classCode}`);
    
    const key = `offline_file_${classCode}_${name}`;
    const fileData: FileRecord = {
      classCode,
      name,
      localPath,
      url: url || '',
      compressedSize: compressedSize || 0,
      originalSize: originalSize || 0,
      isCompressed: compressedSize !== undefined,
      savedAt: new Date().toISOString()
    };
    
    await AsyncStorage.setItem(key, JSON.stringify(fileData));
    console.log(`✅ [offlineDB] Successfully saved: ${name}`);
  } catch (error: any) {
    console.error('❌ [offlineDB] Failed to save file record:', error);
    throw new Error(`Failed to save file: ${error.message}`);
  }
};

export const getOfflineFiles = async (classCode: string): Promise<FileRecord[]> => {
  try {
    console.log(`📂 [offlineDB] Getting offline files for class: ${classCode}`);
    
    const allKeys = await AsyncStorage.getAllKeys();
    const classKeys = allKeys.filter(key => 
      key.startsWith(`offline_file_${classCode}_`)
    );
    
    console.log(`📂 [offlineDB] Found ${classKeys.length} keys for class ${classCode}`);
    
    const items = await AsyncStorage.multiGet(classKeys);
    const files: FileRecord[] = items.map(([key, value]) => {
      try {
        return value ? JSON.parse(value) : null;
      } catch (parseError) {
        console.warn(`⚠️ [offlineDB] Failed to parse file data for key ${key}:`, parseError);
        return null;
      }
    }).filter(Boolean);
    
    // Sort by savedAt date (newest first)
    files.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    
    console.log(`✅ [offlineDB] Returning ${files.length} files for class ${classCode}`);
    return files;
  } catch (error: any) {
    console.error('❌ [offlineDB] Failed to get offline files:', error);
    throw new Error(`Failed to get files: ${error.message}`);
  }
};

export const checkFileExists = async (classCode: string, name: string): Promise<boolean> => {
  try {
    console.log(`🔍 [offlineDB] Checking if file exists: ${name} in class ${classCode}`);
    
    const key = `offline_file_${classCode}_${name}`;
    const item = await AsyncStorage.getItem(key);
    const exists = item !== null;
    
    console.log(`✅ [offlineDB] File ${name} exists: ${exists}`);
    return exists;
  } catch (error: any) {
    console.error('❌ [offlineDB] Failed to check file existence:', error);
    throw new Error(`Failed to check file: ${error.message}`);
  }
};

export const deleteFileRecord = async (classCode: string, name: string): Promise<void> => {
  try {
    console.log(`🗑️ [offlineDB] Deleting file record: ${name} from class ${classCode}`);
    
    const key = `offline_file_${classCode}_${name}`;
    await AsyncStorage.removeItem(key);
    
    console.log(`✅ [offlineDB] Successfully deleted: ${name}`);
  } catch (error: any) {
    console.error('❌ [offlineDB] Failed to delete file record:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

export const getAllOfflineFiles = async (): Promise<FileRecord[]> => {
  try {
    console.log(`📂 [offlineDB] Getting all offline files`);
    
    const allKeys = await AsyncStorage.getAllKeys();
    const fileKeys = allKeys.filter(key => key.startsWith('offline_file_'));
    
    const items = await AsyncStorage.multiGet(fileKeys);
    const files: FileRecord[] = items.map(([key, value]) => {
      try {
        return value ? JSON.parse(value) : null;
      } catch (parseError) {
        console.warn(`⚠️ [offlineDB] Failed to parse file data for key ${key}:`, parseError);
        return null;
      }
    }).filter(Boolean);
    
    // Sort by savedAt date (newest first)
    files.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    
    console.log(`✅ [offlineDB] Found ${files.length} total offline files`);
    return files;
  } catch (error: any) {
    console.error('❌ [offlineDB] Failed to get all offline files:', error);
    throw new Error(`Failed to get all files: ${error.message}`);
  }
};

export const getTotalSpaceSaved = async (): Promise<{
  totalFiles: number;
  totalCompressedSize: number;
  totalOriginalSize: number;
  totalSpaceSaved: number;
  averageCompressionRatio: number;
}> => {
  try {
    const allFiles = await getAllOfflineFiles();
    const compressedFiles = allFiles.filter(file => file.isCompressed && file.compressedSize && file.originalSize);
    
    const totalFiles = compressedFiles.length;
    const totalCompressedSize = compressedFiles.reduce((sum, file) => sum + (file.compressedSize || 0), 0);
    const totalOriginalSize = compressedFiles.reduce((sum, file) => sum + (file.originalSize || 0), 0);
    const totalSpaceSaved = totalOriginalSize - totalCompressedSize;
    const averageCompressionRatio = totalOriginalSize > 0 ? (totalSpaceSaved / totalOriginalSize) * 100 : 0;
    
    return {
      totalFiles,
      totalCompressedSize,
      totalOriginalSize,
      totalSpaceSaved,
      averageCompressionRatio
    };
  } catch (error) {
    console.error('❌ [offlineDB] Failed to calculate space savings:', error);
    return {
      totalFiles: 0,
      totalCompressedSize: 0,
      totalOriginalSize: 0,
      totalSpaceSaved: 0,
      averageCompressionRatio: 0
    };
  }
};

export const updateFileCompressionInfo = async (
  classCode: string,
  name: string,
  compressedSize: number,
  originalSize: number
): Promise<void> => {
  try {
    console.log(`📊 [offlineDB] Updating compression info for: ${name}`);
    
    const key = `offline_file_${classCode}_${name}`;
    const existingItem = await AsyncStorage.getItem(key);
    
    if (existingItem) {
      const fileData: FileRecord = JSON.parse(existingItem);
      fileData.compressedSize = compressedSize;
      fileData.originalSize = originalSize;
      fileData.isCompressed = true;
      
      await AsyncStorage.setItem(key, JSON.stringify(fileData));
      console.log(`✅ [offlineDB] Updated compression info for: ${name}`);
    } else {
      throw new Error('File record not found');
    }
  } catch (error: any) {
    console.error('❌ [offlineDB] Failed to update compression info:', error);
    throw new Error(`Failed to update compression info: ${error.message}`);
  }
};

// Debug functions
export const getDatabaseStatus = () => {
  return {
    isInitialized: true,
    db: 'AsyncStorage',
    storageType: 'AsyncStorage',
    ready: true
  };
};

export const forceInitializeDB = async (): Promise<boolean> => {
  console.log('✅ [offlineDB] AsyncStorage is always ready - no initialization needed');
  return true;
};

// Utility to clear all offline files (for debugging)
export const clearAllOfflineFiles = async (): Promise<void> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const fileKeys = allKeys.filter(key => key.startsWith('offline_file_'));
    await AsyncStorage.multiRemove(fileKeys);
    console.log(`🧹 [offlineDB] Cleared ${fileKeys.length} offline files`);
  } catch (error: any) {
    console.error('❌ [offlineDB] Failed to clear files:', error);
    throw new Error(`Failed to clear files: ${error.message}`);
  }
};

// Get storage statistics
export const getStorageStats = async (): Promise<{
  totalFiles: number;
  compressedFiles: number;
  totalSpaceUsed: number;
  estimatedSpaceWithoutCompression: number;
  spaceSaved: number;
}> => {
  try {
    const allFiles = await getAllOfflineFiles();
    const compressedFiles = allFiles.filter(file => file.isCompressed);
    
    const totalSpaceUsed = allFiles.reduce((sum, file) => {
      return sum + (file.compressedSize || 0);
    }, 0);
    
    const estimatedSpaceWithoutCompression = allFiles.reduce((sum, file) => {
      return sum + (file.originalSize || (file.compressedSize || 0));
    }, 0);
    
    const spaceSaved = estimatedSpaceWithoutCompression - totalSpaceUsed;
    
    return {
      totalFiles: allFiles.length,
      compressedFiles: compressedFiles.length,
      totalSpaceUsed,
      estimatedSpaceWithoutCompression,
      spaceSaved
    };
  } catch (error) {
    console.error('❌ [offlineDB] Failed to get storage stats:', error);
    return {
      totalFiles: 0,
      compressedFiles: 0,
      totalSpaceUsed: 0,
      estimatedSpaceWithoutCompression: 0,
      spaceSaved: 0
    };
  }
};