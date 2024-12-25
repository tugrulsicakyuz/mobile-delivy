import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { websocketService } from '@/src/services/websocket';

interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'ON_WAY' | 'DELIVERED' | 'CANCELLED';

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
  courierId?: string;
  courierName?: string;
}

interface Message {
  id: string;
  orderId: string;
  content: string;
  senderId: string;
  isFromUser: boolean;
  timestamp: number;
  chatType: 'RESTAURANT_CHAT' | 'COURIER_CHAT';
}

export default function OrdersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const chatScrollRef = useRef<ScrollView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRestaurantChatOpen, setIsRestaurantChatOpen] = useState(false);
  const [isCourierChatOpen, setIsCourierChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const loadMessages = async (orderId: string, chatType: 'RESTAURANT_CHAT' | 'COURIER_CHAT') => {
    try {
      const response = await fetch(`${API_URL}/messages/${orderId}?type=${chatType}`);
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }
      const messages = await response.json();
      setMessages(messages);
      
      // Scroll to bottom after loading messages
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    }
  };

  const loadOrders = useCallback(async () => {
    if (!user?.id) return;

    try {
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
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (selectedOrder && (isRestaurantChatOpen || isCourierChatOpen)) {
      // Initial load of messages
      loadMessages(selectedOrder.id, isRestaurantChatOpen ? 'RESTAURANT_CHAT' : 'COURIER_CHAT');

      // Connect to WebSocket
      websocketService.connect(selectedOrder.id);

      // Listen for new messages
      websocketService.onMessage((message) => {
        if (message.type === 'new_message' && 
            message.data.orderId === selectedOrder.id &&
            message.data.chatType === (isRestaurantChatOpen ? 'RESTAURANT_CHAT' : 'COURIER_CHAT')) {
          setMessages(prev => [...prev, message.data]);
          chatScrollRef.current?.scrollToEnd({ animated: true });
        }
      });

      return () => {
        websocketService.disconnect();
      };
    }
  }, [selectedOrder?.id, isRestaurantChatOpen, isCourierChatOpen]);
  const handleSendMessage = async (chatType: 'RESTAURANT_CHAT' | 'COURIER_CHAT') => {
    if (!selectedOrder || !user?.id || !newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const messageData = {
        id: Math.random().toString(36).slice(2),
        orderId: selectedOrder.id,
        content: newMessage.trim(),
        senderId: user.id,
        isFromUser: true,
        timestamp: Date.now(),
        chatType: chatType
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
      
      // Scroll to bottom
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
            onRefresh={() => {
              setIsRefreshing(true);
              loadOrders();
            }}
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
                <View style={[
                  styles.statusBadge,
                  order.status === 'PENDING' ? styles.statusPending :
                    order.status === 'ACCEPTED' ? styles.statusAccepted :
                      order.status === 'PREPARING' ? styles.statusPreparing :
                        order.status === 'READY' ? styles.statusReady :
                          order.status === 'PICKED_UP' ? styles.statusInTransit :
                            order.status === 'ON_WAY' ? styles.statusInTransit :
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
                <View style={styles.chatButtons}>
                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() => {
                      setSelectedOrder(order);
                      setIsRestaurantChatOpen(true);
                    }}
                  >
                    <Feather name="message-circle" size={20} color="#2D9A63" />
                    <Text style={styles.chatButtonText}>Restaurant</Text>
                  </TouchableOpacity>

                  {(order.status === 'PICKED_UP' || order.status === 'ON_WAY') && order.courierId && (
                    <TouchableOpacity
                      style={styles.chatButton}
                      onPress={() => {
                        setSelectedOrder(order);
                        setIsCourierChatOpen(true);
                      }}
                    >
                      <Feather name="message-circle" size={20} color="#2D9A63" />
                      <Text style={styles.chatButtonText}>Courier</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      {/* Restaurant Chat Modal */}
      <Modal
        visible={isRestaurantChatOpen}
        animationType="slide"
        onRequestClose={() => setIsRestaurantChatOpen(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsRestaurantChatOpen(false)}>
              <Feather name="x" size={24} color="#2D9A63" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Chat with {selectedOrder?.restaurantName}
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
                  message.isFromUser
                    ? styles.userMessage
                    : styles.restaurantMessage
                ]}
              >
                <Text style={[
                  styles.messageText,
                  message.isFromUser
                    ? styles.userMessageText
                    : styles.restaurantMessageText
                ]}>
                  {message.content}
                </Text>
                <Text style={[
                  styles.messageTime,
                  message.isFromUser
                    ? styles.userMessageTime
                    : styles.restaurantMessageTime
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
              onPress={() => handleSendMessage('RESTAURANT_CHAT')}
              disabled={!newMessage.trim() || isSending}
            >
              <Feather name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Courier Chat Modal */}
      <Modal
        visible={isCourierChatOpen}
        animationType="slide"
        onRequestClose={() => setIsCourierChatOpen(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsCourierChatOpen(false)}>
              <Feather name="x" size={24} color="#2D9A63" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Chat with {selectedOrder?.courierName}
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
                  message.isFromUser
                    ? styles.userMessage
                    : styles.courierMessage
                ]}
              >
                <Text style={[
                  styles.messageText,
                  message.isFromUser
                    ? styles.userMessageText
                    : styles.courierMessageText
                ]}>
                  {message.content}
                </Text>
                <Text style={[
                  styles.messageTime,
                  message.isFromUser
                    ? styles.userMessageTime
                    : styles.courierMessageTime
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
              onPress={() => handleSendMessage('COURIER_CHAT')}
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
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
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
  statusInTransit: {
    backgroundColor: '#FF9800',
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
  chatButtons: {
    flexDirection: 'row',
    gap: 8,
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
    fontSize: 14,
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
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2D9A63',
  },
  restaurantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
  },
  courierMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF9800',
  },
  messageText: {
    fontSize: 16,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  restaurantMessageText: {
    color: '#333333',
  },
  courierMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  userMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  restaurantMessageTime: {
    color: '#666666',
  },
  courierMessageTime: {
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
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
  },
});