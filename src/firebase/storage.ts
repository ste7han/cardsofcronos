import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './config';

// Upload an image to Firebase Storage
export const uploadImage = async (file: File, path: string): Promise<string> => {
  try {
    // Create a storage reference
    const storageRef = ref(storage, path);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

// Generate a unique file path for the image
export const generateImagePath = (fileName: string): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = fileName.split('.').pop();
  
  return `card-images/${timestamp}-${randomString}.${extension}`;
};
