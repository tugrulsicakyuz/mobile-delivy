// src/app/(auth)/menu_management.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  Modal,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/core/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { API_URL } from '@/src/config';
// Types
interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUri?: string;
  isAvailable: boolean;
  createdAt: number;
  updatedAt: number;
}

interface MenuModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (item: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  editingItem: MenuItem | null;
}

// Menu Modal Component
const MenuItemModal = ({ visible, onClose, onSave, editingItem }: MenuModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [isAvailable, setIsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editingItem) {
        setName(editingItem.name);
        setDescription(editingItem.description);
        setPrice(editingItem.price.toString());
        setCategory(editingItem.category);
        setImageUri(editingItem.imageUri);
        setIsAvailable(editingItem.isAvailable);
      } else {
        resetForm();
      }
    }
  }, [visible, editingItem]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setCategory('');
    setImageUri(undefined);
    setIsAvailable(true);
  };

  const handleImagePick = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please enable photo library access');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
      });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || !category.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        price: priceNum,
        imageUri,
        isAvailable
      });
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error saving menu item:', error);
      Alert.alert('Error', 'Failed to save menu item');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={24} color="#2D9A63" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {editingItem ? 'Edit Item' : 'Add Item'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={isLoading}>
            <Text style={[styles.saveButton, isLoading && styles.disabledText]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.formContainer}
        >
          <ScrollView>
            <TouchableOpacity
              style={styles.imagePickerContainer}
              onPress={handleImagePick}
            >
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.itemImage}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Feather name="camera" size={32} color="#666" />
                  <Text style={styles.imagePlaceholderText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Item name"
                maxLength={50}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Item description"
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Category *</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="Item category"
                maxLength={30}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Price ($) *</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.switchContainer}>
                <Text style={styles.label}>Available</Text>
                <Switch
                  value={isAvailable}
                  onValueChange={setIsAvailable}
                  trackColor={{ false: '#767577', true: '#2D9A63' }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// Main Component
export default function MenuManagement() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user?.id) {
      router.replace('/login');
      return;
    }

    loadMenuItems();
  }, [user?.id]);

  const loadMenuItems = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const menuData = await AsyncStorage.getItem(`menu_${user.id}`);
      if (menuData) {
        setMenuItems(JSON.parse(menuData));
      }
    } catch (error) {
      console.error('Error loading menu items:', error);
      Alert.alert('Error', 'Failed to load menu items');
    } finally {
      setIsLoading(false);
    }
  };

  // Continue in the next part...
  // src/app/(auth)/menu_management.tsx (continued)

  // Helper function for filtering menu items
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Get unique categories from menu items
  const categories = ['All', ...new Set(menuItems.map(item => item.category))];

  const handleSaveMenuItem = async (itemData: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.id) return;
  
    try {
      const updatedItems = [...menuItems];
  
      if (editingItem) {
        // Update existing item
        const index = updatedItems.findIndex(item => item.id === editingItem.id);
        if (index !== -1) {
          updatedItems[index] = {
            ...editingItem,
            ...itemData,
            updatedAt: Date.now()
          };
        }
      } else {
        // Add new item
        const newItem: MenuItem = {
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          ...itemData,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        updatedItems.push(newItem);
      }
  
      // Save locally
      await AsyncStorage.setItem(`menu_${user.id}`, JSON.stringify(updatedItems));
      
      // Send to server for temporary storage
      await fetch(`${API_URL}/menus/${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: updatedItems }),
      });
  
      setMenuItems(updatedItems);
      Alert.alert('Success', `Item ${editingItem ? 'updated' : 'added'} successfully`);
    } catch (error) {
      console.error('Error saving menu item:', error);
      throw new Error('Failed to save menu item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!user?.id) return;

    try {
      const updatedItems = menuItems.filter(item => item.id !== itemId);
      await AsyncStorage.setItem(`menu_${user.id}`, JSON.stringify(updatedItems));
      setMenuItems(updatedItems);
      Alert.alert('Success', 'Item deleted successfully');
    } catch (error) {
      console.error('Error deleting menu item:', error);
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const handleToggleAvailability = async (itemId: string, newValue: boolean) => {
    if (!user?.id) return;

    try {
      const updatedItems = menuItems.map(item =>
        item.id === itemId
          ? { ...item, isAvailable: newValue, updatedAt: Date.now() }
          : item
      );
      await AsyncStorage.setItem(`menu_${user.id}`, JSON.stringify(updatedItems));
      setMenuItems(updatedItems);
    } catch (error) {
      console.error('Error updating item availability:', error);
      Alert.alert('Error', 'Failed to update item availability');
    }
  };

  if (!user || user.userType !== 'RESTAURANT') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.subText}>Only restaurant accounts can access menu management</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu Management</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setEditingItem(null);
            setIsModalVisible(true);
          }}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search menu items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={styles.categoryScroll}
>
  {categories.map((category) => (
    <TouchableOpacity
      key={category}
      style={[
        styles.categoryButton,
        selectedCategory === category && styles.categoryButtonActive
      ]}
      onPress={() => setSelectedCategory(category)}
    >
      <Text style={[
        styles.categoryText,
        selectedCategory === category && styles.categoryButtonTextActive
      ]}>
        {category}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>

      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2D9A63" />
        </View>
      ) : (
        <ScrollView style={styles.menuList}>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No menu items found</Text>
              <Text style={styles.emptySubText}>
                {searchQuery ? 'Try a different search term' : 'Add your first menu item'}
              </Text>
            </View>
          ) : (
            filteredItems.map((item) => (
              <View key={item.id} style={styles.menuItem}>
                <View style={styles.menuItemContent}>
                  {item.imageUri && (
                    <Image
                      source={{ uri: item.imageUri }}
                      style={styles.menuItemImage}
                    />
                  )}
                  <View style={styles.menuItemDetails}>
                    <View style={styles.menuItemHeader}>
                      <Text style={styles.menuItemName}>{item.name}</Text>
                      <Switch
                        value={item.isAvailable}
                        onValueChange={(value) => handleToggleAvailability(item.id, value)}
                        trackColor={{ false: '#767577', true: '#2D9A63' }}
                        thumbColor="#f4f3f4"
                      />
                    </View>
                    <Text style={styles.menuItemCategory}>{item.category}</Text>
                    <Text style={styles.menuItemDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.menuItemActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      setEditingItem(item);
                      setIsModalVisible(true);
                    }}
                  >
                    <Feather name="edit-2" size={20} color="#2D9A63" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      Alert.alert(
                        'Delete Item',
                        'Are you sure you want to delete this item?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => handleDeleteItem(item.id)
                          }
                        ]
                      );
                    }}
                  >
                    <Feather name="trash-2" size={20} color="#FF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <MenuItemModal
        visible={isModalVisible}
        onClose={() => {
          setIsModalVisible(false);
          setEditingItem(null);
        }}
        onSave={handleSaveMenuItem}
        editingItem={editingItem}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D9A63',
  },
  addButton: {
    backgroundColor: '#2D9A63',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryScroll: {
    maxHeight: 50,  // Add this
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    height: 36,  // Add this
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryButtonActive: {
    backgroundColor: '#2D9A63',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  menuList: {
    flex: 1,
  },
  menuItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  menuItemDetails: {
    flex: 1,
  },
  menuItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemName: {
    fontSize: 18,
    fontWeight: '600',
  },
  menuItemCategory: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  menuItemDescription: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D9A63',
    marginTop: 8,
  },
  menuItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
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
  saveButton: {
    color: '#2D9A63',
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    flex: 1,
  },
  formGroup: {
    margin: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  imagePickerContainer: {
    margin: 16,
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: '#666666',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#FF4444',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#666666',
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
  emptySubText: {
    fontSize: 14,
    color: '#999999',
  },
  disabledText: {
    opacity: 0.5,
  },
});