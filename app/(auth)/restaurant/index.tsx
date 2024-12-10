import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/core/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

const SAMPLE_RESTAURANTS = {
  "1": {
    id: "1",
    name: "Burger Paradise",
    description: "Best burgers in town",
    image: "https://via.placeholder.com/150",
    isOpen: true,
    menu: [
      {
        id: "b1",
        name: "Classic Burger",
        description: "Beef patty with lettuce, tomato, and cheese",
        price: 9.99,
        category: "Burgers"
      },
      {
        id: "b2",
        name: "Chicken Burger",
        description: "Grilled chicken with special sauce",
        price: 8.99,
        category: "Burgers"
      },
      {
        id: "s1",
        name: "French Fries",
        description: "Crispy golden fries",
        price: 3.99,
        category: "Sides"
      }
    ]
  }
};

export default function RestaurantPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const restaurant = params?.selectedId 
    ? SAMPLE_RESTAURANTS[params.selectedId as keyof typeof SAMPLE_RESTAURANTS]
    : null;
  
  const categories = restaurant 
    ? ["All", ...new Set(restaurant.menu.map(item => item.category))] 
    : [];

    const handleAddToCart = async (item: MenuItem) => {
      // First check if we have a selected restaurant
      const selectedRest = SAMPLE_RESTAURANTS[params.selectedId as keyof typeof SAMPLE_RESTAURANTS];
      if (!selectedRest) return;
    
      try {
        // Get existing cart items
        const existingCart = await AsyncStorage.getItem('cartItems');
        let cartItems = existingCart ? JSON.parse(existingCart) : [];
    
        // Check if item already exists
        if (cartItems.find((i: CartItem) => i.id === item.id)) {
          cartItems = cartItems.map((i: CartItem) => 
            i.id === item.id 
              ? { ...i, quantity: i.quantity + 1 }
              : i
          );
        } else {
          cartItems.push({
            ...item,
            quantity: 1,
            restaurantId: selectedRest.id,
            restaurantName: selectedRest.name
          });
        }
    
        // Save updated cart
        await AsyncStorage.setItem('cartItems', JSON.stringify(cartItems));
        setCart(cartItems);
    
      } catch (error) {
        console.error('Error adding to cart:', error);
      }
    };
    const handleCheckout = () => {
      router.push('/cart'); // Remove (auth) prefix since we're already in auth layout
    };

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Restaurant not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>{restaurant.name}</Text>
          {restaurant.isOpen ? (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Open</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, styles.closedBadge]}>
              <Text style={styles.statusText}>Closed</Text>
            </View>
          )}
        </View>

        {/* Categories */}
        <ScrollView 
          horizontal 
          style={styles.categoryContainer}
          showsHorizontalScrollIndicator={false}
        >
          {categories.map((category: string) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.selectedCategory
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryText,
                selectedCategory === category && styles.selectedCategoryText
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {restaurant.menu
            .filter(item => selectedCategory === "All" || item.category === selectedCategory)
            .map((item) => (
              <View key={item.id} style={styles.menuItem}>
                <View style={styles.itemContent}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                  <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                </View>
                
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => handleAddToCart(item)}
                >
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            ))}
        </View>
      </ScrollView>

      {cart.length > 0 && (
        <TouchableOpacity 
          style={styles.checkoutButton}
          onPress={handleCheckout}
        >
          <Text style={styles.checkoutText}>
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
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D9A63',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#2D9A63',
  },
  closedBadge: {
    backgroundColor: '#FF4444',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  categoryContainer: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  selectedCategory: {
    backgroundColor: '#2D9A63',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  menuContainer: {
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  itemContent: {
    flex: 1,
    marginRight: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  itemPrice: {
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
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});