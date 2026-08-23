// Firebase Admin SDK initialization script
// This script uses the service account credentials to initialize the Firebase Admin SDK
// and set up required initial data in Firestore

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account credentials
const serviceAccountPath = path.join(__dirname, '..', 'credentials', 'firebase-adminsdk.json');
const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
});

const db = admin.firestore();

async function initializeAdmin() {
  console.log('Initializing Firebase Admin...');

  try {
    // Initialize collections and documents
    
    // Check if burnStats document exists
    const statsRef = db.collection('stats').doc('burnStats');
    const statsDoc = await statsRef.get();

    if (!statsDoc.exists) {
      // Create burnStats document if it doesn't exist
      console.log('Creating burnStats document...');
      await statsRef.set({
        totalBurned: 0,
        totalRequests: 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('burnStats document created successfully.');
    } else {
      console.log('burnStats document already exists.');
    }

    // You can add more initialization logic here as needed
    // For example, creating other collections or documents
    
    console.log('Firebase Admin initialization completed successfully.');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    throw error;
  }
}

// Run the initialization
initializeAdmin()
  .then(() => {
    console.log('Firebase Admin initialization completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Firebase Admin initialization failed:', error);
    process.exit(1);
  });
