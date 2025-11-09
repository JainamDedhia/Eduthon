// src/sync/downloadManager.ts
import * as FileSystem from 'expo-file-system/legacy';
import { Linking, Platform } from 'react-native';
import * as zlib from 'react-zlib-js';
import { checkFileExists, saveFileRecord } from './offlineDB';

// Add Buffer polyfill for React Native
const Buffer = require('buffer/').Buffer;

export const downloadAndStore = async (
  classCode: string,
  material: { name: string; url: string }
): Promise<string> => {
  console.log(`🚀 [downloadManager] Starting download with compression for: ${material.name}`);
  
  try {
    console.log(`📥 [downloadManager] Step 1: Checking if file already exists...`);
    
    // Check if file already exists
    const exists = await checkFileExists(classCode, material.name);
    if (exists) {
      console.log(`⚠️ [downloadManager] File already exists: ${material.name}`);
      throw new Error("File already downloaded. Check offline materials.");
    }

    console.log(`✅ [downloadManager] Step 1: File doesn't exist, proceeding...`);

    // Create download directory
    const downloadDir = FileSystem.documentDirectory + "offlineFiles/";
    const tempDir = FileSystem.cacheDirectory + "temp/";
    console.log(`📁 [downloadManager] Using directories:\n- Download: ${downloadDir}\n- Temp: ${tempDir}`);
    
    // Create directories if they don't exist
    try {
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
      console.log('✅ [downloadManager] Directories created successfully');
    } catch (dirError: any) {
      console.error('❌ [downloadManager] Failed to create directories:', dirError);
      throw new Error(`Cannot create directories: ${dirError.message}`);
    }

    // Sanitize filename
    const sanitizedName = material.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const tempPath = tempDir + sanitizedName;
    const compressedPath = downloadDir + sanitizedName + '.gz';
    
    console.log(`📝 [downloadManager] File paths:\n- Temp: ${tempPath}\n- Compressed: ${compressedPath}`);

    // Check if URL is valid
    if (!material.url || !material.url.startsWith('http')) {
      console.error('❌ [downloadManager] Invalid URL:', material.url);
      throw new Error('Invalid file URL');
    }

    console.log(`🌐 [downloadManager] Step 2: Downloading from: ${material.url}`);
    
    // Download file to temp location
    console.log(`⏳ [downloadManager] Download in progress...`);
    const downloadRes = await FileSystem.downloadAsync(material.url, tempPath);
    console.log(`📥 [downloadManager] Download response status: ${downloadRes.status}`);

    if (downloadRes.status !== 200) {
      console.error(`❌ [downloadManager] Download failed with status: ${downloadRes.status}`);
      throw new Error(`Download failed with status: ${downloadRes.status}`);
    }

    console.log(`✅ [downloadManager] Download successful: ${downloadRes.uri}`);

    // Get original file size
    const originalInfo = await FileSystem.getInfoAsync(tempPath);
    const originalSize = originalInfo.size || 0;
    console.log(`📊 [downloadManager] Original file size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    console.log(`🗜️ [downloadManager] Step 3: Compressing file...`);
    
    // Compress the file
    let compressedSize = 0;
    try {
      // Read the file as base64
      const fileContent = await FileSystem.readAsStringAsync(tempPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Compress using gzip with Buffer polyfill
      const compressedData = await new Promise<string>((resolve, reject) => {
        zlib.gzip(Buffer.from(fileContent, 'base64'), (error: any, result: Buffer) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.toString('base64'));
          }
        });
      });

      // Write compressed data to file
      await FileSystem.writeAsStringAsync(compressedPath, compressedData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`✅ [downloadManager] File compressed successfully`);
      
      // Get compressed file size
      const compressedInfo = await FileSystem.getInfoAsync(compressedPath);
      compressedSize = compressedInfo.size || 0;
      
      const spaceSaved = originalSize - compressedSize;
      const compressionRatio = ((spaceSaved / originalSize) * 100).toFixed(1);
      
      console.log(`📊 [downloadManager] Compression results:
        - Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB
        - Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB  
        - Space saved: ${(spaceSaved / 1024 / 1024).toFixed(2)} MB (${compressionRatio}%)`);

    } catch (compressionError: any) {
      console.error('❌ [downloadManager] Compression failed:', compressionError);
      
      // Fallback: Copy original file without compression
      console.log('🔄 [downloadManager] Using fallback (no compression)');
      await FileSystem.copyAsync({
        from: tempPath,
        to: compressedPath,
      });
      
      // Get size for fallback file
      const compressedInfo = await FileSystem.getInfoAsync(compressedPath);
      compressedSize = compressedInfo.size || 0;
      console.log('✅ [downloadManager] Fallback copy completed');
    }

    // Clean up temp file
    try {
      await FileSystem.deleteAsync(tempPath);
      console.log('✅ [downloadManager] Temp file cleaned up');
    } catch (cleanupError) {
      console.warn('⚠️ [downloadManager] Failed to clean up temp file:', cleanupError);
    }

    console.log(`💾 [downloadManager] Step 4: Saving to database...`);
    // Save to database with compression info
    await saveFileRecord(
      classCode, 
      material.name, 
      compressedPath, 
      material.url,
      compressedSize,
      originalSize
    );
    console.log(`✅ [downloadManager] Successfully saved to database`);

    return compressedPath;
  } catch (error: any) {
    console.error("❌ [downloadManager] Download process failed completely:", error);
    
    // Clean up on failure
    try {
      const tempDir = FileSystem.cacheDirectory + "temp/";
      await FileSystem.deleteAsync(tempDir, { idempotent: true });
    } catch (cleanupError) {
      console.warn('⚠️ [downloadManager] Cleanup on failure error:', cleanupError);
    }
    
    // Provide user-friendly error messages
    if (error.message.includes('already downloaded')) {
      throw error;
    } else if (error.message.includes('Network request failed')) {
      throw new Error('Network error. Please check your internet connection.');
    } else {
      throw new Error(`Download failed: ${error.message}`);
    }
  }
};

export const openFile = async (compressedPath: string, originalName: string): Promise<void> => {
  console.log(`📂 [downloadManager] Opening compressed file: ${originalName}`);
  
  try {
    // Check if compressed file exists
    const compressedInfo = await FileSystem.getInfoAsync(compressedPath);
    if (!compressedInfo.exists) {
      console.error('❌ [downloadManager] Compressed file not found:', compressedPath);
      throw new Error('File not found. It may have been deleted.');
    }

    console.log(`✅ [downloadManager] Compressed file exists: ${(compressedInfo.size || 0) / 1024} KB`);

    const tempDir = FileSystem.cacheDirectory + "temp/";
    const decompressedPath = tempDir + originalName;
    
    // Create temp directory if needed
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

    console.log(`🗜️ [downloadManager] Decompressing file...`);
    
    try {
      // Read compressed file
      const compressedData = await FileSystem.readAsStringAsync(compressedPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Decompress using gunzip with Buffer polyfill
      const decompressedData = await new Promise<string>((resolve, reject) => {
        zlib.gunzip(Buffer.from(compressedData, 'base64'), (error: any, result: Buffer) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.toString('base64'));
          }
        });
      });

      // Write decompressed file
      await FileSystem.writeAsStringAsync(decompressedPath, decompressedData, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`✅ [downloadManager] File decompressed successfully: ${decompressedPath}`);

    } catch (decompressionError: any) {
      console.error('❌ [downloadManager] Decompression failed:', decompressionError);
      
      // Fallback: Assume file is not compressed and copy directly
      console.log('🔄 [downloadManager] Using fallback (no decompression)');
      await FileSystem.copyAsync({
        from: compressedPath,
        to: decompressedPath,
      });
      console.log('✅ [downloadManager] Fallback copy completed');
    }

    // Verify decompressed file exists
    const decompressedInfo = await FileSystem.getInfoAsync(decompressedPath);
    if (!decompressedInfo.exists) {
      throw new Error('Decompressed file not found');
    }

    console.log(`✅ [downloadManager] Decompressed file ready: ${(decompressedInfo.size || 0) / 1024} KB`);

    // Open the file
    if (Platform.OS === "android") {
      console.log(`🤖 [downloadManager] Android detected, using IntentLauncher`);
      try {
        const IntentLauncher = require("expo-intent-launcher");
        const contentUri = await FileSystem.getContentUriAsync(decompressedPath);
        console.log(`📱 [downloadManager] Content URI: ${contentUri}`);

        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1,
          type: "application/pdf",
        });
        console.log('✅ [downloadManager] File opened with IntentLauncher');
      } catch (intentError) {
        console.warn("⚠️ [downloadManager] IntentLauncher failed, trying Linking:", intentError);
        const supported = await Linking.canOpenURL(decompressedPath);
        if (supported) {
          await Linking.openURL(decompressedPath);
          console.log('✅ [downloadManager] File opened with Linking fallback');
        } else {
          throw new Error("No app found to open PDF files. Please install a PDF reader.");
        }
      }
    } else if (Platform.OS === "ios") {
      console.log(`🍎 [downloadManager] iOS detected, using Sharing`);
      try {
        const Sharing = require("expo-sharing");
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(decompressedPath);
          console.log('✅ [downloadManager] File shared with Sharing API');
        } else {
          throw new Error("Sharing not available");
        }
      } catch (shareError) {
        console.warn("⚠️ [downloadManager] Sharing failed, trying Linking:", shareError);
        await Linking.openURL(decompressedPath);
        console.log('✅ [downloadManager] File opened with Linking fallback');
      }
    } else {
      console.log(`🌐 [downloadManager] Other platform, using Linking`);
      await Linking.openURL(decompressedPath);
    }

    console.log("✅ [downloadManager] File opened successfully");

    // Schedule cleanup of decompressed file after a delay
    setTimeout(async () => {
      try {
        await FileSystem.deleteAsync(decompressedPath);
        console.log(`🧹 [downloadManager] Cleaned up decompressed file: ${decompressedPath}`);
      } catch (cleanupError) {
        console.warn('⚠️ [downloadManager] Failed to clean up decompressed file:', cleanupError);
      }
    }, 30000); // Clean up after 30 seconds

  } catch (error: any) {
    console.error("❌ [downloadManager] Failed to open file:", error);
    
    // Clean up on error
    try {
      const tempDir = FileSystem.cacheDirectory + "temp/";
      await FileSystem.deleteAsync(tempDir, { idempotent: true });
    } catch (cleanupError) {
      console.warn('⚠️ [downloadManager] Cleanup on error failed:', cleanupError);
    }
    
    throw new Error(error.message || "Could not open file. Please install a PDF reader app.");
  }
};

export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    console.log(`🗑️ [downloadManager] Deleting file: ${filePath}`);
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
      console.log(`✅ [downloadManager] Deleted file: ${filePath}`);
    }
  } catch (error: any) {
    console.error("❌ [downloadManager] Failed to delete file:", error);
    throw error;
  }
};

export const getFileSize = async (filePath: string): Promise<number> => {
  try {
    console.log(`📊 [downloadManager] Getting file size: ${filePath}`);
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists && "size" in fileInfo) {
      console.log(`✅ [downloadManager] File size: ${fileInfo.size} bytes`);
      return fileInfo.size;
    }
    console.log(`⚠️ [downloadManager] File size not available: ${filePath}`);
    return 0;
  } catch (error) {
    console.error("❌ [downloadManager] Failed to get file size:", error);
    return 0;
  }
};

// Utility to get compression info
export const getCompressionInfo = async (compressedPath: string, originalName: string): Promise<{
  compressedSize: number;
  estimatedOriginalSize: number;
  spaceSaved: number;
  compressionRatio: number;
}> => {
  try {
    const compressedInfo = await FileSystem.getInfoAsync(compressedPath);
    const compressedSize = compressedInfo.size || 0;
    
    // Estimate original size (rough estimate - compression ratio varies)
    const estimatedOriginalSize = compressedSize * 2.5; // Average compression ratio for PDFs
    
    const spaceSaved = estimatedOriginalSize - compressedSize;
    const compressionRatio = compressedSize > 0 ? (spaceSaved / estimatedOriginalSize) * 100 : 0;
    
    return {
      compressedSize,
      estimatedOriginalSize,
      spaceSaved,
      compressionRatio
    };
  } catch (error) {
    console.error('❌ [downloadManager] Failed to get compression info:', error);
    return {
      compressedSize: 0,
      estimatedOriginalSize: 0,
      spaceSaved: 0,
      compressionRatio: 0
    };
  }
};