# Joniah Pharmacy - Native Android App Development Guide

## 📱 Overview

This guide covers building and deploying the native Android delivery tracking app using Capacitor, which bridges the web app to native Android capabilities.

## 🛠️ Prerequisites

### Software Requirements
- Node.js 18+ and pnpm
- Java Development Kit (JDK) 11+
- Android SDK (API 29+)
- Android Studio (optional but recommended)
- Capacitor CLI

### System Requirements
- Windows, macOS, or Linux
- At least 5GB free disk space
- Android emulator or physical device

## 📦 Installation & Setup

### 1. Install Capacitor CLI

```bash
npm install -g @capacitor/cli
# or
pnpm add -g @capacitor/cli
```

### 2. Initialize Capacitor in Project

The project already has Capacitor configured, but verify:

```bash
cd "E:/مشروع جونيا/joniah_pharmacy"
ls -la | grep capacitor
# Should show: package.json contains @capacitor/android, @capacitor/core, etc.
```

### 3. Build Web Assets

```bash
# Build the React frontend
pnpm run build

# This creates dist/public with optimized web assets
```

### 4. Configure Capacitor Android

Edit `capacitor.config.ts` (or create if missing):

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.joniah.pharmacy.delivery',
  appName: 'Joniah Delivery',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    url: 'https://[your-railway-url].up.railway.app', // For production
    // For local development:
    // url: 'http://[your-local-ip]:3000',
  },
  plugins: {
    Geolocation: {
      permissions: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION']
    },
    BackgroundGeolocation: {
      locationProvider: 'HIGH_ACCURACY',
      minNotificationPriority: 'PRIORITY_HIGH'
    },
    LocalNotifications: {
      permissions: ['android.permission.POST_NOTIFICATIONS']
    }
  }
};

export default config;
```

### 5. Create Android Project

```bash
# Generate Android native project
npx cap add android

# This creates android/ folder with native Android code
```

### 6. Sync Web Assets to Android

```bash
# Copy updated web assets to Android app
npx cap sync android

# Update Android dependencies
npx cap copy android
```

## 🔨 Building the App

### Option A: Using Android Studio (Recommended)

1. **Open in Android Studio**
   ```bash
   npx cap open android
   ```
   
   This opens the Android project in Android Studio

2. **Wait for Gradle sync** (first time may take 5-10 minutes)
   - Android Studio will download necessary dependencies

3. **Build APK**
   - Menu: Build → Build Bundles/APK → Build APK
   - Or use keyboard shortcut: Ctrl+F9

4. **Run on Emulator/Device**
   - Select device in top toolbar
   - Click "Run" button (green play icon)
   - Or press Shift+F10

### Option B: Using Command Line

```bash
# Build APK using Gradle
cd android
./gradlew build

# Build debug APK
./gradlew assembleDebug

# Build release APK (requires signing)
./gradlew assembleRelease

# Run on connected device/emulator
./gradlew installDebug
adb shell am start -n com.joniah.pharmacy.delivery/.MainActivity
```

## 📋 Android Manifest Configuration

The Android app needs proper permissions. Edit `android/app/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.joniah.pharmacy.delivery">

    <!-- Location Permissions -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

    <!-- Network -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Notifications -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- Background Execution -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- Camera (optional, for delivery proof photos) -->
    <uses-permission android:name="android.permission.CAMERA" />

    <!-- Storage (optional) -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

    <application>
        <!-- Activities, Services, etc. will be auto-configured by Capacitor -->
    </application>

</manifest>
```

## 🎨 Custom Branding

### App Icon

1. Prepare icons:
   - 192x192 PNG image for launcher icon
   - Place at `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`
   - Create other densities (ldpi, mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)

2. Update all density folders with appropriately sized icons

### App Name

Edit `android/app/src/main/res/values/strings.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Joniah Delivery</string>
    <string name="title_activity_main">Joniah Delivery Tracking</string>
</resources>
```

### App Theme

Edit `android/app/src/main/res/values/styles.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/app_primary</item>
        <item name="colorPrimaryDark">@color/app_primary_dark</item>
        <item name="colorAccent">@color/app_accent</item>
    </style>
</resources>
```

## 🧪 Testing the App

### Local Testing with Development Server

1. **Get your local IP address**
   ```bash
   ipconfig getifaddr en0  # macOS/Linux
   # or
   ipconfig             # Windows - look for IPv4 Address
   ```

2. **Update capacitor.config.ts**
   ```typescript
   server: {
     url: 'http://192.168.x.x:3000', // Your local IP
   }
   ```

3. **Sync and rebuild**
   ```bash
   pnpm run build
   npx cap sync android
   npx cap open android
   # Build and run from Android Studio
   ```

4. **Test features**
   - Login functionality
   - Location tracking (emulator → Extended controls → Location)
   - Order list display
   - Map view
   - Real-time updates

### Testing on Physical Device

1. **Enable USB Debugging**
   - Settings → About phone → Tap "Build number" 7 times
   - Settings → Developer options → USB Debugging (enable)
   - Connect via USB

2. **Verify connection**
   ```bash
   adb devices
   # Should list your device
   ```

3. **Run on device**
   - Android Studio will show device in toolbar
   - Select device and click Run

4. **View logs**
   ```bash
   adb logcat | grep "Joniah\|capacitor"
   ```

## 📍 GPS Location Features

### Background Location Tracking

The app includes background geolocation that works even when the app is closed.

Configuration in `capacitor.config.ts`:

```typescript
plugins: {
  BackgroundGeolocation: {
    locationProvider: 'HIGH_ACCURACY',
    desiredAccuracy: 10, // meters
    stationaryRadius: 50, // meters
    distanceFilter: 10, // meters
    interval: 30000, // milliseconds
    fastestInterval: 10000, // milliseconds
    activitiesInterval: 10000, // milliseconds
    notificationTitle: 'Joniah Delivery Tracking',
    notificationText: 'Sharing your location',
    notificationIconColor: '#FF0000',
    notificationIconLarge: 'ic_launcher',
    notificationIconSmall: 'ic_launcher',
    startForeground: true
  }
}
```

### In-App Location Updates

```typescript
// In your React component:
import { Geolocation } from '@capacitor/geolocation';
import { BackgroundGeolocation } from '@capacitor-community/background-geolocation';

