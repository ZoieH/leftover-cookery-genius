import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore, isUserPremium } from './firebaseService';

interface UsageStore {
  searchCount: number;
  isPremium: boolean;
  lastPremiumCheck: number;
  premiumUserId: string | null;
  incrementSearchCount: () => void;
  resetSearchCount: () => void;
  setIsPremium: (isPremium: boolean) => void;
  syncPremiumStatus: () => Promise<boolean>;
}

export const useUsageStore = create<UsageStore>()(
  persist(
    (set, get) => ({
      searchCount: 0,
      isPremium: false,
      lastPremiumCheck: 0,
      premiumUserId: null,
      incrementSearchCount: () => set((state) => ({ searchCount: state.searchCount + 1 })),
      resetSearchCount: () => set({ searchCount: 0 }),
      setIsPremium: (isPremium) => {
        const { user } = useAuthStore.getState();
        const userId = user?.uid || null;
        
        // Always update localStorage when setting premium status
        if (isPremium && userId) {
          localStorage.setItem('isPremium', 'true');
          localStorage.setItem('premiumUserId', userId);
          localStorage.setItem('premiumSince', new Date().toISOString());
          localStorage.setItem('premiumUpdatedAt', Date.now().toString());
        }
        
        set({ 
          isPremium,
          premiumUserId: isPremium ? userId : null,
          lastPremiumCheck: Date.now()
        });
      },
      syncPremiumStatus: async () => {
        const { user } = useAuthStore.getState();
        const currentState = get();
        
        // If no user is logged in, we need special handling
        if (!user) {
          // Only clear premium status if it was associated with a user
          // This prevents clearing during initial page load before auth is initialized
          if (currentState.premiumUserId) {
            console.log('No user logged in, clearing premium status');
            set({ 
              isPremium: false,
              premiumUserId: null
            });
          }
          return false;
        }
        
        try {
          // First check localStorage as a fallback mechanism
          const localPremium = localStorage.getItem('isPremium');
          const localPremiumUserId = localStorage.getItem('premiumUserId');
          
          // Check if the localStorage premium status matches the current user
          if (localPremium === 'true' && localPremiumUserId === user.uid) {
            console.log('Premium status found in localStorage for current user');
            set({ 
              isPremium: true,
              premiumUserId: user.uid,
              lastPremiumCheck: Date.now()
            });
            return true;
          }
          
          // Then try to fetch from server
          const premiumStatus = await isUserPremium(user);
          console.log('Synced premium status from server:', premiumStatus);
          
          if (premiumStatus) {
            // If the user is premium, update localStorage with correct user ID
            localStorage.setItem('isPremium', 'true');
            localStorage.setItem('premiumUserId', user.uid);
            localStorage.setItem('premiumSince', new Date().toISOString());
            localStorage.setItem('premiumUpdatedAt', Date.now().toString());
          } else {
            // Clear localStorage premium if server says user is not premium
            // Only clear if it was previously set for this user
            if (localPremiumUserId === user.uid && localPremium === 'true') {
              localStorage.removeItem('isPremium');
              localStorage.removeItem('premiumUserId');
              localStorage.removeItem('premiumSince');
              localStorage.removeItem('premiumUpdatedAt');
            }
          }
          
          set({ 
            isPremium: premiumStatus,
            premiumUserId: premiumStatus ? user.uid : null,
            lastPremiumCheck: Date.now()
          });
          return premiumStatus;
        } catch (error) {
          console.error('Error syncing premium status:', error);
          
          // Check localStorage as fallback if server check fails
          const localPremium = localStorage.getItem('isPremium');
          const localPremiumUserId = localStorage.getItem('premiumUserId');
          
          if (localPremium === 'true' && localPremiumUserId === user.uid) {
            console.log('Using premium status from localStorage after server error');
            set({ 
              isPremium: true,
              premiumUserId: user.uid,
              lastPremiumCheck: Date.now()
            });
            return true;
          }
          
          return get().isPremium; // Return current state if error
        }
      }
    }),
    {
      name: 'usage-storage',
      // Store premium info for persistence between sessions
      partialize: (state) => ({
        searchCount: state.searchCount,
        isPremium: state.isPremium, 
        premiumUserId: state.premiumUserId,
        lastPremiumCheck: state.lastPremiumCheck
      })
    }
  )
);

