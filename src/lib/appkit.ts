'use client';

// Direct re-exports of hooks from @reown/appkit/react
// In Next.js we can't wrap these hooks with our own functions that call them
import { 
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
  useDisconnect
} from '@reown/appkit/react';

// Make sure this function is called before any component that uses the hooks
import { initializeAppKit } from '@/components/AppKitProvider';

// Initialize immediately in browser environment
if (typeof window !== 'undefined') {
  // Immediately call the initializer
  try {
    initializeAppKit();
    console.log('AppKit initializer called from appkit.ts');
  } catch (error) {
    console.error('Failed to initialize AppKit from appkit.ts:', error);
  }
}

// For backward compatibility
export const initAppKit = () => {
  console.log('Legacy initAppKit called - initializing AppKit');
  return initializeAppKit();
};

// Check if AppKit is initialized
export const isAppKitInitialized = () => {
  if (typeof window !== 'undefined') {
    return !!(window as any).AppKitInitialized;
  }
  return false;
};

// Get the AppKit instance (fallback implementation)
export const getAppKit = () => {
  initializeAppKit();
  return null; // We don't actually return the instance as hooks are the preferred way
};

// Re-export for easier imports
export { 
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
  useDisconnect
};
