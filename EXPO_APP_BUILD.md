# جونيا - تطبيق Expo React Native كامل 🚀

## 📱 بناء تطبيق الديليفري مع Expo

هذا الدليل لبناء تطبيق Expo React Native جاهز للنشر على iOS و Android.

---

## ✅ **الخطوة 1: إنشاء مشروع Expo**

```bash
cd "E:/مشروع جونيا"
npx create-expo-app joniah-delivery
cd joniah-delivery
```

---

## 📦 **الخطوة 2: تثبيت المكتبات المطلوبة**

```bash
npm install expo-location
npm install expo-notifications
npm install expo-task-manager
npm install @react-native-async-storage/async-storage
npm install react-native-maps expo-maps
npm install axios
npm install @react-native-community/hooks
npm install react-native-vector-icons
npm install react-native-gesture-handler
npm install react-native-reanimated
npm install @react-navigation/native
npm install @react-navigation/bottom-tabs
npm install @react-navigation/stack
npm install react-native-screens
npm install react-native-safe-area-context
npm install react-native-tab-view
npm install react-native-pager-view
```

---

## 🔧 **الخطوة 3: تكوين الأذونات**

عدّل `app.json`:

```json
{
  "expo": {
    "name": "جونيا للتوصيل",
    "slug": "joniah-delivery",
    "version": "1.0.0",
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTabletMode": true,
      "usesIcloudStorage": false,
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "نحتاج موقعك لتتبع التوصيلات",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "نحتاج موقعك لتتبع التوصيلات دائماً"
      }
    },
    "android": {
      "permissions": [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.POST_NOTIFICATIONS"
      ],
      "usesPermission": [
        {
          "name": "android.permission.ACCESS_FINE_LOCATION",
          "maxSdkVersion": 32
        }
      ]
    },
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow جونيا to access your location."
        }
      ],
      [
        "expo-notifications",
        {
          "sounds": ["default"]
        }
      ]
    ]
  }
}
```

---

## 📍 **الخطوة 4: خدمة تتبع الموقع**

أنشئ `src/services/locationService.ts`:

```typescript
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const LOCATION_TASK_NAME = 'background-location-task';
const API_URL = process.env.REACT_APP_API_URL || 'https://api.railway.app';

// تتبع الموقع في الخلفية
export async function startLocationTracking(userId: number) {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    await Location.requestBackgroundPermissionsAsync();

    // بدء المراقبة
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 30000, // 30 ثانية
      distanceInterval: 10, // 10 متر
      showsBackgroundLocationIndicator: true,
    });

    console.log('✅ تتبع الموقع بدأ');
  } catch (error) {
    console.error('خطأ في تتبع الموقع:', error);
  }
}

// إيقاف التتبع
export async function stopLocationTracking() {
  try {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log('✅ تتبع الموقع توقف');
  } catch (error) {
    console.error('خطأ في إيقاف التتبع:', error);
  }
}

// معالجة تحديثات الموقع في الخلفية
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('خطأ في التتبع:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];

    // إرسال الموقع للخادم
    try {
      const token = await AsyncStorage.getItem('authToken');
      await axios.post(`${API_URL}/api/deliveries/location`, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('📍 تم إرسال الموقع');
    } catch (error) {
      console.error('خطأ في إرسال الموقع:', error);
    }
  }
});
```

---

## 🔔 **الخطوة 5: خدمة الإشعارات**

أنشئ `src/services/notificationService.ts`:

```typescript
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://api.railway.app';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('لم يتم الموافقة على الإشعارات');
      return;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    // حفظ التوكن في الخادم
    const authToken = await AsyncStorage.getItem('authToken');
    await axios.post(`${API_URL}/api/notifications/register-token`, {
      expoPushToken: token,
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    console.log('✅ تم تسجيل الإشعارات:', token);
  } catch (error) {
    console.error('خطأ في تسجيل الإشعارات:', error);
  }
}

export async function listenForNotifications() {
  // الإشعارات الواردة
  Notifications.addNotificationReceivedListener(notification => {
    console.log('📬 إشعار وارد:', notification);
  });

  // عندما تضغط على الإشعار
  Notifications.addNotificationResponseReceivedListener(response => {
    const { orderId } = response.notification.request.content.data;
    if (orderId) {
      // انتقل لتفاصيل الطلب
      console.log('🎯 انتقل للطلب:', orderId);
    }
  });
}
```

