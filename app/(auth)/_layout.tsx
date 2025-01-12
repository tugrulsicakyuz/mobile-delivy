
import { Stack } from 'expo-router';
import { useAuth } from '@/core/context/AuthContext';
import { useRouter, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';

// Custom TabBar component
const TabBar = ({ userType, currentRoute, navigation }: { 
  userType: 'CUSTOMER' | 'RESTAURANT', 
  currentRoute: string,
  navigation: any 
}) => {
  const getCustomerTabs = () => [
    { name: 'home', label: 'Home', icon: 'home' },
    { name: 'cart', label: 'Cart', icon: 'shopping-cart' },
    { name: 'orders', label: 'Orders', icon: 'shopping-bag' },
    { name: 'profile', label: 'Profile', icon: 'user' }
  ];

  const getRestaurantTabs = () => [
    { name: 'home', label: 'Home', icon: 'home' },
    { name: 'rest_panel', label: 'Panel', icon: 'layout' },
    { name: 'menu_management', label: 'Menu', icon: 'menu' },
    { name: 'profile', label: 'Profile', icon: 'user' }
  ];

  const tabs = userType === 'CUSTOMER' ? getCustomerTabs() : getRestaurantTabs();

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

export default function AuthLayout() {
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
        router.replace('/login');
        return;
      }

      if (user.userType !== 'CUSTOMER' && user.userType !== 'RESTAURANT') {
        setError('Invalid user type');
        router.replace('/login');
        return;
      }
    } catch (err) {
      setError('Authentication error occurred');
      router.replace('/login');
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
          onPress={() => router.replace('/login')}
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
        <Stack.Screen name="home" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="rest_panel" />
        <Stack.Screen name="menu_management" />
        <Stack.Screen name="restaurant" />
        <Stack.Screen name="checkout" /> 
      </Stack>
      <TabBar 
        userType={user.userType} 
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