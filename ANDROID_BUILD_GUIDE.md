# Joniah Pharmacy - Android App Complete Build Guide

## 🎯 Overview

This guide provides step-by-step instructions to build, test, and deploy the Joniah Pharmacy native Android app with:
- ✅ Real-time location tracking (even when app is closed)
- ✅ Push notifications for new orders
- ✅ Live order status updates
- ✅ Admin dashboard with live delivery tracking
- ✅ Background geolocation service
- ✅ Firebase Cloud Messaging (FCM)

## 📋 Prerequisites

### Software Required
- **Android Studio** (latest version) - https://developer.android.com/studio
- **Java Development Kit (JDK) 11+** - https://www.oracle.com/java/technologies/javase-jdk11-downloads.html
- **Android SDK** (API 29+)
- **Node.js 18+** and pnpm
- **Git**

### Accounts Required
- **Google Cloud Project** (for Firebase & Maps API)
- **GitHub Account** (for deploying code)
- **Google Play Developer Account** ($25 one-time fee)

## 🔧 Step 1: Setup Firebase Cloud Messaging

### 1.1 Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Create a new project named "Joniah Pharmacy"
3. Enable these APIs:
   - **Firebase Cloud Messaging API**
   - **Google Maps Platform API**
   - **Android Mobile Services API**

### 1.2 Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add Project"
3. Select your Google Cloud project
4. Enable Firebase

### 1.3 Download Service Account Key

1. In Firebase Console, go to **Project Settings** → **Service Accounts**
2. Click "Generate New Private Key"
3. Save the JSON file securely
4. Copy its contents to your `.env` file as `FIREBASE_SERVICE_ACCOUNT`

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

### 1.4 Get Google Maps API Key

1. In Google Cloud Console, go to **APIs & Services** → **Credentials**
2. Click "Create Credentials" → "API Key"
3. Add the key to `.env`:

```bash
VITE_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

4. Restrict key to:
   - Android apps
   - Add your app's SHA-1 fingerprint (get this after building APK)

## 🔌 Step 2: Setup Firebase in Android App

### 2.1 Register App with Firebase

1. In Firebase Console, click "Add App"
2. Select **Android**
3. Enter package name: `com.joniah.pharmacy.delivery`
4. Download `google-services.json`
5. Place in `android/app/google-services.json`

### 2.2 Update Android build.gradle

The project is already configured with Capacitor. Verify:

**android/app/build.gradle** should have:
```gradle
// At the top
apply plugin: 'com.google.gms.google-services'

dependencies {
  // Firebase
  implementation 'com.google.firebase:firebase-messaging:23.2.1'
  implementation 'com.google.firebase:firebase-analytics:21.2.2'
}
```

**android/build.gradle** should have:
```gradle
plugins {
  id 'com.google.gms.google-services' version '4.3.15'
}
```

## 🚀 Step 3: Build the Android App

### 3.1 Prepare Web Assets

```bash
cd "E:/مشروع جونيا/joniah_pharmacy"

# Install dependencies
pnpm install

# Build frontend
pnpm run build

# Verify dist/public exists
ls dist/public
```

### 3.2 Add Android Platform

If Capacitor/Android not already added:

```bash
npx cap add android
```

### 3.3 Sync Web Code to Android

```bash
# Copy latest web build to Android
npx cap sync android

# Update plugins
npx cap update
```

### 3.4 Open in Android Studio

```bash
npx cap open android
```

### 3.5 Wait for Gradle Sync

- Android Studio will automatically download dependencies
- First build may take 10-15 minutes
- Monitor the "Build" panel at bottom

### 3.6 Build APK

**Option A: Using Android Studio GUI**
1. Menu: **Build** → **Build Bundles/APK** → **Build APK**
2. Wait for build to complete
3. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

**Option B: Using Command Line**
```bash
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Or for release:
./gradlew assembleRelease
```

## 📱 Step 4: Test on Android Device/Emulator

### 4.1 Setup Emulator

If you don't have a physical device:

1. In Android Studio: **Tools** → **AVD Manager**
2. Click **Create Virtual Device**
3. Select device (Pixel 5 recommended)
4. Select API 29+ image
5. Finish and start emulator

### 4.2 Deploy to Emulator/Device

**From Android Studio:**
1. Select device in top toolbar dropdown
2. Click **Run** button (green play icon)
3. Or press **Shift+F10**

**From Command Line:**
```bash
cd android
./gradlew installDebug

