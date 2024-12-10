// src/core/storage/messageStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Message {
  id: string;
  orderId: string;
  content: string;
  senderId: string;
  restaurantId: string;
  isFromUser: boolean;
  senderName: string;
  isRead: boolean;
  timestamp: number;
}

const MESSAGE_KEY_PREFIX = 'messages_';

class MessageStorage {
  private getMessageKey(orderId: string): string {
    return `${MESSAGE_KEY_PREFIX}${orderId}`;
  }

  async saveMessage(messageData: Omit<Message, 'id' | 'isRead'>): Promise<Message> {
    try {
      const message: Message = {
        ...messageData,
        id: Math.random().toString(36).slice(2),
        isRead: false
      };

      const existingMessages = await this.getOrderMessages(messageData.orderId);
      existingMessages.push(message);
      
      await AsyncStorage.setItem(
        this.getMessageKey(messageData.orderId), 
        JSON.stringify(existingMessages)
      );
      
      return message;
    } catch (error) {
      console.error('Error saving message:', error);
      throw new Error('Failed to save message');
    }
  }

  async getOrderMessages(orderId: string): Promise<Message[]> {
    try {
      const messages = await AsyncStorage.getItem(this.getMessageKey(orderId));
      return messages ? JSON.parse(messages) : [];
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  async markAsRead(orderId: string, userId: string, isRestaurant: boolean = false): Promise<void> {
    try {
      const messages = await this.getOrderMessages(orderId);
      const updatedMessages = messages.map(msg => {
        if ((isRestaurant && msg.isFromUser) || (!isRestaurant && !msg.isFromUser)) {
          return { ...msg, isRead: true };
        }
        return msg;
      });
      
      await AsyncStorage.setItem(
        this.getMessageKey(orderId), 
        JSON.stringify(updatedMessages)
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw new Error('Failed to mark messages as read');
    }
  }

  async getUnreadCount(orderId: string, userId: string, isRestaurant: boolean = false): Promise<number> {
    try {
      const messages = await this.getOrderMessages(orderId);
      return messages.filter(msg => 
        !msg.isRead && 
        ((isRestaurant && msg.isFromUser) || (!isRestaurant && !msg.isFromUser))
      ).length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  async clearAllMessages(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const messageKeys = keys.filter(key => key.startsWith(MESSAGE_KEY_PREFIX));
      await AsyncStorage.multiRemove(messageKeys);
    } catch (error) {
      console.error('Error clearing messages:', error);
      throw new Error('Failed to clear messages');
    }
  }
}

export const messageStorage = new MessageStorage();