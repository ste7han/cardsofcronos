// Add specific user as admin to the new Firebase project
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

const db = admin.firestore();

// Get the user ID from command line arguments, or use default
const userId = process.argv[2] || 'DLZkLpD1ZvPv4rZqwKnUNHvmZrs1';

async function addUserAsAdmin() {
  console.log(`Adding user ${userId} as admin...`);

  try {
    // Add the user to the admins collection using their user ID
    const adminRef = db.collection('admins').doc(userId);
    await adminRef.set({
      userId: userId,
      addedBy: 'system',
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`User ${userId} successfully added as admin.`);
  } catch (error) {
    console.error('Error adding user as admin:', error);
    throw error;
  }
}

// Run the function
addUserAsAdmin()
  .then(() => {
    console.log('Admin addition completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Admin addition failed:', error);
    process.exit(1);
  });
