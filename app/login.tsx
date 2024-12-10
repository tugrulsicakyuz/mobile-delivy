// app/login.tsx
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/core/context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isRestaurant, setIsRestaurant] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!fullName.trim() || !phone.trim() || !address.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
  
    setIsLoading(true);
    try {
      console.log("Logging in with data:", {
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        userType: isRestaurant ? 'RESTAURANT' : 'CUSTOMER'
      });
  
      await login({
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        userType: isRestaurant ? 'RESTAURANT' : 'CUSTOMER'
      });
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Delivy</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={isRestaurant ? "Restaurant Name" : "Full Name"}
            value={fullName}
            onChangeText={setFullName}
            editable={!isLoading}
          />

          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!isLoading}
          />

          <TextInput
            style={[styles.input, styles.addressInput]}
            placeholder="Address"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
            editable={!isLoading}
          />

          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[
                styles.toggleButton, 
                !isRestaurant && styles.toggleButtonActive
              ]}
              onPress={() => setIsRestaurant(false)}
              disabled={isLoading}
            >
              <Text style={[
                styles.toggleText,
                !isRestaurant && styles.toggleTextActive
              ]}>Customer</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.toggleButton,
                isRestaurant && styles.toggleButtonActive
              ]}
              onPress={() => setIsRestaurant(true)}
              disabled={isLoading}
            >
              <Text style={[
                styles.toggleText,
                isRestaurant && styles.toggleTextActive
              ]}>Restaurant</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? 'Logging in...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D9A63',
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F8F8F8',
  },
  addressInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  toggleButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2D9A63',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#2D9A63',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D9A63',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  loginButton: {
    backgroundColor: '#2D9A63',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});