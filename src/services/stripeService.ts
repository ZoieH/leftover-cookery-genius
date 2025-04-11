import { loadStripe } from '@stripe/stripe-js';
import { getFirestore, collection, addDoc, updateDoc, query, where, getDocs, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from './firebaseService';
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
    
    // Instead of using the Payment Link which is causing errors,
    // let's create a checkout session directly with the Stripe API
    
    // First, get the Stripe instance
    const stripe = await stripePromise;
    if (!stripe) {
      throw new Error('Failed to initialize Stripe');
    }
    
    // Store current page path for returning after payment
    const currentPage = window.location.pathname;
    localStorage.setItem('payment_return_url', currentPage);
    
    // Create properly formatted and encoded URLs for success and cancel
    const origin = window.location.origin;
    const successUrl = new URL(`${origin}/payment-success`);
    successUrl.searchParams.append('user', userId);
    successUrl.searchParams.append('success', 'true');
    successUrl.searchParams.append('returnUrl', currentPage);
    
    const cancelUrl = new URL(`${origin}/payment-canceled`);
    cancelUrl.searchParams.append('returnUrl', currentPage);
    
    console.log('Success URL:', successUrl.toString());
    console.log('Cancel URL:', cancelUrl.toString());
    
    // Create the checkout session
    const { error } = await stripe.redirectToCheckout({
      mode: 'subscription',
      lineItems: [
        {
          price: PREMIUM_PRICE_ID,
          quantity: 1,
        },
      ],
      successUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
      clientReferenceId: userId,
      customerEmail: email,
    });
    
    if (error) {
      console.error('Stripe checkout error:', error);
      throw new Error(error.message || 'Payment processing error. Please try again.');
    }
    
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new Error('Payment processing error. Please try again or contact support.');
  }
};

export const handleSuccessfulPayment = async (userId: string) => {
  try {
    console.log('Updating premium status for user:', userId);
    
    // Update both Firebase and local storage to ensure premium status persists
    const userDocRef = doc(db, 'users', userId);
    
    // Enhanced premium data with Stripe information
    const premiumData = {
      isPremium: true,
      premiumSince: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subscriptionStatus: 'active',
      paymentSource: 'stripe',
      subscriptionType: 'monthly'
    };
    
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
        createdAt: new Date().toISOString()
      });
      console.log('Created new user document with premium status');
    } else {
      console.log('User document exists, updating premium status');
      // Update the existing user document, preserving other fields
      await updateDoc(userDocRef, {
        ...premiumData
      });
      console.log('Updated user document with premium status');
    }
    
    // Double-check the update was successful
    const updatedDoc = await getDoc(userDocRef);
    const updatedData = updatedDoc.data();
    console.log('Updated user data:', updatedData);
    
    if (!updatedData || updatedData.isPremium !== true) {
      console.error('Premium status update verification failed');
      throw new Error('Failed to update premium status in database');
    }
    
    // Always update local storage for client-side detection
    console.log('Updating localStorage with premium status');
    localStorage.setItem('isPremium', 'true');
    localStorage.setItem('premiumSince', premiumData.premiumSince);
    localStorage.setItem('premiumUserId', userId); // Store the user ID for cross-referencing
    
    // Force sync with the server once more to confirm the update
    console.log('Forcing sync with server for final confirmation');
    try {
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === userId) {
        // This will update the global state as well
        await useUsageStore.getState().syncPremiumStatus();
      } else {
        // Update the usage store state directly if we can't sync
        useUsageStore.getState().setIsPremium(true);
      }
    } catch (syncError) {
      console.error('Error during final sync:', syncError);
      // Still set premium in the store even if sync fails
      useUsageStore.getState().setIsPremium(true);
    }
    
    console.log('Premium status update complete');
    return true;
  } catch (error) {
    console.error('Error updating premium status:', error);
    // Always ensure user gets premium access by updating local storage
    localStorage.setItem('isPremium', 'true');
    localStorage.setItem('premiumSince', new Date().toISOString());
    localStorage.setItem('premiumUserId', userId);
    
    // Update the store state
    useUsageStore.getState().setIsPremium(true);
    
    throw error;
  }
}; 