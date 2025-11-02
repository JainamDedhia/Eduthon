// app/_layout.tsx
import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="role-select" />
        <Stack.Screen name="teacher" />
        <Stack.Screen name="student" />
      </Stack>
    </AuthProvider>
  );
}