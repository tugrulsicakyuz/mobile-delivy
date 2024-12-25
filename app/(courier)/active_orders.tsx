import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/core/context/AuthContext';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { API_URL } from '@/src/config';
import { websocketService } from '@/src/services/websocket';

interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

type OrderStatus = 'PICKED_UP' | 'ON_WAY' | 'DELIVERED';

interface Order {
  id: string;
  restaurantId: string;
  restaurantName: string;
  customerId: string;
  customerName: string;
  deliveryAddress: string;
  status: OrderStatus;
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
  chatType: 'COURIER_CHAT';
}

export default function ActiveOrders() {
  const { user } = useAuth();
  const router = useRouter();
  const chatScrollRef = useRef<ScrollView>(null);

  // State
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Load active orders
  const loadActiveOrders = async () => {
    if (!user?.id) return;
  
    try {
      setIsLoading(true);
      console.log('Loading active orders for courier:', user.id);  // Add this log
      const response = await fetch(`${API_URL}/orders/${user.id}?type=courier`);
  
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
  
      const data = await response.json();
      console.log('Received orders:', data);  // Add this log
      setActiveOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      Alert.alert('Error', 'Failed to load active orders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial data load and refresh interval
  useEffect(() => {
    loadActiveOrders();
    const interval = setInterval(loadActiveOrders, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [user?.id]);

  // Load messages
  const loadMessages = async (orderId: string) => {
    try {
      const response = await fetch(`${API_URL}/messages/${orderId}?type=COURIER_CHAT`);
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }
      const messages = await response.json();
      setMessages(messages);
      
      // Scroll to bottom after messages load
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
        if (message.type === 'new_message' && 
            message.data.orderId === selectedOrder.id &&
            message.data.chatType === 'COURIER_CHAT') {
          setMessages(prev => [...prev, message.data]);
          chatScrollRef.current?.scrollToEnd({ animated: true });
        }
      });

      return () => {
        websocketService.disconnect();
      };
    }
  }, [selectedOrder?.id, isChatOpen]);

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
        chatType: 'COURIER_CHAT'
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

  // Handle order status updates
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, courierId: user?.id })
      });

      if (!response.ok) throw new Error('Failed to update order status');
      await loadActiveOrders();
      Alert.alert('Success', `Order status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating order:', error);
      Alert.alert('Error', 'Failed to update order status');
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
      <View style={styles.header}>
        <Text style={styles.title}>Active Orders</Text>
      </View>

      <ScrollView
        style={styles.orderList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              loadActiveOrders();
            }}
            colors={['#2D9A63']}
          />
        }
      >
        {activeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active orders</Text>
            <Text style={styles.subText}>Pull down to refresh</Text>
          </View>
        ) : (
          activeOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              {/* Restaurant Info */}
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.restaurantName}>{order.restaurantName}</Text>
                  <Text style={styles.orderId}>Order #{order.id.slice(-6)}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  order.status === 'PICKED_UP' ? styles.pickedUpBadge :
                    order.status === 'ON_WAY' ? styles.onWayBadge :
                      styles.deliveredBadge
                ]}>
                  <Text style={styles.statusText}>{order.status}</Text>
                </View>
              </View>

              {/* Order Items */}
              <View style={styles.orderDetails}>
                {order.orderItems.map((item) => (
                  <Text key={item.id} style={styles.orderItem}>
                    {item.quantity}x {item.name}
                  </Text>
                ))}
              </View>

              {/* Customer & Delivery Info */}
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>Customer: {order.customerName}</Text>
                <View style={styles.addressContainer}>
                  <Feather name="map-pin" size={16} color="#666666" />
                  <Text style={styles.addressText}>{order.deliveryAddress}</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.orderFooter}>
                <Text style={styles.totalAmount}>${order.totalAmount.toFixed(2)}</Text>
                <View style={styles.footerActions}>
                  {order.status !== 'DELIVERED' && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        const nextStatus =
                          order.status === 'PICKED_UP' ? 'ON_WAY' :
                            order.status === 'ON_WAY' ? 'DELIVERED' :
                              order.status;
                        handleUpdateOrderStatus(order.id, nextStatus);
                      }}
                    >
                      <Text style={styles.actionButtonText}>
                        {order.status === 'PICKED_UP' ? 'Start Delivery' :
                          order.status === 'ON_WAY' ? 'Complete Delivery' :
                            'Update'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() => {
                      setSelectedOrder(order);
                      setIsChatOpen(true);
                    }}
                  >
                    <Feather name="message-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.chatButtonText}>Chat</Text>
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
                    ? styles.courierMessage
                    : styles.customerMessage
                ]}
              >
                <Text style={[
                  styles.messageText,
                  message.senderId === user?.id
                    ? styles.courierMessageText
                    : styles.customerMessageText
                ]}>
                  {message.content}
                </Text>
                <Text style={[
                  styles.messageTime,
                  message.senderId === user?.id
                    ? styles.courierMessageTime
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
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
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
  pickedUpBadge: {
    backgroundColor: '#FFB020',
  },
  onWayBadge: {
    backgroundColor: '#2D9A63',
  },
  deliveredBadge: {
    backgroundColor: '#666666',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  orderDetails: {
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
  customerInfo: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
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
  totalAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D9A63',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
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
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    color: '#FF4444',
    marginBottom: 8,
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
  courierMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF9800',
  },
  messageText: {
    fontSize: 16,
  },
  customerMessageText: {
    color: '#333333',
  },
  courierMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  customerMessageTime: {
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
    backgroundColor: '#FF9800',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});