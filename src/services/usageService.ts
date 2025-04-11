import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore, isUserPremium } from './firebaseService';

interface UsageStore {
  searchCount: number;
  isPremium: boolean;
  lastPremiumCheck: number;
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
      incrementSearchCount: () => set((state) => ({ searchCount: state.searchCount + 1 })),
      resetSearchCount: () => set({ searchCount: 0 }),
      setIsPremium: (isPremium) => set({ 
        isPremium,
        lastPremiumCheck: Date.now()
      }),
      syncPremiumStatus: async () => {
        const { user } = useAuthStore.getState();
        if (!user) {
          console.log('No user found, setting premium status to false');
          set({ isPremium: false });
          return false;
        }
        
        try {
          console.log('Starting premium status sync for user:', user.uid);
          
          // First check localStorage as a fallback mechanism
          const localPremium = localStorage.getItem('isPremium');
          const localPremiumUserId = localStorage.getItem('premiumUserId');
          
          // Check if the localStorage premium status matches the current user
          if (localPremium === 'true' && localPremiumUserId === user.uid) {
            console.log('Premium status found in localStorage for current user');
            set({ 
              isPremium: true,
              lastPremiumCheck: Date.now()
            });
            return true;
          }
          
          // Then try to fetch from server
          console.log('Checking premium status from server...');
          const premiumStatus = await isUserPremium(user);
          console.log('Synced premium status from server:', premiumStatus);
          
          if (premiumStatus) {
            // If the user is premium, update localStorage with correct user ID
            console.log('Setting localStorage premium status to true');
            localStorage.setItem('isPremium', 'true');
            localStorage.setItem('premiumUserId', user.uid);
            localStorage.setItem('premiumSince', new Date().toISOString());
          } else {
            console.log('Setting localStorage premium status to false');
            localStorage.setItem('isPremium', 'false');
          }
          
          console.log('Updating premium status in store to:', premiumStatus);
          set({ 
            isPremium: premiumStatus,
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
      // Don't persist the premium status - always check from server
      partialize: (state) => ({
        searchCount: state.searchCount
      })
    }
  )
);

// Maximum number of searches for free users
const MAX_FREE_SEARCHES = 3;

// Check if premium status needs refresh (every 5 minutes)
const needsPremiumRefresh = () => {
  const { lastPremiumCheck } = useUsageStore.getState();
  return Date.now() - lastPremiumCheck > 5 * 60 * 1000; // 5 minutes
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
  if (!user) return false;
  
  const { isPremium, syncPremiumStatus } = useUsageStore.getState();
  
  // Check premium status (with caching)
  if (needsPremiumRefresh()) {
    return await syncPremiumStatus();
  }
  
  return isPremium;
};

// Initialize the component by syncing premium status on load
export const initializeUsageService = async () => {
  const { user } = useAuthStore.getState();
  if (user) {
    await useUsageStore.getState().syncPremiumStatus();
  }
};

// Auto-sync premium status when user auth state changes
useAuthStore.subscribe((state) => {
  if (state.user) {
    useUsageStore.getState().syncPremiumStatus();
  } else {
    useUsageStore.setState({ isPremium: false });
  }
});

// Initialize on load
initializeUsageService(); 