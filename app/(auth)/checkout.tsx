import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/core/context/AuthContext';
import { API_URL } from '@/src/config';
import { StyleSheet } from 'react-native';
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId: string;
  restaurantName: string;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [address, setAddress] = useState(user?.address || '');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  useEffect(() => {
    loadCartItems();
  }, []);

  const loadCartItems = async () => {
    try {
      const cartData = await AsyncStorage.getItem('cartItems');
      if (cartData) {
        setCartItems(JSON.parse(cartData));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      Alert.alert('Error', 'Failed to load cart items');
    }
  };

  const getTotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const DeliveryStep = () => (
    <ScrollView style={styles.stepContent}>
      <Text style={styles.sectionTitle}>Delivery Address</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="Enter your delivery address"
        multiline
        keyboardType="default"
        returnKeyType="next"
      />

      <Text style={styles.sectionTitle}>Additional Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={additionalNotes}
        onChangeText={setAdditionalNotes}
        placeholder="Add notes for delivery (optional)"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        keyboardType="default"
      />

      <TouchableOpacity
        style={styles.continueButton}
        onPress={() => setCurrentStep(2)}
      >
        <Text style={styles.continueButtonText}>Continue to Payment</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const PaymentStep = () => (
    <ScrollView style={styles.stepContent}>
      <Text style={styles.sectionTitle}>Card Details</Text>
      <TextInput
        style={styles.input}
        value={cardholderName}
        onChangeText={setCardholderName}
        placeholder="Cardholder Name"
      />

      <TextInput
        style={styles.input}
        value={cardNumber}
        onChangeText={(text) => setCardNumber(text.replace(/\D/g, '').slice(0, 16))}
        placeholder="Card Number"
        keyboardType="numeric"
        maxLength={16}
      />

      <View style={styles.rowInputs}>
        <View style={styles.halfInput}>
          <TextInput
            style={styles.input}
            value={expiryDate}
            onChangeText={setExpiryDate}
            placeholder="MM/YY"
            maxLength={5}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.halfInput}>
          <TextInput
            style={styles.input}
            value={cvv}
            onChangeText={(text) => setCvv(text.replace(/\D/g, '').slice(0, 3))}
            placeholder="CVV"
            keyboardType="numeric"
            maxLength={3}
            secureTextEntry
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.continueButton}
        onPress={() => setCurrentStep(3)}
      >
        <Text style={styles.continueButtonText}>Review Order</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const SummaryStep = () => (
    <ScrollView style={styles.stepContent}>
      <Text style={styles.sectionTitle}>Order Summary</Text>

      {cartItems.map((item, index) => (
        <View key={`${item.id}-${index}`} style={styles.summaryItem}>
          <View style={styles.summaryItemInfo}>
            <Text style={styles.summaryItemQuantity}>{item.quantity}x</Text>
            <Text style={styles.summaryItemName}>{item.name}</Text>
          </View>
          <Text style={styles.summaryItemPrice}>
            ${(item.price * item.quantity).toFixed(2)}
          </Text>
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Delivery</Text>
        <Text style={styles.freeDelivery}>Free</Text>
      </View>

      <View style={[styles.summaryRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>${getTotal().toFixed(2)}</Text>
      </View>

      <TouchableOpacity
        style={[styles.placeOrderButton, isLoading && styles.buttonDisabled]}
        onPress={handlePlaceOrder}
        disabled={isLoading}
      >
        <Text style={styles.placeOrderButtonText}>
          {isLoading ? 'Placing Order...' : 'Place Order'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const handlePlaceOrder = async () => {
    if (!user) {
      Alert.alert('Error', 'Please log in to place an order');
      return;
    }
  
    if (cartItems.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }
  
    setIsLoading(true);
    try {
      const order = {
        id: Math.random().toString(36).substring(7),
        userId: user.id,
        customerName: user.fullName,
        restaurantId: cartItems[0].restaurantId,
        restaurantName: cartItems[0].restaurantName,
        status: 'PENDING' as const,
        totalAmount: getTotal(),
        orderItems: cartItems.map(item => ({
          id: Math.random().toString(36).substring(7),
          menuItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        createdAt: Date.now()
      };
  
      const orderResponse = await fetch(`${API_URL}/orders/${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orders: [order] }),
      });
  
      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }
  
      await AsyncStorage.removeItem('cartItems');
  
      await fetch(`${API_URL}/messages/${order.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: Math.random().toString(36).slice(2),
          orderId: order.id,
          content: `New Order:\n${cartItems.map(item =>
            `${item.quantity}x ${item.name}`
          ).join('\n')}\n\nTotal: $${getTotal().toFixed(2)}`,
          senderId: user.id,
          isFromUser: true,
          timestamp: Date.now(),
          chatType: 'RESTAURANT_CHAT'
        })
      });
  
      router.push('/orders');
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const steps = ['Delivery', 'Payment', 'Summary'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#2D9A63" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <View key={`step-${index}`} style={styles.stepWrapper}>
            <View style={[styles.stepCircle, currentStep >= index + 1 && styles.activeStep]}>
              <Text style={[styles.stepNumber, currentStep >= index + 1 && styles.activeStepText]}>
                {index + 1}
              </Text>
            </View>
            <Text style={styles.stepLabel}>{step}</Text>
            {index < steps.length - 1 && (
              <View style={[styles.stepLine, currentStep > index + 1 && styles.activeStepLine]} />
            )}
          </View>
        ))}
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        {currentStep === 1 && <DeliveryStep />}
        {currentStep === 2 && <PaymentStep />}
        {currentStep === 3 && <SummaryStep />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D9A63',
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  stepWrapper: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeStep: {
    backgroundColor: '#2D9A63',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666666',
  },
  activeStepText: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 8,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 8,
  },
  activeStepLine: {
    backgroundColor: '#2D9A63',
  },
  stepContent: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F8F8F8',
    marginBottom: 20,
    color: '#333333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
    minHeight: 100,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  summaryItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  summaryItemQuantity: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D9A63',
    marginRight: 8,
    width: 30,
  },
  summaryItemName: {
    fontSize: 16,
    color: '#333333',
    flex: 1,
  },
  summaryItemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666666',
  },
  freeDelivery: {
    fontSize: 14,
    color: '#2D9A63',
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D9A63',
  },
  continueButton: {
    backgroundColor: '#2D9A63',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  placeOrderButton: {
    backgroundColor: '#2D9A63',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  placeOrderButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 8,
  }
});