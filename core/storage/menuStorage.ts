// src/core/storage/menuStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUri?: string;
}

const MENU_KEY_PREFIX = 'menu_';
const TEMP_MENU_PREFIX = 'menu_temp_';

class MenuStorage {
  async storeMenu(restaurantId: string, menuItems: MenuItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${MENU_KEY_PREFIX}${restaurantId}`, 
        JSON.stringify(menuItems)
      );
    } catch (error) {
      console.error('Error storing menu:', error);
      throw new Error('Failed to store menu');
    }
  }

  async getMenu(restaurantId: string): Promise<MenuItem[]> {
    try {
      const menuData = await AsyncStorage.getItem(`${MENU_KEY_PREFIX}${restaurantId}`);
      return menuData ? JSON.parse(menuData) : [];
    } catch (error) {
      console.error('Error getting menu:', error);
      return [];
    }
  }

  async storeTempMenu(restaurantId: string, menuItems: MenuItem[]): Promise<void> {
    try {
      const tempMenuData = {
        items: menuItems,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(
        `${TEMP_MENU_PREFIX}${restaurantId}`, 
        JSON.stringify(tempMenuData)
      );
    } catch (error) {
      console.error('Error storing temporary menu:', error);
      throw new Error('Failed to store temporary menu');
    }
  }

  async getTempMenu(restaurantId: string): Promise<MenuItem[]> {
    try {
      const menuData = await AsyncStorage.getItem(`${TEMP_MENU_PREFIX}${restaurantId}`);
      if (!menuData) return [];
      
      const tempMenu = JSON.parse(menuData);
      // If menu is older than 24 hours, clear it and return empty
      if (Date.now() - tempMenu.timestamp > 24 * 60 * 60 * 1000) {
        await this.clearTempMenu(restaurantId);
        return [];
      }
      return tempMenu.items;
    } catch (error) {
      console.error('Error getting temporary menu:', error);
      return [];
    }
  }

  async clearTempMenu(restaurantId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${TEMP_MENU_PREFIX}${restaurantId}`);
    } catch (error) {
      console.error('Error clearing temporary menu:', error);
    }
  }

  async clearAllMenus(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const menuKeys = keys.filter(key => 
        key.startsWith(MENU_KEY_PREFIX) || 
        key.startsWith(TEMP_MENU_PREFIX)
      );
      await AsyncStorage.multiRemove(menuKeys);
    } catch (error) {
      console.error('Error clearing menus:', error);
      throw new Error('Failed to clear menus');
    }
  }
}

export const menuStorage = new MenuStorage();