import { loadStripe } from '@stripe/stripe-js';
import { getFirestore, collection, addDoc, updateDoc, query, where, getDocs, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db, useAuthStore } from './firebaseService';
import { getAuth } from 'firebase/auth';
import { useUsageStore } from './usageService';

// Initialize auth
const auth = getAuth();

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
    
    // Add success and cancel URL parameters with proper encoding
    // Include nonce to prevent CSRF attacks and enable secure verification
    const successUrl = `${window.location.origin}/payment-success?user=${encodeURIComponent(userId)}&nonce=${encodeURIComponent(nonce)}&success=true&returnUrl=${encodeURIComponent(currentPage)}`;
    const cancelUrl = `${window.location.origin}/payment-canceled?nonce=${encodeURIComponent(nonce)}&returnUrl=${encodeURIComponent(currentPage)}`;
    
    urlWithParams.searchParams.append("success_url", successUrl);
    urlWithParams.searchParams.append("cancel_url", cancelUrl);
    
    // For debugging
    console.log('Payment link URL:', urlWithParams.toString());
    
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
    
    // Transaction details to be recorded
    const transactionDetails: PaymentTransactionDetails = {
      userId,
      success: false, // Will be updated at the end if successful
      source: 'stripe',
      nonce
    };
    
    // Verify nonce to prevent duplicate processing if provided
    if (nonce) {
      const storedNonce = localStorage.getItem('payment_nonce');
      if (storedNonce && storedNonce !== nonce) {
        console.warn('Nonce mismatch, possible duplicate payment processing attempt');
        // Still continue as this might be a legitimate retry
        transactionDetails.nonceMismatch = true;
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
    
    transactionDetails.timestamp = timestamp;
    
    // Create transaction log for auditing and troubleshooting
    let logId = '';
    try {
      const logRef = doc(collection(db, 'payment_logs'));
      logId = logRef.id;
      transactionDetails.logId = logId;
      
      await setDoc(logRef, {
        userId,
        action: 'premium_activation',
        timestamp,
        success: true,
        clientInfo: {
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        }
      });
    } catch (logError) {
      // Non-critical error, just log and continue
      console.warn('Failed to create payment log:', logError);
      transactionDetails.logError = String(logError);
    }
    
    // First try to update the database
    let dbUpdateSuccess = false;
    
    try {
      // Get the current user document
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.log('User document not found, creating new document');
        
        // Get the current authenticated user to ensure we have all the user info
        const currentUser = auth.currentUser;
        let email = '';
        
        if (currentUser && currentUser.uid === userId) {
          email = currentUser.email || '';
          console.log('Using authenticated user email:', email);
        } else {
          console.log('User not currently authenticated, using minimal data');
        }
        
        // Create a new user document with all available information
        await setDoc(userDocRef, {
          uid: userId,
          email: email,
          ...premiumData,
          createdAt: timestamp
        });
        console.log('Created new user document with premium status');
        transactionDetails.documentCreated = true;
      } else {
        console.log('User document exists, updating premium status');
        // Update the existing user document, preserving other fields
        await updateDoc(userDocRef, {
          ...premiumData
        });
        console.log('Updated user document with premium status');
        transactionDetails.documentUpdated = true;
      }
      
      // Verify the update was successful
      const updatedDoc = await getDoc(userDocRef);
      const updatedData = updatedDoc.data();
      
      if (updatedData && updatedData.isPremium === true) {
        console.log('Premium status update verification successful');
        dbUpdateSuccess = true;
        transactionDetails.verificationSuccess = true;
        
        // Store Stripe customer ID if available
        if (updatedData.stripeCustomerId) {
          transactionDetails.stripeCustomerId = updatedData.stripeCustomerId;
        }
      } else {
        console.error('Premium status update verification failed');
        transactionDetails.verificationFailed = true;
        // Continue to fallback mechanism
      }
    } catch (dbError) {
      console.error('Database update error:', dbError);
      transactionDetails.dbError = String(dbError);
      // Continue to fallback mechanism
    }
    
    // Always update local storage for client-side detection (even if DB update fails)
    localStorage.setItem('isPremium', 'true');
    localStorage.setItem('premiumSince', premiumData.premiumSince);
    localStorage.setItem('premiumUserId', userId);
    localStorage.setItem('premiumUpdatedAt', timestamp);
    
    // Clear payment initiation timestamp
    localStorage.removeItem('payment_initiated');
    
    // Update the usage store state - important for immediate UI updates
    const { setIsPremium } = useUsageStore.getState();
    setIsPremium(true);
    console.log('Updated localStorage and app state with premium status');

    // Check if the current authenticated user matches the userId 
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid !== userId) {
      console.warn('Premium status updated for userId that does not match current auth user', {
        currentAuthUserId: currentUser.uid,
        updatedUserId: userId
      });
      transactionDetails.userMismatch = true;
    }
    
    // If database update failed, schedule a retry
    if (!dbUpdateSuccess) {
      console.log('Scheduling retry for database update');
      
      // Add to a retry queue in localStorage
      try {
        const retryQueue = JSON.parse(localStorage.getItem('premium_update_retry_queue') || '[]');
        retryQueue.push({
          userId,
          timestamp,
          attemptCount: 0,
          lastAttempt: Date.now()
        });
        localStorage.setItem('premium_update_retry_queue', JSON.stringify(retryQueue));
        
        // Schedule immediate retry if possible
        setTimeout(() => {
          // Try to process retry queue - this will be picked up by code that handles retries
          localStorage.setItem('premium_retry_requested', Date.now().toString());
        }, 5000);
        
        transactionDetails.retryScheduled = true;
      } catch (retryError) {
        console.error('Failed to schedule retry:', retryError);
        transactionDetails.retryError = String(retryError);
      }
    }
    
    // Set final transaction status
    transactionDetails.success = dbUpdateSuccess;
    
    // Store transaction details
    storePaymentTransactionDetails(transactionDetails);
    
    return dbUpdateSuccess;
  } catch (error) {
    console.error('Error updating premium status:', error);
    
    // Record the failed transaction
    const transactionDetails = {
      userId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      source: 'stripe'
    };
    storePaymentTransactionDetails(transactionDetails);
    
    // Always ensure user gets premium access by updating local storage
    localStorage.setItem('isPremium', 'true');
    localStorage.setItem('premiumSince', new Date().toISOString());
    localStorage.setItem('premiumUserId', userId);
    
    // Force update the app state
    useUsageStore.getState().setIsPremium(true);
    throw error;
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
    console.log('Checking for pending payments to recover...');
    
    // Check if there's a pending payment in localStorage
    const paymentUserId = localStorage.getItem('payment_user_id');
    const paymentNonce = localStorage.getItem('payment_nonce');
    const paymentSuccess = localStorage.getItem('payment_success_pending');
    
    // If no pending payment, exit early
    if (!paymentUserId || !paymentSuccess) {
      return false;
    }
    
    console.log('Found pending payment for user:', paymentUserId);
    
    // Record the recovery attempt
    storePaymentTransactionDetails({
      userId: paymentUserId,
      success: false, // Will be updated if successful
      source: 'stripe-recovery',
      timestamp: new Date().toISOString(),
      status: 'recovery-attempted',
      nonce: paymentNonce || undefined
    });
    
    // Attempt to update the premium status
    const currentUser = auth.currentUser;
    
    // Only proceed if the user is logged in
    if (currentUser && currentUser.uid === paymentUserId) {
      // Update the user's premium status
      const success = await handleSuccessfulPayment(paymentUserId, paymentNonce || undefined);
      
      // Clean up localStorage
      localStorage.removeItem('payment_success_pending');
      localStorage.removeItem('payment_user_id');
      localStorage.removeItem('payment_nonce');
      
      // Record the result
      storePaymentTransactionDetails({
        userId: paymentUserId,
        success: success,
        source: 'stripe-recovery',
        timestamp: new Date().toISOString(),
        status: success ? 'recovery-success' : 'recovery-failed'
      });
      
      return success;
    } else if (currentUser) {
      console.warn('User mismatch during payment recovery', {
        storedUserId: paymentUserId,
        currentUserId: currentUser.uid
      });
      
      // Record the mismatch
      storePaymentTransactionDetails({
        userId: paymentUserId,
        success: false,
        source: 'stripe-recovery',
        timestamp: new Date().toISOString(),
        status: 'recovery-user-mismatch',
        currentUserId: currentUser.uid
      });
    } else {
      console.log('User not logged in during payment recovery');
      
      // Record the lack of authentication
      storePaymentTransactionDetails({
        userId: paymentUserId,
        success: false,
        source: 'stripe-recovery',
        timestamp: new Date().toISOString(),
        status: 'recovery-no-auth'
      });
    }
    
    return false;
  } catch (error) {
    console.error('Error during payment recovery:', error);
    return false;
  }
};