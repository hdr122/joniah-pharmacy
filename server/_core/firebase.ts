import * as admin from 'firebase-admin';

// Firebase Service Account credentials from environment
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "joniah-delivery",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CERT_URL,
  universe_domain: "googleapis.com"
};

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App | null = null;

export function initializeFirebase() {
  if (firebaseApp) return firebaseApp;
  
  try {
    // Check if required credentials exist
    if (!serviceAccount.private_key || !serviceAccount.client_email) {
      console.warn('[Firebase] Missing credentials, push notifications disabled');
      return null;
    }
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    
    console.log('[Firebase] Initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
    return null;
  }
}

// Send push notification to a specific device
export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    if (!firebaseApp) {
      initializeFirebase();
    }
    
    if (!firebaseApp) {
      console.warn('[Firebase] Not initialized, skipping push notification');
      return false;
    }
    
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'orders',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };
    
    const response = await admin.messaging().send(message);
    console.log('[Firebase] Push notification sent:', response);
    return true;
  } catch (error: any) {
    console.error('[Firebase] Push notification error:', error?.message || error);
    
    // Handle invalid token
    if (error?.code === 'messaging/invalid-registration-token' ||
        error?.code === 'messaging/registration-token-not-registered') {
      console.log('[Firebase] Invalid token, should be removed from database');
    }
    
    return false;
  }
}

// Send push notification to multiple devices
export async function sendMultiplePushNotifications(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ successCount: number; failureCount: number }> {
  if (!fcmTokens.length) {
    return { successCount: 0, failureCount: 0 };
  }
  
  try {
    if (!firebaseApp) {
      initializeFirebase();
    }
    
    if (!firebaseApp) {
      console.warn('[Firebase] Not initialized, skipping push notifications');
      return { successCount: 0, failureCount: fcmTokens.length };
    }
    
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'orders',
          priority: 'high',
        },
      },
    };
    
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[Firebase] Multicast: ${response.successCount} success, ${response.failureCount} failures`);
    
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('[Firebase] Multicast error:', error);
    return { successCount: 0, failureCount: fcmTokens.length };
  }
}

// Initialize on module load
initializeFirebase();
