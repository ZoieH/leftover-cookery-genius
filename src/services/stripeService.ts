import { loadStripe } from '@stripe/stripe-js';
import { getFirestore, collection, addDoc, updateDoc, query, where, getDocs, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db, useAuthStore } from './firebaseService';
import { auth } from './firebaseService';
import { useUsageStore } from './usageService';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Price ID for the premium subscription
const PREMIUM_PRICE_ID = import.meta.env.VITE_STRIPE_PREMIUM_PRICE_ID;

// Subscription management functions
export interface SubscriptionDetails {
  customerId?: string;
  subscriptionId?: string;
  renewalDate?: string;
  status?: string;
  premiumSince?: string;
  nextBillingAmount?: string;
  cancelAt?: string;
}

export const getSubscriptionDetails = async (userId: string): Promise<SubscriptionDetails | null> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists() || !userDoc.data().isPremium) {
      return null;
    }
    
    const userData = userDoc.data();
    
    // Generate next renewal date (for demo purposes)
    let renewalDate = userData.renewalDate;
    let nextBillingAmount = "$4.99";
    let status = userData.subscriptionStatus || "active";
    
    if (!renewalDate) {
      const premiumSince = userData.premiumSince ? new Date(userData.premiumSince) : new Date();
      const nextRenewal = new Date(premiumSince);
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);
      renewalDate = nextRenewal.toISOString();
      
      await updateDoc(userDocRef, {
        renewalDate: renewalDate
      });
    }
    
    return {
      customerId: userData.customerId || "cus_demo",
      subscriptionId: userData.subscriptionId || "sub_demo",
      renewalDate: renewalDate,
      status: status,
      premiumSince: userData.premiumSince,
      nextBillingAmount: nextBillingAmount,
      cancelAt: userData.cancelAt
    };
  } catch (error) {
    console.error('Error getting subscription details:', error);
    return null;
  }
};

export const cancelSubscription = async (userId: string): Promise<boolean> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists() || !userDoc.data().isPremium) {
      return false;
    }
    
    const userData = userDoc.data();
    const renewalDate = userData.renewalDate || new Date().toISOString();
    
    await updateDoc(userDocRef, {
      subscriptionStatus: "canceled",
      cancelAt: renewalDate
    });
    
    return true;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return false;
  }
};

export const reactivateSubscription = async (userId: string): Promise<boolean> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    await updateDoc(userDocRef, {
      subscriptionStatus: "active",
      cancelAt: null
    });
    
    return true;
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return false;
  }
};

export const createCheckoutSession = async (userId: string, email: string) => {
  try {
    console.log('Creating checkout session for user:', userId);
    
    // Store current page path for returning after payment
    const currentPage = window.location.pathname;
    localStorage.setItem('payment_return_url', currentPage);
    
    // Store payment initiation time to detect abandoned checkout sessions
    localStorage.setItem('payment_initiated', Date.now().toString());
    
    // Generate a secure nonce for this payment session
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('payment_nonce', nonce);
    
    // Store the user ID associated with this payment attempt
    localStorage.setItem('payment_user_id', userId);
    console.log('Stored payment details in localStorage', { userId, nonce, returnUrl: currentPage });
    
    // Record the payment initiation
    storePaymentTransactionDetails({
      userId,
      success: false,
      source: 'stripe',
      timestamp: new Date().toISOString(),
      status: 'initiated',
      nonce
    });
    
    // Use the Stripe Payment Link with coupon support
    const paymentLinkUrl = "https://buy.stripe.com/cN26rbbQG1Ylb7y8ww";
    
    // Add client reference ID and prefilled email to the URL
    const urlWithParams = new URL(paymentLinkUrl);
    
    // Critical: client_reference_id is used to identify the user
    urlWithParams.searchParams.append("client_reference_id", userId);
    urlWithParams.searchParams.append("prefilled_email", email);
    
    // Using what Stripe payment links actually support
    // Success URL can include limited parameters like redirect_status
    const baseSuccessUrl = `${window.location.origin}/payment-success`;
    const baseCancelUrl = `${window.location.origin}/payment-canceled`;
    
    urlWithParams.searchParams.append("success_url", baseSuccessUrl);
    urlWithParams.searchParams.append("cancel_url", baseCancelUrl);
    
    // For debugging
    console.log('Payment link URL:', urlWithParams.toString());
    console.log('IMPORTANT: Payment details stored in localStorage for recovery. User will be redirected to:', baseSuccessUrl);
    
    // Redirect to the payment link
    window.location.href = urlWithParams.toString();
    
  } catch (error) {
    console.error('Error redirecting to checkout:', error);
    throw new Error('Payment processing error. Please try again or contact support.');
  }
};

// Define a transaction details interface
export interface PaymentTransactionDetails {
  userId: string;
  transactionId?: string;
  success: boolean;
  error?: string;
  amount?: string;
  timestamp?: string;
  source?: string;
  stripeCustomerId?: string;
  [key: string]: any; // Allow additional properties
}

