// src/app/(auth)/rest_panel.tsx

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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/core/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { API_URL } from '@/src/config';


const MESSAGE_POLLING_INTERVAL = 2000;

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
  restaurantId: string;
  restaurantName: string;
  status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  orderItems: OrderItem[];
  createdAt: number;
}

interface Message {
  id: string;
  orderId: string;
  content: string;
  senderId: string;
  isFromUser: boolean;
  timestamp: number;
}export default function RestaurantPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');



  const chatScrollRef = useRef<ScrollView>(null);
  const [isSending, setIsSending] = useState(false);
  const loadRestaurantData = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_URL}/restaurants/${user.id}`);
      if (!response.ok) {
        throw new Error('Failed to load restaurant data');
      }
      const restaurantData = await response.json();
      setRestaurant(restaurantData);
    } catch (error) {
      console.error('Error loading restaurant data:', error);
      Alert.alert('Error', 'Failed to load restaurant data');
    }
  };

  const loadOrders = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`${API_URL}/orders/${user.id}?type=restaurant`);
      if (!response.ok) {
        throw new Error('Failed to load orders');
      }
      const restaurantOrders = await response.json();
      setOrders(restaurantOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      Alert.alert('Error', 'Failed to load orders');
    }
  };

  const loadMessages = async (orderId: string) => {
    try {
      const response = await fetch(`${API_URL}/messages/${orderId}`);
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }
      const messages = await response.json();
      setMessages(messages);
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    }
  };

  const loadInitialData = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      await loadRestaurantData();
      await loadOrders();
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load restaurant data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Order polling
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      if (!isLoading && !isRefreshing) {
        loadOrders();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user?.id, isLoading, isRefreshing]);

  // Message polling
  useEffect(() => {
    if (selectedOrder && !isLoading && !isRefreshing && isChatOpen) {
      const loadLatestMessages = async () => {
        try {
          const response = await fetch(`${API_URL}/messages/${selectedOrder.id}`);
          if (response.ok) {
            const newMessages = await response.json();
            setMessages(newMessages);
          }
        } catch (error) {
          console.error('Error loading messages:', error);
        }
      };

      loadLatestMessages();
      const interval = setInterval(loadLatestMessages, 2000);

      return () => clearInterval(interval);
    }
  }, [selectedOrder?.id, isLoading, isRefreshing, isChatOpen]);
  const handleToggleStatus = async (newStatus: boolean) => {
    if (!user?.id || !restaurant) return;

    try {
      const formData = new FormData();
      formData.append('id', user.id);
      formData.append('name', restaurant.name);
      formData.append('isActive', String(newStatus));

      const response = await fetch(`${API_URL}/restaurants`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to update restaurant status');
      }

      const { restaurant: updatedRestaurant } = await response.json();
      setRestaurant(updatedRestaurant);
      Alert.alert(
        'Status Updated',
        `Restaurant is now ${newStatus ? 'open' : 'closed'}`
      );
    } catch (error) {
      console.error('Error updating restaurant status:', error);
      Alert.alert('Error', 'Failed to update restaurant status');
    }
  };

  const handleOpenChat = async (order: Order) => {
    setSelectedOrder(order);
    setIsChatOpen(true);
    await loadMessages(order.id);
  };

  const handleSendMessage = async () => {
    if (!selectedOrder || !user || !newMessage.trim() || isSending) return;

    setIsSending(true);
    const optimisticMessage = {
      id: Date.now().toString(),
      orderId: selectedOrder.id,
      content: newMessage,
      senderId: user.id,
      isFromUser: false,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');

    try {
      const messageData = {
        orderId: selectedOrder.id,
        content: newMessage.trim(),
        senderId: user.id,
        isFromUser: false,
        timestamp: Date.now()
      };

      const response = await fetch(`${API_URL}/messages/${selectedOrder.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      await loadMessages(selectedOrder.id);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus, userId: user?.id })
      });

      await loadOrders();
      Alert.alert('Success', `Order status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

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
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Restaurant Panel</Text>
          <Text style={styles.restaurantName}>{restaurant?.name}</Text>
        </View>
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

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={loadInitialData}
            colors={['#2D9A63']}
          />
        }
      >
        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active orders</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.customerName}>{order.customerName}</Text>
                  <Text style={styles.orderId}>#{order.id.slice(-6)}</Text>
                </View>
                <View style={[styles.statusBadge,
                order.status === 'PENDING' ? styles.statusPending :
                  order.status === 'ACCEPTED' ? styles.statusAccepted :
                    order.status === 'PREPARING' ? styles.statusPreparing :
                      order.status === 'READY' ? styles.statusReady :
                        order.status === 'DELIVERED' ? styles.statusDelivered :
                          styles.statusDefault
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
                <View style={styles.orderActions}>
                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() => handleOpenChat(order)}
                  >
                    <Feather name="message-circle" size={20} color="#2D9A63" />
                    <Text style={styles.chatButtonText}>Chat</Text>
                  </TouchableOpacity>

                  {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        const nextStatus =
                          order.status === 'PENDING' ? 'ACCEPTED' :
                            order.status === 'ACCEPTED' ? 'PREPARING' :
                              order.status === 'PREPARING' ? 'READY' :
                                order.status === 'READY' ? 'DELIVERED' :
                                  null;

                        if (nextStatus) {
                          handleUpdateOrderStatus(order.id, nextStatus);
                        }
                      }}
                    >
                      <Text style={styles.actionButtonText}>
                        {order.status === 'PENDING' ? 'Accept' :
                          order.status === 'ACCEPTED' ? 'Start Preparing' :
                            order.status === 'PREPARING' ? 'Mark Ready' :
                              'Mark Delivered'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

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
                  !message.isFromUser ? styles.customerMessage : styles.restaurantMessage
                ]}
              >
                <Text style={[
                  styles.messageText,
                  message.senderId === user?.id ? styles.restaurantMessageText : styles.customerMessageText
                ]}>
                  {message.content}
                </Text>
                <Text style={[
                  styles.messageTime,
                  message.senderId === user?.id ? styles.restaurantMessageTime : styles.customerMessageTime
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
                !newMessage.trim() && styles.sendButtonDisabled
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  statusContainer: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
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
  statusDefault: {
    backgroundColor: '#666666',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  orderItems: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D9A63',
  },
  orderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
  },
  chatButtonText: {
    marginLeft: 4,
    color: '#2D9A63',
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#2D9A63',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
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
  errorText: {
    fontSize: 18,
    color: '#FF4444',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#666666',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
  }
});