import { Stack } from 'expo-router';
import { useAuth } from '@/core/context/AuthContext';
import { useRouter, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';

// Custom TabBar for courier
const TabBar = ({ currentRoute, navigation }: { 
  currentRoute: string,
  navigation: any 
}) => {
  const tabs = [
    { name: 'courier_panel', label: 'Available', icon: 'list' },
    { name: 'active_orders', label: 'Active', icon: 'navigation' },
    { name: 'profile', label: 'Profile', icon: 'user' }
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.name}
          style={styles.tabButton}
          onPress={() => navigation.navigate(tab.name)}
        >
          <Feather
            name={tab.icon as any}
            size={24}
            color={currentRoute === tab.name ? '#2D9A63' : '#666'}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: currentRoute === tab.name ? '#2D9A63' : '#666' }
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default function CourierLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const currentRoute = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, [user]);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!user) {
        router.replace('/courier-login');
        return;
      }

      if (user.userType !== 'COURIER') {
        setError('Invalid user type');
        router.replace('/courier-login');
        return;
      }
    } catch (err) {
      setError('Authentication error occurred');
      router.replace('/courier-login');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D9A63" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Text 
          style={styles.loginText}
          onPress={() => router.replace('/courier-login')}
        >
          Return to Login
        </Text>
      </View>
    );
  }

  if (!user) return null;

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="courier_panel" />
        <Stack.Screen name="active_orders" />
        <Stack.Screen name="profile" />
      </Stack>
      <TabBar 
        currentRoute={currentRoute.split('/')[1]} 
        navigation={router}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    marginBottom: 20,
  },
  loginText: {
    color: '#2D9A63',
    fontSize: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
  },
});