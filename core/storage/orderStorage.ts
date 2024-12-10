// src/core/storage/orderStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface Order {
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

const ORDER_KEY_PREFIX = 'order_';

class OrderStorage {
  private getOrderKey(orderId: string): string {
    return `${ORDER_KEY_PREFIX}${orderId}`;
  }

  async createOrder(orderData: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    try {
      const order: Order = {
        ...orderData,
        id: Math.random().toString(36).slice(2),
        createdAt: Date.now()
      };

      await AsyncStorage.setItem(
        this.getOrderKey(order.id),
        JSON.stringify(order)
      );

      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw new Error('Failed to create order');
    }
  }

  async getOrders(userId: string, isRestaurant: boolean = false): Promise<Order[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const orderKeys = keys.filter(key => key.startsWith(ORDER_KEY_PREFIX));
      const orders = await AsyncStorage.multiGet(orderKeys);
      
      return orders
        .map(([_, value]) => value ? JSON.parse(value) : null)
        .filter((order): order is Order => 
          order !== null && 
          (isRestaurant ? order.restaurantId === userId : order.userId === userId)
        )
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error getting orders:', error);
      return [];
    }
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<boolean> {
    try {
      const orderData = await AsyncStorage.getItem(this.getOrderKey(orderId));
      if (!orderData) return false;

      const order = JSON.parse(orderData);
      const updatedOrder = { ...order, status };
      
      await AsyncStorage.setItem(
        this.getOrderKey(orderId),
        JSON.stringify(updatedOrder)
      );
      
      return true;
    } catch (error) {
      console.error('Error updating order status:', error);
      return false;
    }
  }

  async getActiveOrders(userId: string, isRestaurant: boolean = false): Promise<Order[]> {
    try {
      const orders = await this.getOrders(userId, isRestaurant);
      return orders.filter(order => 
        order.status !== 'DELIVERED' && 
        order.status !== 'CANCELLED'
      );
    } catch (error) {
      console.error('Error getting active orders:', error);
      return [];
    }
  }

  async clearAllOrders(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const orderKeys = keys.filter(key => key.startsWith(ORDER_KEY_PREFIX));
      await AsyncStorage.multiRemove(orderKeys);
    } catch (error) {
      console.error('Error clearing orders:', error);
      throw new Error('Failed to clear orders');
    }
  }
}

export const orderStorage = new OrderStorage();