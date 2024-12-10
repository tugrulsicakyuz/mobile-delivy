// app/restaurant/[id].tsx
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/core/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '@/src/config';

// TypeScript interfaces
interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUri?: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  restaurantId: string;
  restaurantName: string;
}

interface Restaurant {
  id: string;
  name: string;
  description: string;
  imageUri?: string;
  isActive: boolean;
}

export default function RestaurantPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const restaurantId = params.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Load restaurant data
  const loadRestaurantData = useCallback(async () => {
    if (!restaurantId || !user) return;  // Added user check here

    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/restaurants/${restaurantId}`);

      if (response.ok) {
        const restaurantData = await response.json();
        setRestaurant(restaurantData);

        if (restaurantData.isActive) {
          const menuResponse = await fetch(`${API_URL}/menus/${restaurantId}`);
          if (menuResponse.ok) {
            const menu = await menuResponse.json();
            setMenuItems(menu);
          }
        }
      }
    } catch (error) {
      console.error('Error loading restaurant:', error);
      Alert.alert('Error', 'Failed to load restaurant data');
    } finally {
      setIsLoading(false);
    }
  }, [restaurantId, user]);

  // Load cart data
  const loadCartData = useCallback(async () => {
    try {
      const cartData = await AsyncStorage.getItem('cartItems');
      if (cartData) {
        setCart(JSON.parse(cartData));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      setCart([]);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    if (restaurantId) {
      loadRestaurantData();
    }
  }, [restaurantId, loadRestaurantData]);

  // Reload cart when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadCartData();
    }, [loadCartData])
  );

  useEffect(() => {
    return () => {
      // Cleanup function - resets cart when leaving the page
      loadCartData();
    };
  }, []);

  // Cart management functions
  const handleAddToCart = async (item: MenuItem) => {
    if (!restaurant) return;

    try {
      const cartData = await AsyncStorage.getItem('cartItems');
      console.log('Current cart data:', cartData); // Debug log
      let currentCart: CartItem[] = cartData ? JSON.parse(cartData) : [];
      console.log('Parsed cart:', currentCart); // Debug log

      // Check if adding from a different restaurant
      if (currentCart.length > 0 && currentCart[0].restaurantId !== restaurantId) {
        Alert.alert(
          'Different Restaurant',
          'Your cart contains items from another restaurant. Would you like to clear it and add this item instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear & Add',
              style: 'destructive',
              onPress: async () => {
                const newItem: CartItem = {
                  ...item,
                  quantity: 1,
                  restaurantId,
                  restaurantName: restaurant.name
                };
                await AsyncStorage.setItem('cartItems', JSON.stringify([newItem]));
                setCart([newItem]);
                Alert.alert('Success', 'Item added to cart');
              }
            }
          ]
        );
        return;
      }

      // Add or update item
      const existingItemIndex = currentCart.findIndex(cartItem => cartItem.id === item.id);
      if (existingItemIndex !== -1) {
        currentCart[existingItemIndex].quantity += 1;
      } else {
        currentCart.push({
          ...item,
          quantity: 1,
          restaurantId,
          restaurantName: restaurant.name
        });
      }

      await AsyncStorage.setItem('cartItems', JSON.stringify(currentCart));
      setCart(currentCart);
      Alert.alert('Success', 'Item added to cart');
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add item to cart');
    }
  };

  const handleCheckout = () => {
    router.push('/cart');
  };

  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2D9A63" />
        </View>
      </SafeAreaView>
    );
  }

  // Render error state - restaurant not found
  if (!restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Restaurant not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/home')}
          >
            <Text style={styles.backButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state - restaurant closed
  if (!restaurant.isActive) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Restaurant is currently closed</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/home')}
          >
            <Text style={styles.backButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Main render
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{restaurant.name}</Text>
      </View>

      <ScrollView style={styles.menuContainer}>
        {menuItems.map((item) => (
          <View key={item.id} style={styles.menuItem}>
            {item.imageUri && (
              <Image
                source={{ uri: item.imageUri }}
                style={styles.menuItemImage}
              />
            )}
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemName}>{item.name}</Text>
              <Text style={styles.menuItemDescription}>{item.description}</Text>
              <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleAddToCart(item)}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {cart.length > 0 && (
        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={handleCheckout}
        >
          <Text style={styles.checkoutButtonText}>
            Checkout (${cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)})
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    color: '#2D9A63',
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  errorText: {
    fontSize: 18,
    color: '#FF4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#2D9A63',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  menuContainer: {
    flex: 1,
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
  },
  menuItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  menuItemContent: {
    flex: 1,
    marginRight: 16,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D9A63',
  },
  addButton: {
    backgroundColor: '#2D9A63',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  checkoutButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#2D9A63',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});