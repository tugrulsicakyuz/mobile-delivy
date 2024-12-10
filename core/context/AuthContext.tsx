import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/src/config';
interface UserData {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  userType: 'CUSTOMER' | 'RESTAURANT';
  lastActive?: number;
}

interface AuthContextType {
  user: UserData | null;
  isLoading: boolean;
  login: (data: LoginData) => Promise<void>;
  logout: () => Promise<void>;
}

interface LoginData {
  fullName: string;
  phone: string;
  address: string;
  userType: 'CUSTOMER' | 'RESTAURANT';
}

const USER_KEY = '@user_data';

// Create the context
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {}
});

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const login = async (data: LoginData) => {
    try {
      console.log("AuthContext: Creating user with data:", data);
      
      // Clear previous data
      await AsyncStorage.clear();
  
      // Create user data
      const userData: UserData = {
        id: Math.random().toString(36).substring(2),
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        address: data.address.trim(),
        userType: data.userType,
        lastActive: Date.now()
      };
  
      console.log("AuthContext: Generated user data:", userData);
  
      // Save to storage
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
      
      // Update state
      setUser(userData);
  
      // After setting user, create restaurant if needed
      if (data.userType === 'RESTAURANT') {
        console.log("AuthContext: Creating restaurant profile");
        try {
          const formData = new FormData();
          formData.append('id', userData.id);
          formData.append('name', userData.fullName);
          formData.append('isActive', 'false');
  
          const response = await fetch(`${API_URL}/restaurants`, {
            method: 'POST',
            body: formData
          });
  
          console.log("AuthContext: Restaurant creation response:", response.status);
          
          if (!response.ok) {
            throw new Error('Failed to create restaurant profile');
          }
        } catch (error) {
          console.error("AuthContext: Restaurant creation error:", error);
          // Don't throw error here, let the login complete
        }
      }
  
      // Navigate to home
      router.replace('/(auth)/home');
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Failed to login');
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.clear();
      setUser(null);
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Failed to logout');
    }
  };

  // Load user on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem(USER_KEY);
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (error) {
        console.error('Load user error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;