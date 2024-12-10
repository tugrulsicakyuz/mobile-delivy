import { Stack } from 'expo-router';
import { AuthProvider } from '@/core/context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

export default function RootLayout() {
  return (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </View>
    </AuthProvider>
  );
}