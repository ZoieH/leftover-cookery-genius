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
          set({ isPremium: false });
          return false;
        }
        
        try {
          // Check premium status from backend
          const premiumStatus = await isUserPremium(user);
          set({ 
            isPremium: premiumStatus,
            lastPremiumCheck: Date.now()
          });
          return premiumStatus;
        } catch (error) {
          console.error('Error syncing premium status:', error);
          return get().isPremium; // Return current state if error
        }
      }
    }),
    {
      name: 'usage-storage',
    }
  )
);

// Maximum number of searches for free users
const MAX_FREE_SEARCHES = 3;

// Check if premium status needs refresh (every hour)
const needsPremiumRefresh = () => {
  const { lastPremiumCheck } = useUsageStore.getState();
  return Date.now() - lastPremiumCheck > 60 * 60 * 1000; // 1 hour
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