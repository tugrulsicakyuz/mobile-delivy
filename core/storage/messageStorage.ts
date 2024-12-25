// src/core/storage/messageStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Message {
  id: string;
  orderId: string;
  content: string;
  senderId: string;
  isFromUser: boolean;
  timestamp: number;
  chatType: 'RESTAURANT_CHAT' | 'COURIER_CHAT';
}

const MESSAGE_KEY_PREFIX = 'messages_';

class MessageStorage {
  private getMessageKey(orderId: string, chatType: 'RESTAURANT_CHAT' | 'COURIER_CHAT'): string {
    return `${MESSAGE_KEY_PREFIX}${orderId}_${chatType}`;
  }

  async saveMessage(messageData: Omit<Message, 'id'>): Promise<Message> {
    try {
      const message: Message = {
        ...messageData,
        id: Math.random().toString(36).slice(2),
      };

      const existingMessages = await this.getOrderMessages(messageData.orderId, messageData.chatType);
      existingMessages.push(message);
      
      await AsyncStorage.setItem(
        this.getMessageKey(messageData.orderId, messageData.chatType), 
        JSON.stringify(existingMessages)
      );
      
      return message;
    } catch (error) {
      console.error('Error saving message:', error);
      throw new Error('Failed to save message');
    }
  }

  async getOrderMessages(orderId: string, chatType: 'RESTAURANT_CHAT' | 'COURIER_CHAT'): Promise<Message[]> {
    try {
      const messages = await AsyncStorage.getItem(this.getMessageKey(orderId, chatType));
      if (!messages) return [];

      const parsedMessages = JSON.parse(messages) as Message[];
      
      // Filter out messages older than 3 hours
      const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
      const recentMessages = parsedMessages.filter(msg => msg.timestamp > threeHoursAgo);

      // If we filtered out any messages, update storage
      if (recentMessages.length !== parsedMessages.length) {
        await AsyncStorage.setItem(
          this.getMessageKey(orderId, chatType),
          JSON.stringify(recentMessages)
        );
      }

      return recentMessages;
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  async deleteOrderMessages(orderId: string, chatType: 'RESTAURANT_CHAT' | 'COURIER_CHAT'): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.getMessageKey(orderId, chatType));
    } catch (error) {
      console.error('Error deleting messages:', error);
      throw new Error('Failed to delete messages');
    }
  }

  async getUnreadCount(
    orderId: string,
    userId: string,
    chatType: 'RESTAURANT_CHAT' | 'COURIER_CHAT'
  ): Promise<number> {
    try {
      const messages = await this.getOrderMessages(orderId, chatType);
      return messages.filter(msg => 
        !msg.isFromUser && msg.senderId !== userId
      ).length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  async markAllAsRead(
    orderId: string,
    userId: string,
    chatType: 'RESTAURANT_CHAT' | 'COURIER_CHAT'
  ): Promise<void> {
    try {
      const messages = await this.getOrderMessages(orderId, chatType);
      const updatedMessages = messages.map(msg => ({
        ...msg,
        isRead: true
      }));

      await AsyncStorage.setItem(
        this.getMessageKey(orderId, chatType),
        JSON.stringify(updatedMessages)
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw new Error('Failed to mark messages as read');
    }
  }

  async clearChatHistory(orderId: string, chatType: 'RESTAURANT_CHAT' | 'COURIER_CHAT'): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.getMessageKey(orderId, chatType));
    } catch (error) {
      console.error('Error clearing chat history:', error);
      throw new Error('Failed to clear chat history');
    }
  }

  async clearAllChats(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const messageKeys = keys.filter(key => key.startsWith(MESSAGE_KEY_PREFIX));
      await AsyncStorage.multiRemove(messageKeys);
    } catch (error) {
      console.error('Error clearing all chats:', error);
      throw new Error('Failed to clear all chats');
    }
  }

  async exportChatHistory(orderId: string, chatType: 'RESTAURANT_CHAT' | 'COURIER_CHAT'): Promise<string> {
    try {
      const messages = await this.getOrderMessages(orderId, chatType);
      return messages.map(msg => 
        `[${new Date(msg.timestamp).toLocaleString()}] ${msg.isFromUser ? 'You' : 'Other'}: ${msg.content}`
      ).join('\n');
    } catch (error) {
      console.error('Error exporting chat history:', error);
      throw new Error('Failed to export chat history');
    }
  }
}

export const messageStorage = new MessageStorage();