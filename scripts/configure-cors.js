// Configure CORS for Firebase Storage
const admin = require('firebase-admin');
const path = require('path');

// Load service account credentials
const serviceAccountPath = path.join(__dirname, '..', 'credentials', 'firebase-adminsdk.json');
const serviceAccount = require(serviceAccountPath);

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
    storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
  });
}

// Get bucket reference
const bucket = admin.storage().bucket();

async function configureCORS() {
  console.log('Configuring CORS for Firebase Storage...');

  try {
    // Set CORS configuration for the bucket
    await bucket.setCorsConfiguration([
      {
        origin: ['*'],  // Allow requests from any origin
        method: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        responseHeader: [
          'Content-Type',
          'Access-Control-Allow-Origin',
          'X-Requested-With',
          'Authorization'
        ],
        maxAgeSeconds: 3600
      }
    ]);
    
    console.log('CORS configuration has been set successfully.');
  } catch (error) {
    console.error('Error configuring CORS:', error);
    throw error;
  }
}

// Run the function
configureCORS()
  .then(() => {
    console.log('CORS configuration completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('CORS configuration failed:', error);
    process.exit(1);
  });