// Real-time location
const getCurrentLocation = async () => {
  const coordinates = await Geolocation.getCurrentPosition();
  console.log('Current position:', coordinates);
};

// Start background tracking
const startBackgroundTracking = async () => {
  const options = {
    desiredAccuracy: 10,
    stationaryRadius: 50,
    distanceFilter: 10,
    interval: 30000,
  };
  
  await BackgroundGeolocation.start();
  
  // Listen for location updates
  BackgroundGeolocation.onLocation((location) => {
    // Send location to server
    sendLocationToServer(location);
  });
};

// Stop tracking
const stopBackgroundTracking = async () => {
  await BackgroundGeolocation.stop();
};
```

## 🔔 Push Notifications

### Setup Firebase Cloud Messaging (FCM)

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Create new project
   - Select Android as platform

2. **Add app to Firebase**
   - Register app with package name: `com.joniah.pharmacy.delivery`
   - Download `google-services.json`
   - Place in `android/app/google-services.json`

3. **Enable Push Notifications Plugin**
   ```typescript
   // capacitor.config.ts
   plugins: {
     PushNotifications: {
       presentationOptions: ["badge", "sound", "alert"]
     }
   }
   ```

4. **Handle notifications in React**
   ```typescript
   import { PushNotifications } from '@capacitor/push-notifications';
   
   const setupPushNotifications = async () => {
     // Register for push notifications
     await PushNotifications.requestPermissions();
     await PushNotifications.register();
     
     // Listen for notifications
     PushNotifications.addListener('pushNotificationReceived', (notification) => {
       console.log('Got notification:', notification);
       // Handle notification
     });
   };
   ```

## 📦 Publishing to Google Play Store

### Step 1: Prepare Release Build

```bash
# Create release keystore (one-time)
keytool -genkey -v -keystore release.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias joniah_key

# Sign release APK
cd android
./gradlew assembleRelease -Pandroid.injected.signing.store.file=../release.keystore -Pandroid.injected.signing.store.password=YourPassword -Pandroid.injected.signing.key.alias=joniah_key -Pandroid.injected.signing.key.password=YourPassword
```

### Step 2: Create Google Play Developer Account

1. Go to https://play.google.com/console
2. Create account ($25 one-time fee)
3. Complete merchant profile
4. Accept agreements

### Step 3: Create App Listing

1. Click "Create app"
2. Enter app name: "Joniah Delivery"
3. Select "Apps" category
4. Complete store listing:
   - Add screenshots
   - Write description
   - Set app icon
   - Choose category
   - Content rating

### Step 4: Upload APK

1. Go to "Release" → "Production"
2. Upload signed release APK
3. Review release details
4. Submit for review

Review typically takes 2-4 hours to several days.

See [GOOGLE_PLAY_PUBLISHING_GUIDE.md](./GOOGLE_PLAY_PUBLISHING_GUIDE.md) for detailed instructions.

## 🐛 Debugging

### Using Chrome DevTools

```bash
# App must be running on device/emulator
# In Chrome, navigate to: chrome://inspect
# Select your app
# Click "inspect"
```

### Using Android Studio Debugger

1. Open Android Studio
2. Run → Debug (instead of Run)
3. Set breakpoints in Java code
4. Step through execution

### Using Logcat

```bash
# View all logs
adb logcat

# Filter for your app
adb logcat | grep "joniah\|capacitor"

# Clear logs
adb logcat -c

# Save logs to file
adb logcat > app_logs.txt
```

## 🚀 Performance Optimization

### Minimize App Size
- Remove unused node_modules: `pnpm prune --prod`
- Use minification in build: already enabled in vite.config
- Strip unnecessary native modules

### Optimize Load Time
- Use code splitting in React
- Implement lazy loading for images
- Cache static assets

### Reduce Battery Drain
- Adjust background location interval
- Implement smart location detection
- Pause tracking when order complete

## 📚 Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Geolocation](https://capacitorjs.com/docs/apis/geolocation)
- [Capacitor Background Geolocation](https://github.com/capacitor-community/background-geolocation)
- [Android Developers Guide](https://developer.android.com/docs)
- [Google Play Console](https://play.google.com/console)

## ✅ Checklist for App Release

- [ ] Test on multiple Android devices (API 29+)
- [ ] Test offline functionality
- [ ] Verify location tracking accuracy
- [ ] Test push notifications
- [ ] Check battery consumption
- [ ] Verify file size
- [ ] Complete security review
- [ ] Prepare screenshots for Play Store
- [ ] Write store listing description
- [ ] Create privacy policy
- [ ] Create terms of service
- [ ] Submit for review on Google Play
- [ ] Monitor reviews and ratings
- [ ] Plan for iOS version (using Capacitor)

---

**Next Steps**: After Android app is built and tested, follow [GOOGLE_PLAY_PUBLISHING_GUIDE.md](./GOOGLE_PLAY_PUBLISHING_GUIDE.md) for Play Store submission.
