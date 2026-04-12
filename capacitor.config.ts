import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.joniah.pharmacy.delivery',
  appName: 'جونيا للتوصيل',
  webDir: 'dist/public',
  bundledWebRuntime: false,

  server: {
    androidScheme: 'https',
    url: process.env.VITE_API_URL || 'https://joniah.xyz',
    cleartext: process.env.NODE_ENV === 'development',
    errorPath: '/offline.html',
  },

  plugins: {
    // Push Notifications - Firebase Cloud Messaging
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
      permissions: ['android.permission.POST_NOTIFICATIONS'],
    },

    // Geolocation - Real-time tracking
    Geolocation: {
      permissions: [
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
      ],
    },

    // Background Geolocation - Track even when app is closed
    BackgroundGeolocation: {
      locationProvider: 'HIGH_ACCURACY',
      desiredAccuracy: 10, // meters
      stationaryRadius: 50,
      distanceFilter: 10,
      interval: 30000, // 30 seconds
      fastestInterval: 10000, // 10 seconds
      activitiesInterval: 10000,
      stopOnStillActivity: false,
      startOnBoot: true,
      startForeground: true,
      preventSuspend: true,

      // Notification configuration
      notificationTitle: 'Joniah Delivery Tracking',
      notificationText: 'جاري تتبع موقعك - Sharing your location',
      notificationColor: '#FF6B35',
      notificationIconColor: '#FF6B35',
      notificationIconLarge: 'ic_launcher',
      notificationIconSmall: 'ic_launcher',
    },

    // Local Notifications
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#FF6B35',
      permissions: ['android.permission.POST_NOTIFICATIONS'],
    },

    // Splash Screen
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FF6B35',
      androidSplashResourceName: 'splash',
      showSpinner: true,
      spinnerColor: '#ffffff',
    },

    // Capacitor HTTP for network requests
    CapacitorHttp: {
      enabled: true,
    },

    // Cookies
    CapacitorCookies: {
      enabled: true,
    },
  },

  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystorePassword: undefined,
      keystoreAliasPassword: undefined,
      signingType: 'apksigner',
    },
    allowMixedContent: process.env.NODE_ENV === 'development',
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV === 'development',
    useLegacyBridge: false,
    loggingBehavior: 'none',
  },
};

export default config;