---

## 🎨 **الخطوة 6: الشاشات الرئيسية**

### شاشة تسجيل الدخول - `src/screens/LoginScreen.tsx`

```typescript
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('خطأ', 'أدخل البريد والكلمة');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        'https://api.railway.app/api/auth/login',
        { email, password }
      );

      await AsyncStorage.setItem('authToken', response.data.token);
      navigation.replace('Home');
    } catch (error) {
      Alert.alert('خطأ', 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚚 جونيا</Text>

      <TextInput
        style={styles.input}
        placeholder="البريد الإلكتروني"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="الكلمة"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'جاري الدخول...' : 'دخول'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FF6B35',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
```

### شاشة الطلبات - `src/screens/OrdersScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = 'https://api.railway.app';

export default function OrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/api/deliveries/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data);
    } catch (error) {
      console.error('خطأ في جلب الطلبات:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // كل 30 ثانية
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchOrders} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <Text style={styles.customerName}>{item.customerName}</Text>
              <Text style={[styles.status, getStatusStyle(item.status)]}>
                {getStatusText(item.status)}
              </Text>
            </View>
            <Text style={styles.address}>{item.address}</Text>
            <Text style={styles.items}>{item.itemCount} منتج</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function getStatusText(status: string) {
  const statuses: Record<string, string> = {
    pending: 'في الانتظار',
    assigned: 'معك الآن',
    picked_up: 'تم الاستلام',
    in_delivery: 'جاري التوصيل',
    delivered: 'تم التوصيل',
  };
  return statuses[status] || status;
}

function getStatusStyle(status: string) {
  const colors: Record<string, any> = {
    pending: { backgroundColor: '#FFA500' },
    assigned: { backgroundColor: '#4285F4' },
    picked_up: { backgroundColor: '#34A853' },
    in_delivery: { backgroundColor: '#FBBC04' },
    delivered: { backgroundColor: '#5F6368' },
  };
  return colors[status] || {};
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  orderCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  status: {
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    fontSize: 12,
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  items: {
    fontSize: 12,
    color: '#999',
  },
});
```

### شاشة الخريطة - `src/screens/MapScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

export default function MapScreen() {
  const [location, setLocation] = useState<any>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    const { coords } = await Location.getCurrentPositionAsync();
    setLocation(coords);
  };

  if (!location) return <View style={styles.container} />;

  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }}
    >
      <Marker
        coordinate={{
          latitude: location.latitude,
          longitude: location.longitude,
        }}
        title="موقعك"
        description="أنت هنا"
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
```

---

## 🚀 **الخطوة 7: التطبيق الرئيسي**

أنشئ `App.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import LoginScreen from './src/screens/LoginScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import MapScreen from './src/screens/MapScreen';
import ProfileScreen from './src/screens/ProfileScreen';

import {
  registerForPushNotifications,
  listenForNotifications,
} from './src/services/notificationService';
import { startLocationTracking } from './src/services/locationService';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function DeliveryTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'home';

          if (route.name === 'Orders') {
            iconName = 'clipboard-list';
          } else if (route.name === 'Map') {
            iconName = 'map';
          } else if (route.name === 'Profile') {
            iconName = 'account';
          }

          return (
            <MaterialCommunityIcons name={iconName} size={size} color={color} />
          );
        },
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#999',
      })}
    >
      <Tab.Screen name="Orders" component={OrdersScreen} options={{title: 'الطلبات'}} />
      <Tab.Screen name="Map" component={MapScreen} options={{title: 'الخريطة'}} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{title: 'حسابي'}} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLoginStatus();
    registerForPushNotifications();
    listenForNotifications();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        setIsLoggedIn(true);
        startLocationTracking(1); // رقم المستخدم
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <Stack.Screen name="Home" component={DeliveryTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## ▶️ **تشغيل التطبيق**

```bash
npm start

# ثم اختر:
# - الضغط على 'w' لـ web
# - الضغط على 'a' لـ Android (يحتاج emulator)
# - الضغط على 'i' لـ iOS (يحتاج Mac)

# أو استخدم Expo Go app على هاتفك
```

---

## 📦 **بناء APK للنشر على Play Store**

```bash
eas build -p android --release
```

---

هل تريد مساعدة في أي خطوة؟ 👇
