import { describe, it, expect } from 'vitest';
import { initializeFirebase } from './_core/firebase';

describe('Firebase Integration', () => {
  it('should initialize Firebase with valid credentials', async () => {
    // Check if required environment variables are set
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
    ];
    
    for (const envVar of requiredEnvVars) {
      expect(process.env[envVar], `${envVar} should be set`).toBeDefined();
    }
    
    // Try to initialize Firebase
    const app = initializeFirebase();
    
    // Firebase should initialize successfully with valid credentials
    // If credentials are invalid, initializeFirebase returns null
    expect(app).not.toBeNull();
  });
});
