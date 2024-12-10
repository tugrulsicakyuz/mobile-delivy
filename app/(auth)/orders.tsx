import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/core/context/AuthContext';
import { useRouter } from 'expo-router';
import { API_URL } from '@/src/config';

interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

interface Order {
  id: string;
  userId: string;
  customerName: string;
  restaurantId: string;
  restaurantName: string;
  status: OrderStatus;
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
}

export default function OrdersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // Initial data load
  useEffect(() => {
    loadOrders();
  }, []);

  // Real-time updates
  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading && !isRefreshing && selectedOrder) {
        loadMessages(selectedOrder.id);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isLoading, isRefreshing, selectedOrder]);

  const loadOrders = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/orders/${user.id}?type=customer`);
      if (!response.ok) {
        throw new Error('Failed to load orders');
      }
      const userOrders = await response.json();
      setOrders(userOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setIsLoading(false);
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

  const handleOpenChat = async (order: Order) => {
    setSelectedOrder(order);
    setIsChatOpen(true);
    await loadMessages(order.id);
  };

  const handleSendMessage = async () => {
    if (!selectedOrder || !user || !newMessage.trim()) return;

    try {
      const messageData = {
        orderId: selectedOrder.id,
        content: newMessage.trim(),
        senderId: user.id,
        isFromUser: user.userType === 'CUSTOMER', // This fixes the user type issue
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

      setNewMessage('');
      loadMessages(selectedOrder.id); // Reload messages
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text>Please log in to view your orders</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
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
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={loadOrders}
            colors={['#2D9A63']}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your Orders</Text>
        </View>

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.restaurantName}>{order.restaurantName}</Text>
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
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => handleOpenChat(order)}
                >
                  <Feather name="message-circle" size={20} color="#2D9A63" />
                  <Text style={styles.chatButtonText}>Chat</Text>
                </TouchableOpacity>
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
              Chat with {selectedOrder?.restaurantName}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.chatContainer}>
            {messages.map((message) => (
              <View
              key={message.id}
              style={[
                styles.messageContainer,
                message.isFromUser ? styles.customerMessage : styles.restaurantMessage
              ]}
            >
                <Text style={[
                  styles.messageText,
                  message.senderId === user?.id ? styles.customerMessageText : styles.restaurantMessageText
                ]}>
                  {message.content}
                </Text>
                <Text style={[
                  styles.messageTime,
                  message.senderId === user?.id ? styles.customerMessageTime : styles.restaurantMessageTime
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
              disabled={!newMessage.trim()}
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
  loginButton: {
    marginTop: 16,
    backgroundColor: '#2D9A63',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  restaurantName: {
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
    alignSelf: 'flex-end',
    backgroundColor: '#2D9A63',
  },
  restaurantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
  },
  messageText: {
    fontSize: 16,
  },
  customerMessageText: {
    color: '#FFFFFF',
  },
  restaurantMessageText: {
    color: '#333333',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  customerMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  restaurantMessageTime: {
    color: '#666666',
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
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
  },
  borderBottomWidth: {
    borderBottomWidth: 1,
  },
  borderBottomColor: {
    borderBottomColor: '#E0E0E0',
  }
});