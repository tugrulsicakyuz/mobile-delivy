import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { API_URL } from '@/src/config';

// Define the Restaurant type
interface Restaurant {
  id: string;
  name: string;
  coverImage?: string;
  isActive: boolean;
  updatedAt: number;
}

export default function Home() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to load restaurants
  const loadRestaurants = async (showLoadingIndicator = true) => {
    try {
      console.log("Starting to load restaurants");
      if (showLoadingIndicator) setIsLoading(true);

      console.log("Making fetch request to:", `${API_URL}/restaurants`);
      const response = await fetch(`${API_URL}/restaurants`);
      console.log("Got response:", response.status);

      if (!response.ok) {
        throw new Error('Failed to fetch restaurants');
      }

      const data = await response.json();
      console.log("Fetched restaurants:", data);
      setRestaurants(data);
    } catch (error) {
      console.error('Error loading restaurants:', error);
      Alert.alert('Error', 'Failed to load restaurants');
    } finally {
      setIsLoading(false);
    }
  };

  // Load restaurants when component mounts
  useEffect(() => {
    console.log("Home component mounted");
    loadRestaurants();
  }, []);

  // Handle pull-to-refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadRestaurants(false);
  };

  // Handle restaurant selection
  const handleSelectRestaurant = (restaurant: Restaurant) => {
    console.log("Selected restaurant:", restaurant);
    if (!restaurant.isActive) {
      Alert.alert('Restaurant Closed', 'This restaurant is currently not accepting orders.');
      return;
    }

    router.push({
      pathname: "/restaurant/[id]",
      params: { id: restaurant.id }
    });
  };

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2D9A63" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Restaurants</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#2D9A63']}
          />
        }
      >
        {restaurants.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No restaurants available</Text>
          </View>
        ) : (
          restaurants.map((restaurant) => (
            <TouchableOpacity
              key={restaurant.id}
              style={styles.restaurantCard}
              onPress={() => handleSelectRestaurant(restaurant)}
            >
              <Image
                source={
                  restaurant.coverImage
                    ? { uri: `${API_URL}${restaurant.coverImage}` }
                    : { uri: 'https://via.placeholder.com/300x200?text=Restaurant' }
                }
                style={styles.restaurantImage}
                resizeMode="cover"
                onError={(e) => {
                  console.error('Image loading error:', e.nativeEvent.error);
                  // Could show placeholder on error if needed
                }}
                
              />
              <View style={styles.restaurantInfo}>
                <Text style={styles.restaurantName}>{restaurant.name}</Text>
                <View style={[
                  styles.statusBadge,
                  restaurant.isActive ? styles.openBadge : styles.closedBadge
                ]}>
                  <Text style={styles.statusText}>
                    {restaurant.isActive ? 'Open' : 'Closed'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D9A63',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  restaurantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  restaurantImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F5F5F5',
  },
  restaurantInfo: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  openBadge: {
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
});