// Add this function to store transaction details in a consistent format
export const storePaymentTransactionDetails = (details: PaymentTransactionDetails) => {
  // Create a standardized transaction record
  const timestamp = details.timestamp || new Date().toISOString();
  const transactionRecord = {
    ...details,
    timestamp,
    recordedAt: new Date().toISOString()
  };
  
  // Store in localStorage for persistence and debugging
  try {
    // Get existing transactions
    const existingTransactionsStr = localStorage.getItem('payment_transactions');
    const existingTransactions = existingTransactionsStr 
      ? JSON.parse(existingTransactionsStr) 
      : [];
    
    // Add new transaction
    existingTransactions.unshift(transactionRecord);
    
    // Limit to most recent 10 transactions
    const limitedTransactions = existingTransactions.slice(0, 10);
    
    // Save back to localStorage
    localStorage.setItem('payment_transactions', JSON.stringify(limitedTransactions));
    
    // Set the most recent transaction for easy access
    localStorage.setItem('last_payment_transaction', JSON.stringify(transactionRecord));
    
    console.log('Payment transaction recorded:', transactionRecord);
  } catch (error) {
    console.error('Error storing payment transaction:', error);
  }
  
  return transactionRecord;
};

export const handleSuccessfulPayment = async (userId: string, nonce?: string) => {
  try {
    console.log('Updating premium status for user:', userId);
    
    // Verify nonce to prevent duplicate processing if provided
    if (nonce) {
      const storedNonce = localStorage.getItem('payment_nonce');
      if (storedNonce && storedNonce !== nonce) {
        console.warn('Nonce mismatch, possible duplicate payment processing attempt');
      }
      // Clear the nonce to prevent reuse
      localStorage.removeItem('payment_nonce');
    }
    
    const userDocRef = doc(db, 'users', userId);
    
    // Enhanced premium data with Stripe information
    const timestamp = new Date().toISOString();
    const premiumData = {
      isPremium: true,
      premiumSince: timestamp,
      updatedAt: timestamp,
      subscriptionStatus: 'active',
      paymentSource: 'stripe',
      subscriptionType: 'monthly',
      // Record last verification time
      lastVerified: timestamp
    };
    
    // Try to update the user document in Firestore
    try {
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        // Update the existing document
        await updateDoc(userDocRef, premiumData);
        console.log('Updated premium status in Firestore for user:', userId);
      } else {
        // Create a new user document if it doesn't exist
        await setDoc(userDocRef, {
          uid: userId,
          ...premiumData,
          createdAt: timestamp
        });
        console.log('Created new user document with premium status for user:', userId);
      }
      
      // Update the premium status in localStorage
      localStorage.setItem('isPremium', 'true');
      localStorage.setItem('premiumSince', timestamp);
      localStorage.setItem('premiumUserId', userId);
      
      // Update the Zustand store
      useUsageStore.getState().setIsPremium(true);
      
      return true;
    } catch (dbError) {
      console.error('Error updating Firestore:', dbError);
      
      // Even if the database update fails, set the premium status locally
      localStorage.setItem('isPremium', 'true');
      localStorage.setItem('premiumSince', timestamp);
      localStorage.setItem('premiumUserId', userId);
      
      // Update the Zustand store
      useUsageStore.getState().setIsPremium(true);
      
      // Add to retry queue
      const pendingUpdates = localStorage.getItem('premium_retry_queue');
      const retryQueue = pendingUpdates ? JSON.parse(pendingUpdates) : [];
      retryQueue.push({userId, timestamp});
      localStorage.setItem('premium_retry_queue', JSON.stringify(retryQueue));
      
      return false;
    }
  } catch (error) {
    console.error('Error in handleSuccessfulPayment:', error);
    return false;
  }
};

/**
 * Process the premium update retry queue to handle any failed database updates
 */
