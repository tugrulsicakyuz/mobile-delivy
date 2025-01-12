// app/(auth)/rest_panel.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/core/context/AuthContext';
import { useRouter } from 'expo-router';
import { API_URL } from '@/src/config';
import * as ImagePicker from 'expo-image-picker';
import { websocketService } from '@/src/services/websocket';

// Types
interface Restaurant {
  id: string;
  name: string;
  coverImage?: string;
  isActive: boolean;
  updatedAt: number;
}

interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  userId: string;
  customerName: string;
  status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED';
  orderItems: OrderItem[];
  totalAmount: number;
  createdAt: number;
}

interface Message {
  id: string;
  orderId: string;
  content: string;
  senderId: string;
  isFromUser: boolean;
  timestamp: number;
}

export default function RestaurantPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const chatScrollRef = useRef<ScrollView>(null);

  // Main state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  // Chat state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);

  // Auto-refresh setup
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      loadOrders();
      loadRestaurantData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, []);

  // Load restaurant data
  const loadRestaurantData = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_URL}/restaurants/${user.id}`);
      
      if (response.ok) {
        // If restaurant exists, use that data
        const data = await response.json();
        setRestaurant(data);
      } else if (response.status === 404) {
        // If restaurant doesn't exist, create it
        const restaurantData: Restaurant = {
          id: user.id,
          name: user.fullName,
          isActive: false,
          updatedAt: Date.now()
        };

        const createResponse = await fetch(`${API_URL}/restaurants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(restaurantData)
        });

        if (createResponse.ok) {
          const data = await createResponse.json();
          setRestaurant(data.restaurant);
        } else {
          throw new Error('Failed to create restaurant');
        }
      }
    } catch (error) {
      console.error('Error loading restaurant:', error);
      Alert.alert('Error', 'Failed to load restaurant data');
    }
  };

  // Load orders
  const loadOrders = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_URL}/orders/${user.id}?type=restaurant`);
      if (!response.ok) throw new Error('Failed to load orders');
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial data load
  useEffect(() => {
    if (user?.id) {
      loadRestaurantData();
      loadOrders();
    }
  }, [user?.id]);
  // Load messages
  const loadMessages = async (orderId: string) => {
    try {
      const response = await fetch(`${API_URL}/messages/${orderId}?type=RESTAURANT_CHAT`);
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }
      const messages = await response.json();
      setMessages(messages);
      
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    }
  };
  // Chat WebSocket setup
  useEffect(() => {
    if (selectedOrder && isChatOpen) {
      // Initial load of messages
      loadMessages(selectedOrder.id);

      // Connect to WebSocket
      websocketService.connect(selectedOrder.id);

      // Listen for new messages
      websocketService.onMessage((message) => {
        if (message.type === 'new_message' && message.data.orderId === selectedOrder.id) {
          setMessages(prev => [...prev, message.data]);
          chatScrollRef.current?.scrollToEnd({ animated: true });
        }
      });

      return () => {
        websocketService.disconnect();
      };
    }
  }, [selectedOrder?.id, isChatOpen]);

  // Handle restaurant status toggle
  const handleToggleStatus = async (newStatus: boolean) => {
    if (!user?.id || !restaurant) return;

    try {
      const formData = new FormData();
      formData.append('id', user.id);
      formData.append('name', restaurant.name);
      formData.append('isActive', String(newStatus));
      if (restaurant.coverImage) {
        formData.append('coverImage', restaurant.coverImage);
      }

      const response = await fetch(`${API_URL}/restaurants`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to update status');
      const data = await response.json();
      setRestaurant(data.restaurant);
      Alert.alert('Success', `Restaurant is now ${newStatus ? 'open' : 'closed'}`);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  // Handle image picking and upload
  const handleImagePick = async () => {
    if (!user?.id || !restaurant) return;
    
    try {
      setIsUpdatingImage(true);
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please enable photo library access');
        return;
      }
  
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.5,
      });
  
      if (result.canceled) return;
  
      const formData = new FormData();
      formData.append('id', user.id);
      formData.append('name', restaurant.name);
      formData.append('isActive', String(restaurant.isActive));
      
      const uriParts = result.assets[0].uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      
      formData.append('coverImage', {
        uri: Platform.OS === 'ios' ? result.assets[0].uri.replace('file://', '') : result.assets[0].uri,
        type: `image/${fileType}`,
        name: `photo.${fileType}`,
      } as any);
  
      const response = await fetch(`${API_URL}/restaurants`, {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) throw new Error('Failed to update cover image');
      
      const data = await response.json();
      setRestaurant(data.restaurant);
      Alert.alert('Success', 'Cover image updated successfully');
    } catch (error) {
      console.error('Error updating cover image:', error);
      Alert.alert('Error', 'Failed to update cover image');
    } finally {
      setIsUpdatingImage(false);
    }
  };

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!selectedOrder || !user?.id || !newMessage.trim() || isSending) return;
  
    setIsSending(true);
    try {
      const messageData = {
        id: Math.random().toString(36).slice(2),
        orderId: selectedOrder.id,
        content: newMessage.trim(),
        senderId: user.id,
        isFromUser: false,
        timestamp: Date.now(),
        chatType: 'RESTAURANT_CHAT'
      };
  
      // Send via WebSocket
      websocketService.sendMessage({
        type: 'new_message',
        data: messageData
      });
  
      // Save to server
      await fetch(`${API_URL}/messages/${selectedOrder.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });
  
      setNewMessage('');
      
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  // Handle order status updates
  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, userId: user?.id })
      });

      if (!response.ok) throw new Error('Failed to update order status');
      await loadOrders();
      Alert.alert('Success', `Order status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating order:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  // Access check
  if (!user || user.userType !== 'RESTAURANT') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.subText}>Only restaurant accounts can access this page</Text>
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
        <View>
          {restaurant?.coverImage ? (
            <Image
              source={{ uri: `${API_URL}${restaurant.coverImage}` }}
              style={styles.coverImage}
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text>No cover image</Text>
            </View>
          )}
          <Text style={styles.title}>Restaurant Panel</Text>
          <Text style={styles.restaurantName}>{restaurant?.name}</Text>
        </View>
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.imageButton,
              !restaurant?.coverImage && styles.imageButtonGrey
            ]}
            onPress={handleImagePick}
            disabled={isUpdatingImage}
          >
            <Feather name="image" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>
              {restaurant?.isActive ? 'Open' : 'Closed'}
            </Text>
            <Switch
              value={restaurant?.isActive || false}
              onValueChange={handleToggleStatus}
              trackColor={{ false: '#767577', true: '#2D9A63' }}
              thumbColor="#f4f3f4"
            />
          </View>
        </View>
      </View>

      {/* Orders List */}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              loadOrders();
            }}
            colors={['#2D9A63']}
          />
        }
      >
        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.customerName}>{order.customerName}</Text>
                  <Text style={styles.orderId}>#{order.id.slice(-6)}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  order.status === 'PENDING' ? styles.statusPending :
                    order.status === 'ACCEPTED' ? styles.statusAccepted :
                      order.status === 'PREPARING' ? styles.statusPreparing :
                        order.status === 'READY' ? styles.statusReady :
                          styles.statusDelivered
                ]}>
                  <Text style={styles.statusText}>{order.status}</Text>
                </View>
              </View>

              <View style={styles.orderItems}>
                {order.orderItems.map((item) => (
                  <Text key={item.id} style={styles.orderItem}>
                    {item.quantity}x {item.name}
                  </Text>
                ))}
              </View>

              <View style={styles.orderFooter}>
                <Text style={styles.orderTotal}>
                  ${order.totalAmount.toFixed(2)}
                </Text>
                <View style={styles.footerRight}>
                  {order.status !== 'DELIVERED' && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        const nextStatus =
                          order.status === 'PENDING' ? 'ACCEPTED' :
                            order.status === 'ACCEPTED' ? 'PREPARING' :
                              order.status === 'PREPARING' ? 'READY' :
                                order.status;
                        handleUpdateOrderStatus(order.id, nextStatus);
                      }}
                    >
                      <Text style={styles.actionButtonText}>Update</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      setSelectedOrder(order);
                      setIsChatOpen(true);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Chat</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Chat Modal */}
      <Modal
        visible={isChatOpen}
        animationType="slide"
        onRequestClose={() => setIsChatOpen(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsChatOpen(false)}>
              <Feather name="x" size={24} color="#2D9A63" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Chat with {selectedOrder?.customerName}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            ref={chatScrollRef}
            style={styles.chatContainer}
            onContentSizeChange={() => {
              chatScrollRef.current?.scrollToEnd({ animated: true });
            }}
          >
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageContainer,
                  message.senderId === user?.id
                    ? styles.restaurantMessage
                    : styles.customerMessage
                ]}
              >
                <Text style={[
                  styles.messageText,
                  message.senderId === user?.id
                    ? styles.restaurantMessageText
                    : styles.customerMessageText
                ]}>
                  {message.content}
                </Text>
                <Text style={[
                  styles.messageTime,
                  message.senderId === user?.id
                    ? styles.restaurantMessageTime
                    : styles.customerMessageTime
                ]}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            ))}
          </ScrollView>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.inputContainer}
          >
            <TextInput
              style={styles.messageInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newMessage.trim() || isSending) && styles.sendButtonDisabled
              ]}
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
            >
              <Feather name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </KeyboardAvoidingView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D9A63',
  },
  restaurantName: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  coverImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
  },
  placeholderImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageButton: {
    backgroundColor: '#2D9A63',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageButtonGrey: {
    backgroundColor: '#666666',
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
  },
  orderCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  orderId: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#FFB020',
  },
  statusAccepted: {
    backgroundColor: '#0275D8',
  },
  statusPreparing: {
    backgroundColor: '#5BC0DE',
  },
  statusReady: {
    backgroundColor: '#5CB85C',
  },
  statusDelivered: {
    backgroundColor: '#2D9A63',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  orderItems: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 12,
    marginBottom: 12,
  },
  orderItem: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D9A63',
  },
  actionButton: {
    backgroundColor: '#2D9A63',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    width: 70,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#FF4444',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#666666',
  },
  footerRight: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,  // Added flex: 1
    justifyContent: 'flex-end',  // Added justifyContent
  },
  // Chat Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
    padding: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
  },
  customerMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
  },
  restaurantMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2D9A63',
  },
  messageText: {
    fontSize: 16,
  },
  customerMessageText: {
    color: '#333333',
  },
  restaurantMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  customerMessageTime: {
    color: '#666666',
  },
  restaurantMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: '#2D9A63',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});