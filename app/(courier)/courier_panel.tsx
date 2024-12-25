import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/core/context/AuthContext';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { API_URL } from '@/src/config';
import { Modal } from 'react-native';
interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  restaurantId: string;
  restaurantName: string;
  customerId: string;
  customerName: string;
  deliveryAddress: string;
  status: 'READY' | 'PICKED_UP' | 'ON_WAY' | 'DELIVERED';
  orderItems: OrderItem[];
  totalAmount: number;
  createdAt: number;
}

export default function CourierPanel() {
  const { user } = useAuth();
  const router = useRouter();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Load available orders
  const loadAvailableOrders = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_URL}/orders/available`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setAvailableOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      Alert.alert('Error', 'Failed to load available orders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load and refresh interval
  useEffect(() => {
    loadAvailableOrders();
    const interval = setInterval(loadAvailableOrders, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle order acceptance
  const handleAcceptOrder = async (orderId: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in again');
      return;
    }
  
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'PICKED_UP',
          courierId: user.id
          // Remove userId, we don't want to change the original customer's userId
        }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to accept order');
      }
  
      Alert.alert('Success', 'Order accepted successfully');
      router.push('/(courier)/active_orders');
    } catch (error) {
      console.error('Error accepting order:', error);
      Alert.alert('Error', 'Failed to accept order');
    }
  };

  // Access check
  if (!user || user.userType !== 'COURIER') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.subText}>Only courier accounts can access this page</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2D9A63" />
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Available Orders</Text>
      </View>

      {/* Orders List */}
      <ScrollView
        style={styles.orderList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              loadAvailableOrders();
            }}
            colors={['#2D9A63']}
          />
        }
      >
        {availableOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No available orders</Text>
            <Text style={styles.subText}>Pull down to refresh</Text>
          </View>
        ) : (
          availableOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => setSelectedOrder(order)}
            >
              {/* Restaurant Info */}
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.restaurantName}>{order.restaurantName}</Text>
                  <Text style={styles.orderId}>Order #{order.id.slice(-6)}</Text>
                </View>
                <Text style={styles.orderAmount}>
                  ${order.totalAmount.toFixed(2)}
                </Text>
              </View>

              {/* Delivery Info */}
              <View style={styles.orderInfo}>
                <View style={styles.infoRow}>
                  <Feather name="map-pin" size={16} color="#666666" />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {order.deliveryAddress}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Feather name="package" size={16} color="#666666" />
                  <Text style={styles.itemsText}>
                    {order.orderItems.reduce((sum, item) => sum + item.quantity, 0)} items
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Order Detail Modal */}
      <Modal
        visible={selectedOrder !== null}
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setSelectedOrder(null)}
              style={styles.closeButton}
            >
              <Feather name="x" size={24} color="#2D9A63" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Order Details</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedOrder && (
            <ScrollView style={styles.modalContent}>
              {/* Customer Info Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer Information</Text>
                <Text style={styles.customerName}>{selectedOrder.customerName}</Text>
                <Text style={styles.deliveryAddress}>{selectedOrder.deliveryAddress}</Text>
              </View>

              {/* Restaurant Info Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Restaurant</Text>
                <Text style={styles.restaurantInfo}>{selectedOrder.restaurantName}</Text>
              </View>

              {/* Order Items Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order Items</Text>
                {selectedOrder.orderItems.map((item) => (
                  <View key={item.id} style={styles.orderItem}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                      <Text style={styles.itemName}>{item.name}</Text>
                    </View>
                    <Text style={styles.itemPrice}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Order Total */}
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalAmount}>
                  ${selectedOrder.totalAmount.toFixed(2)}
                </Text>
              </View>

              {/* Accept Button */}
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => {
                  setSelectedOrder(null);
                  handleAcceptOrder(selectedOrder.id);
                }}
              >
                <Text style={styles.acceptButtonText}>Accept Order</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D9A63',
  },
  orderList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#999999',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  orderId: {
    fontSize: 14,
    color: '#666666',
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D9A63',
  },
  orderInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
  },
  itemsText: {
    fontSize: 14,
    color: '#666666',
  },
  errorText: {
    fontSize: 18,
    color: '#FF4444',
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  deliveryAddress: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  restaurantInfo: {
    fontSize: 14,
    color: '#666666',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D9A63',
    marginRight: 8,
    width: 32,
  },
  itemName: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D9A63',
  },
  acceptButton: {
    backgroundColor: '#2D9A63',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});