export const processRetryQueue = async () => {
  try {
    const retryQueueString = localStorage.getItem('premium_update_retry_queue');
    if (!retryQueueString) return;
    
    const retryQueue = JSON.parse(retryQueueString);
    if (!retryQueue || !Array.isArray(retryQueue) || retryQueue.length === 0) {
      localStorage.removeItem('premium_update_retry_queue');
      return;
    }
    
    console.log(`Processing premium status update retry queue (${retryQueue.length} items)`);
    
    // Process each retry item
    const updatedQueue = [];
    let successCount = 0;
    
    for (const item of retryQueue) {
      // Skip items that have been retried too many times
      if (item.attemptCount >= 5) {
        console.warn('Skipping retry item that exceeded max attempts:', item);
        continue;
      }
      
      // Update attempt count and last attempt time
      const updatedItem = {
        ...item,
        attemptCount: item.attemptCount + 1,
        lastAttempt: Date.now()
      };
      
      try {
        const userDocRef = doc(db, 'users', item.userId);
        
        // Check if the user document already has premium status
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().isPremium === true) {
          console.log('User already has premium status, skipping retry:', item.userId);
          successCount++;
          continue;
        }
        
        // Prepare premium data for update
        const premiumData = {
          isPremium: true,
          premiumSince: item.timestamp || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          subscriptionStatus: 'active',
          paymentSource: 'stripe',
          subscriptionType: 'monthly',
          lastVerified: new Date().toISOString()
        };
        
        if (!userDoc.exists()) {
          // Create a new user document
          await setDoc(userDocRef, {
            uid: item.userId,
            ...premiumData,
            createdAt: new Date().toISOString()
          });
        } else {
          // Update existing document
          await updateDoc(userDocRef, premiumData);
        }
        
        // Verify update was successful
        const updatedDoc = await getDoc(userDocRef);
        if (updatedDoc.exists() && updatedDoc.data().isPremium === true) {
          successCount++;
          console.log('Successfully updated premium status in retry:', item.userId);
          continue; // Don't add to updated queue
        } else {
          // Update failed, add back to queue for next retry
          updatedQueue.push(updatedItem);
        }
      } catch (error) {
        console.error('Error in retry queue processing:', error);
        updatedQueue.push(updatedItem);
      }
    }
    
    // Update the retry queue in localStorage
    if (updatedQueue.length > 0) {
      localStorage.setItem('premium_update_retry_queue', JSON.stringify(updatedQueue));
      console.log(`${successCount} items processed successfully, ${updatedQueue.length} remaining in queue`);
    } else {
      localStorage.removeItem('premium_update_retry_queue');
      console.log(`All ${successCount} retry items processed successfully, queue cleared`);
    }
    
    // Clear the retry request flag
    localStorage.removeItem('premium_retry_requested');
  } catch (error) {
    console.error('Error processing retry queue:', error);
  }
};

// Set up periodic retry processing
const RETRY_INTERVAL = 5 * 60 * 1000; // 5 minutes
let retryInterval: number | null = null;

export const initializeRetryProcessor = () => {
  // Clear any existing interval
  if (retryInterval) {
    clearInterval(retryInterval);
  }
  
  // Process queue immediately
  processRetryQueue();
  
  // Set up periodic processing
  retryInterval = window.setInterval(processRetryQueue, RETRY_INTERVAL);
  
  // Also set up a listener for immediate retry requests
  window.addEventListener('storage', (event) => {
    if (event.key === 'premium_retry_requested' && event.newValue) {
      processRetryQueue();
    }
  });
  
  return () => {
    if (retryInterval) {
      clearInterval(retryInterval);
      retryInterval = null;
    }
  };
};

// Initialize the retry processor
initializeRetryProcessor();

// Add automatic payment recovery/verification on app load
export const attemptPaymentRecovery = async () => {
  try {
    // Check if there's a pending payment
    const pendingPayment = localStorage.getItem('payment_success_pending');
    const userId = localStorage.getItem('payment_user_id');
    const nonce = localStorage.getItem('payment_nonce');
    const recoveryNeeded = localStorage.getItem('payment_recovery_needed');
    
    console.log('Checking for pending payments to recover...', { 
      pendingPayment, 
      userId, 
      nonceExists: !!nonce,
      recoveryNeeded: !!recoveryNeeded
    });
    
    if (!pendingPayment && !recoveryNeeded) {
      // No pending payment to recover
      return false;
    }
    
    // If there's a payment to recover, log the attempt
    console.log('Attempting to recover payment:', { 
      pendingPayment, 
      userId, 
      nonce: nonce ? `${nonce.substring(0, 4)}...` : undefined,
      recoveryNeeded: !!recoveryNeeded,
    });
    
    if (!userId) {
      console.error('No user ID found for payment recovery');
      return false;
    }
    
    // Get currently logged-in user if available
    const currentUser = auth.currentUser;
    
    // Check if the current user matches the stored payment user
    if (currentUser && currentUser.uid === userId) {
      // User is logged in and matches the payment user
      console.log('User is logged in and matches payment user - processing recovery...');
      
      // Process the payment
      const result = await handleSuccessfulPayment(userId, nonce);
      
      if (result) {
        console.log('Payment recovery successful');
        
        // Clear the pending payment flags
        localStorage.removeItem('payment_success_pending');
        localStorage.removeItem('payment_recovery_needed');
        localStorage.removeItem('recovery_user_id');
        
        // Keep user_id and nonce temporarily for verification
        // They'll be cleared on next app init if everything is properly synced
        
        return true;
      } else {
        console.error('Payment recovery failed - will try again on next app init');
        
        // Keep the recovery flags for next attempt
        localStorage.setItem('payment_recovery_needed', 'true');
        
        return false;
      }
    } else if (currentUser) {
      // User is logged in but doesn't match payment user
      console.warn(`Current user (${currentUser.uid}) doesn't match payment user (${userId}) - can't recover payment`);
      return false;
    } else {
      // User is not logged in
      console.warn('User is not logged in - can\'t recover payment');
      return false;
    }
  } catch (error) {
    console.error('Error in payment recovery:', error);
    return false;
  }
};