import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

// Collection references
const adminsCollection = 'admins';

// Check if a user is an admin
export const isAdmin = async (userAddress: string): Promise<boolean> => {
  if (!userAddress) return false;
  
  try {
    // Normalize the address to lowercase for consistency
    const normalizedAddress = userAddress.toLowerCase();
    
    // Check if the user is in the admins collection
    const adminRef = doc(db, adminsCollection, normalizedAddress);
    const adminDoc = await getDoc(adminRef);
    
    return adminDoc.exists();
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Add a new admin
export const addAdmin = async (userAddress: string, addedBy: string): Promise<boolean> => {
  if (!userAddress) return false;
  
  try {
    // First check if the caller is an admin
    const callerIsAdmin = await isAdmin(addedBy);
    if (!callerIsAdmin) {
      throw new Error('Only existing admins can add new admins');
    }
    
    // Normalize the address to lowercase for consistency
    const normalizedAddress = userAddress.toLowerCase();
    
    // Add the user to the admins collection
    const adminRef = doc(db, adminsCollection, normalizedAddress);
    await setDoc(adminRef, {
      address: normalizedAddress,
      addedBy,
      addedAt: serverTimestamp(),
    });
    
    return true;
  } catch (error) {
    console.error('Error adding admin:', error);
    throw error;
  }
};

// Remove an admin
export const removeAdmin = async (userAddress: string, removedBy: string): Promise<boolean> => {
  if (!userAddress) return false;
  
  try {
    // First check if the caller is an admin
    const callerIsAdmin = await isAdmin(removedBy);
    if (!callerIsAdmin) {
      throw new Error('Only existing admins can remove admins');
    }
    
    // Normalize the address to lowercase for consistency
    const normalizedAddress = userAddress.toLowerCase();
    
    // Remove the user from the admins collection
    const adminRef = doc(db, adminsCollection, normalizedAddress);
    await deleteDoc(adminRef);
    
    return true;
  } catch (error) {
    console.error('Error removing admin:', error);
    throw error;
  }
};
