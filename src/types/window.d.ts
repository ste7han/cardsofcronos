interface Window {
  AppKitInstance?: any;
  appKitHooks?: {
    useAppKit: any;
    useAppKitAccount: any;
  };
  appKitInitialized?: boolean;
  appkit?: any; // Adding the missing appkit property that's used in orders/page.tsx
}
