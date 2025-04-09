import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  updateDoc,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';

// Types
export interface CardRequest {
  type: 'Project' | 'Roast' | 'Influencer' | 'Special';
  rarity: 'Epic' | 'Rare' | 'Mythical';
  name: string;
  description: string;
  imageUrl: string;
  socialLink: string;
  transactionHash: string;
  burnAmount: number;
  email: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: Timestamp;
  userAddress?: string;
  adminNotes?: string;
}

// Collection references
const requestsCollection = collection(db, 'requests');
const statsDoc = doc(db, 'stats', 'burnStats');

// Add a new card request
export const addCardRequest = async (request: Omit<CardRequest, 'createdAt'>) => {
  try {
    const docRef = await addDoc(requestsCollection, {
      ...request,
      createdAt: Timestamp.now(),
    });
    
    // Update total burned tokens
    await updateDoc(statsDoc, {
      totalBurned: increment(request.burnAmount),
      totalRequests: increment(1),
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding card request:', error);
    throw error;
  }
};

// Get all card requests
export const getCardRequests = async () => {
  try {
    const q = query(
      requestsCollection,
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting card requests:', error);
    throw error;
  }
};

// Get a single card request by ID
export const getCardRequestById = async (id: string) => {
  try {
    const docRef = doc(requestsCollection, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting card request:', error);
    throw error;
  }
};

// Get burn statistics
export const getBurnStats = async () => {
  try {
    const docSnap = await getDoc(statsDoc);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      // Initialize stats document if it doesn't exist
      await updateDoc(statsDoc, {
        totalBurned: 0,
        totalRequests: 0,
      });
      return { totalBurned: 0, totalRequests: 0 };
    }
  } catch (error) {
    console.error('Error getting burn stats:', error);
    // Create the stats document if it doesn't exist
    try {
      await updateDoc(statsDoc, {
        totalBurned: 0,
        totalRequests: 0,
      });
      return { totalBurned: 0, totalRequests: 0 };
    } catch (innerError) {
      console.error('Error creating burn stats:', innerError);
      throw innerError;
    }
  }
};

// Get orders by user address
export const getOrdersByUser = async (userAddress: string) => {
  try {
    const q = query(
      requestsCollection,
      where('userAddress', '==', userAddress),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error getting user orders:', error);
    throw error;
  }
};

// Get a single order by ID (alias for getCardRequestById for semantic clarity)
export const getOrderById = async (id: string) => {
  return getCardRequestById(id);
};

// Update order status
export const updateOrderStatus = async (id: string, status: CardRequest['status'], adminNotes?: string) => {
  try {
    const orderRef = doc(requestsCollection, id);
    const updateData: any = { status };
    
    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }
    
    await updateDoc(orderRef, updateData);
    return true;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};
