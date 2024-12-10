// src/app/(auth)/_layout.tsx

import { Tabs } from 'expo-router';
import { useAuth } from '@/core/context/AuthContext';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { View, ActivityIndicator, Text } from 'react-native';
import { useState, useEffect } from 'react';

const getTabs = (userType: 'CUSTOMER' | 'RESTAURANT') => {
  const commonTabs = [
    {
      name: "home",
      options: {
        tabBarLabel: 'Home',
        tabBarIcon: ({ color }: { color: string }) => <Feather name="home" size={24} color={color} />,
      }
    },
    
    {
      name: "cart",
      options: {
        tabBarLabel: 'Cart',
        tabBarIcon: ({ color }: { color: string }) => <Feather name="shopping-cart" size={24} color={color} />,
      }
    },
    {
      name: "orders",
      options: {
        tabBarLabel: 'Orders',
        tabBarIcon: ({ color }: { color: string }) => <Feather name="shopping-bag" size={24} color={color} />,
      }
    }
  ];

  const restaurantTabs = [
    {
      name: "rest_panel",
      options: {
        tabBarLabel: 'Panel',
        tabBarIcon: ({ color }: { color: string }) => <Feather name="layout" size={24} color={color} />,
      }
    },
    {
      name: "menu_management",
      options: {
        tabBarLabel: 'Menu',
        tabBarIcon: ({ color }: { color: string }) => <Feather name="menu" size={24} color={color} />,
      }
    }
  ];

  return userType === 'RESTAURANT' 
    ? [...commonTabs, ...restaurantTabs, { 
        name: "profile",
        options: {
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }: { color: string }) => <Feather name="user" size={24} color={color} />,
        }
      }] 
    : [...commonTabs, {
        name: "profile",
        options: {
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }: { color: string }) => <Feather name="user" size={24} color={color} />,
        }
      }];
};

export default function AuthLayout() {
  const { user } = useAuth();
  const router = useRouter();
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2D9A63" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', marginBottom: 20 }}>{error}</Text>
        <Text 
          style={{ color: '#2D9A63', fontSize: 16 }}
          onPress={() => router.replace('/login')}
        >
          Return to Login
        </Text>
      </View>
    );
  }

  if (!user) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2D9A63',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        }
      }}
    >
      {getTabs(user.userType).map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={tab.options}
        />
      ))}
    </Tabs>
  );
}