# Launch the app
adb shell am start -n com.joniah.pharmacy.delivery/.MainActivity
```

### 4.3 Grant Permissions

When app launches:
1. Allow location permission
2. Allow notifications permission
3. Allow camera permission (if needed)

### 4.4 Test Features

✅ **Login**
- Use test OAuth credentials
- Verify session is created

✅ **Location Tracking**
- Open app as delivery person
- Location should update every 10-30 seconds
- In emulator: Extended Controls → Location → Set coordinates

✅ **Push Notifications**
- Assign order to delivery person
- Should receive notification
- Tap notification to open order

✅ **Background Tracking**
- Minimize app (press home button)
- Geolocation should continue tracking
- Admin dashboard should show live location
- Close app completely - tracking continues!

✅ **Real-time Updates**
- Open admin dashboard in browser
- Update order status
- Delivery person should see notification immediately

## 🐛 Step 5: Testing Checklist

Create a test plan:

### Background Location Testing

```
[ ] Location updates every 30 seconds
[ ] GPS accuracy within 50 meters
[ ] Works when app is minimized
[ ] Works when app is closed
[ ] Continues through screen lock
[ ] Stops when delivery is completed
[ ] Doesn't drain battery excessively
```

### Notification Testing

```
[ ] New order notification arrives
[ ] Sound + vibration work
[ ] Can tap notification to open order
[ ] Notification shows correct order details
[ ] Order status changes trigger notifications
```

### Admin Dashboard Testing

```
[ ] Can see all delivery persons on map
[ ] Map updates every 5 seconds
[ ] Clicking delivery person shows location
[ ] Order list shows real-time status
[ ] Can assign order to delivery person
[ ] Delivery person receives notification immediately
```

### Performance Testing

```
[ ] App doesn't crash
[ ] No memory leaks (check logcat)
[ ] GPS accuracy acceptable
[ ] Battery drain < 10% per hour
[ ] Data usage < 10MB per 8-hour shift
```

## 📊 Monitor Logs During Testing

### View Android Logcat

```bash
# View all logs
adb logcat

# Filter for app logs
adb logcat | grep "Joniah\|capacitor\|location"

# Save to file
adb logcat > logs.txt

# View Firebase logs
adb logcat | grep "Firebase"
```

### Common Log Messages

```
[Notifications] Initialized                    ✅ Notifications ready
[BackgroundGeo] Tracking started               ✅ Location tracking active
[BackgroundGeo] Location update: lat, lng      ✅ Location received
[Realtime] Connected                           ✅ WebSocket connected
[Notifications] Received: order notification   ✅ Notification arrived
```

### Debug JavaScript

In Android Studio:
1. Menu: **Tools** → **App Inspection**
2. or open Chrome and navigate to: `chrome://inspect`
3. Select your app
4. Click "Inspect"
5. Debug React components and JavaScript

## 🔑 Step 6: Generate Release Signing Key

For Google Play Store submission:

```bash
# Navigate to project root
cd "E:/مشروع جونيا/joniah_pharmacy"

# Generate keystore (one-time)
keytool -genkey -v -keystore release.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias joniah_key \
  -dname "CN=Joniah Pharmacy,O=Joniah,L=City,ST=State,C=SA"

# Password: (use a strong password, save it!)
# Verify keystore was created
keytool -list -v -keystore release.keystore
```

**Save these details securely:**
- Keystore file: `release.keystore`
- Keystore password: `your_password`
- Key alias: `joniah_key`
- Key password: `your_password`

