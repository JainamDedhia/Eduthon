// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // AsyncStorage doesn't need initialization - it's always ready
    const initializeApp = async () => {
      try {
        console.log('🚀 [Layout] Starting app...');
        
        // No database initialization needed with AsyncStorage
        // Just simulate a brief loading time for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ [Layout] App ready!');
        setAppReady(true);
      } catch (error: any) {
        console.error('❌ [Layout] App initialization failed:', error);
        // Even if something fails, we still show the app
        setAppReady(true);
      }
    };

    initializeApp();
  }, []);

  // Show loading screen briefly
  if (!appReady) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#F5F5F5',
        padding: 20 
      }}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={{ 
          marginTop: 16, 
          fontSize: 18, 
          fontWeight: '600',
          color: '#333',
          textAlign: 'center'
        }}>
          Welcome to GyaanSetu
        </Text>
        <Text style={{ 
          marginTop: 12, 
          fontSize: 14, 
          color: '#666',
          textAlign: 'center'
        }}>
          Loading your learning platform...
        </Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="role-select" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="student" />
        <Stack.Screen name="teacher" />
        <Stack.Screen name="modal" />
      </Stack>
    </AuthProvider>
  );
}