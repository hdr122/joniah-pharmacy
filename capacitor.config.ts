import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.joniah.delivery',
  appName: 'جونيا للتوصيل',
  webDir: 'client/dist',
  server: {
    // Connect to the production server
    url: 'https://joniah.xyz',
    cleartext: false,
    androidScheme: 'https',
    // تحسين الاتصال
    errorPath: '/offline.html',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Geolocation: {
      // Request background location permission
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#10b981",
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#10b981",
      androidSplashResourceName: "splash",
      showSpinner: true,
      spinnerColor: "#ffffff",
    },
    CapacitorHttp: {
      enabled: true,
    },
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
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false, // تعطيل التصحيح للإنتاج
    // تحسين الأداء
    useLegacyBridge: false,
    loggingBehavior: 'none',
  },
};

export default config;