## 🏗️ Step 7: Build Release APK

```bash
cd android

# Build release APK using keystore
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=../release.keystore \
  -Pandroid.injected.signing.store.password=your_password \
  -Pandroid.injected.signing.key.alias=joniah_key \
  -Pandroid.injected.signing.key.password=your_password

# Output location:
# android/app/build/outputs/apk/release/app-release.apk
```

## 📦 Step 8: Prepare for Google Play Store

See **GOOGLE_PLAY_PUBLISHING_GUIDE.md** for:
- Creating app listing
- Adding screenshots
- Setting up pricing
- Submitting for review

## 🎨 Customize App Branding

### Change App Name

**android/app/src/main/res/values/strings.xml:**
```xml
<string name="app_name">Joniah Delivery</string>
```

### Change App Icon

Replace these files with your icon (192x192 PNG):
- `android/app/src/main/res/mipmap-hdpi/ic_launcher.png`
- `android/app/src/main/res/mipmap-mdpi/ic_launcher.png`
- `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png`
- `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`

### Change Colors

**android/app/src/main/res/values/styles.xml:**
```xml
<color name="colorPrimary">#FF6B35</color>
<color name="colorPrimaryDark">#E55100</color>
<color name="colorAccent">#FFA726</color>
```

## 📊 Performance Optimization

### Reduce App Size
```bash
# Enable minification in capacitor.config.ts
# Remove unused dependencies
pnpm prune --prod
```

### Optimize Images
- Compress all assets to < 100KB
- Use WebP format for images
- Remove unused icons

### Background Service Optimization
- Adjust location update interval based on battery
- Stop tracking when delivery complete
- Clear old location data regularly

## 🚨 Troubleshooting

### Gradle Build Fails

```bash
# Clear build cache
cd android
./gradlew clean

# Invalidate cache in Android Studio
File → Invalidate Caches
```

### "No connected devices" Error

```bash
# Check devices
adb devices

# Restart ADB
adb kill-server
adb start-server

# For physical device, enable USB Debugging:
# Settings → About Phone → Tap Build Number 7 times
# Settings → Developer Options → USB Debugging
```

### GPS Not Working on Emulator

Extended Controls → Location → Set coordinates manually

### Firebase Credentials Error

Verify `google-services.json` exists in `android/app/`
Check Firebase Console for correct package name

### App Crashes on Startup

Check logcat for errors:
```bash
adb logcat | grep "AndroidRuntime"
```

### High Battery Drain

Reduce location update frequency:
```typescript
// In capacitor.config.ts
interval: 60000,        // Increase from 30000ms
fastestInterval: 30000, // Increase from 10000ms
```

## ✅ Deployment Checklist

Before submitting to Play Store:

- [ ] App runs without crashes
- [ ] All permissions granted
- [ ] Login/OAuth works
- [ ] Location tracking tested
- [ ] Notifications working
- [ ] Admin dashboard real-time updates
- [ ] Release APK signed
- [ ] APK size < 150MB
- [ ] All Arabic text displays correctly
- [ ] Performance acceptable (FPS, battery)
- [ ] Privacy policy updated
- [ ] Terms of service created

## 🎉 Summary

**Your Android app is now:**
- ✅ Built with Capacitor for native features
- ✅ Connected to Firebase for push notifications
- ✅ Tracking location in background
- ✅ Integrated with admin dashboard
- ✅ Ready for Google Play Store

**Next Steps:**
1. Test thoroughly on multiple devices
2. Gather user feedback
3. Follow GOOGLE_PLAY_PUBLISHING_GUIDE.md to publish
4. Monitor user reviews and crash reports
5. Plan iOS version (same code, different build)

---

**Need Help?**
- Android Docs: https://developer.android.com/docs
- Capacitor Docs: https://capacitorjs.com/docs
- Firebase Docs: https://firebase.google.com/docs
- Google Play Console: https://play.google.com/console/about/help
