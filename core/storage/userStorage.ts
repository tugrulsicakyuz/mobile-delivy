import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = '@user_data';

export interface UserData {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  userType: 'CUSTOMER' | 'RESTAURANT';
  lastActive?: number;
}

export const storeUser = async (userData: UserData): Promise<void> => {
  try {
    const data = {
      ...userData,
      lastActive: Date.now()
    };
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Store user error:', error);
    throw new Error('Failed to save user data');
  }
};

export const getUser = async (): Promise<UserData | null> => {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    if (!data) return null;
    
    const userData = JSON.parse(data) as UserData;
    // Update last active timestamp
    if (userData) {
      userData.lastActive = Date.now();
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
    }
    return userData;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
};

export const clearUser = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USER_KEY);
    // Clear any other user-related data
    const keys = await AsyncStorage.getAllKeys();
    const userDataKeys = keys.filter(key => 
      key.startsWith('orders_') || 
      key.startsWith('menu_') || 
      key.startsWith('messages_')
    );
    if (userDataKeys.length > 0) {
      await AsyncStorage.multiRemove(userDataKeys);
    }
  } catch (error) {
    console.error('Clear user error:', error);
    throw new Error('Failed to clear user data');
  }
};

export const updateUserData = async (updates: Partial<UserData>): Promise<void> => {
  try {
    const currentUser = await getUser();
    if (!currentUser) throw new Error('No user found');

    const updatedUser = {
      ...currentUser,
      ...updates,
      lastActive: Date.now()
    };
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  } catch (error) {
    console.error('Update user error:', error);
    throw new Error('Failed to update user data');
  }
};