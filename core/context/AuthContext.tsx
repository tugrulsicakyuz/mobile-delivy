import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = '@user_data';

interface UserData {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  userType: 'CUSTOMER' | 'RESTAURANT' | 'COURIER';
  vehicleInfo?: string;
  lastActive?: number;
}

interface LoginData {
  fullName: string;
  phone: string;
  address: string;
  userType: 'CUSTOMER' | 'RESTAURANT' | 'COURIER';
  vehicleInfo?: string;
}

interface AuthContextType {
  user: UserData | null;
  isLoading: boolean;
  login: (data: LoginData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

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

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem(USER_KEY);
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (data: LoginData) => {
    try {
      const userData: UserData = {
        id: Math.random().toString(36).substring(2),
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        address: data.address.trim(),
        userType: data.userType,
        vehicleInfo: data.vehicleInfo?.trim(),
        lastActive: Date.now()
      };

      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
      setUser(userData);

      // Simple routing based on user type
      if (userData.userType === 'COURIER') {
        router.push('/(courier)/courier_panel');
      } else {
        router.push('/(auth)/home');
      }

    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Failed to login');
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(USER_KEY);
      setUser(null);
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Failed to logout');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;