// Maximum number of searches for free users
const MAX_FREE_SEARCHES = 3;

// Check if premium status needs refresh
const needsPremiumRefresh = () => {
  const { lastPremiumCheck } = useUsageStore.getState();
  const REFRESH_INTERVAL = 60 * 1000; // 1 minute
  return Date.now() - lastPremiumCheck > REFRESH_INTERVAL;
};

// Force immediate sync regardless of time interval
export const forcePremiumSync = async () => {
  const { syncPremiumStatus } = useUsageStore.getState();
  return await syncPremiumStatus();
};

// Function to handle periodic sync
const setupPeriodicSync = () => {
  // Initial sync on page load
  const initialSync = async () => {
    const { user } = useAuthStore.getState();
    if (user) {
      console.log('Performing initial sync on page load');
      await forcePremiumSync();
    }
  };

  // Set up visibility change listener for page focus/blur
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      const { user } = useAuthStore.getState();
      if (user && needsPremiumRefresh()) {
        console.log('Syncing premium status on page visibility change');
        await forcePremiumSync();
      }
    }
  };

  // Set up periodic sync
  const periodicSync = async () => {
    const { user } = useAuthStore.getState();
    if (user && needsPremiumRefresh()) {
      console.log('Performing periodic sync');
      await forcePremiumSync();
    }
  };

  // Initial setup
  initialSync();

  // Set up event listeners
  document.addEventListener('visibilitychange', handleVisibilityChange);
  const syncInterval = setInterval(periodicSync, 60 * 1000); // Check every minute

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearInterval(syncInterval);
  };
};

// Initialize the service
export const initializeUsageService = () => {
  // Start periodic sync
  const cleanup = setupPeriodicSync();
  
  // Subscribe to auth changes
  const unsubscribeAuth = useAuthStore.subscribe((state) => {
    const { user } = state;
    const { premiumUserId } = useUsageStore.getState();
    
    if (user) {
      // User logged in, check if premium status is already set for this user
      if (premiumUserId && premiumUserId !== user.uid) {
        // Different user, reset premium status first
        useUsageStore.setState({ 
          isPremium: false,
          premiumUserId: null
        });
      }
      
      // Then sync with server
      forcePremiumSync();
    } else if (premiumUserId) {
      // User logged out, clear premium status that was tied to a user
      useUsageStore.setState({ 
        isPremium: false,
        premiumUserId: null
      });
    }
  });

  // Return cleanup function
  return () => {
    cleanup();
    unsubscribeAuth();
  };
};

export const canPerformSearch = async () => {
  const { user } = useAuthStore.getState();
  const { isPremium, searchCount, syncPremiumStatus } = useUsageStore.getState();
  
  // For non-logged in users, just check search count
  if (!user) {
    return searchCount < MAX_FREE_SEARCHES;
  }
  
  // For logged in users, check premium status (with caching)
  if (needsPremiumRefresh()) {
    const freshPremiumStatus = await syncPremiumStatus();
    return freshPremiumStatus || searchCount < MAX_FREE_SEARCHES;
  }
  
  return isPremium || searchCount < MAX_FREE_SEARCHES;
};

export const getRemainingSearches = async () => {
  const { user } = useAuthStore.getState();
  const { isPremium, searchCount, syncPremiumStatus } = useUsageStore.getState();
  
  // For non-logged in users, just calculate remaining searches
  if (!user) {
    return Math.max(0, MAX_FREE_SEARCHES - searchCount);
  }
  
  // For logged in users, check premium status (with caching)
  let premiumStatus = isPremium;
  if (needsPremiumRefresh()) {
    premiumStatus = await syncPremiumStatus();
  }
  
  if (premiumStatus) return '∞';
  
  return Math.max(0, MAX_FREE_SEARCHES - searchCount);
};

export const canUsePremiumFeature = async () => {
  const { user } = useAuthStore.getState();
  const { isPremium, syncPremiumStatus } = useUsageStore.getState();
  
  // Non-logged in users can't use premium features
  if (!user) return false;
  
  // Check premium status (with caching)
  if (needsPremiumRefresh()) {
    return await syncPremiumStatus();
  }
  
  return isPremium;
};

// Initialize on load
initializeUsageService(); 