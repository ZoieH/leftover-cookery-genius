import { loadStripe } from '@stripe/stripe-js';
import { getFirestore, collection, addDoc, updateDoc, query, where, getDocs, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebaseService';

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
    // Get user document
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists() || !userDoc.data().isPremium) {
      return null;
    }
    
    const userData = userDoc.data();
    
    // Generate next renewal date (for demo purposes)
    // In a real app, this would come from Stripe's API
    let renewalDate = userData.renewalDate;
    let nextBillingAmount = "$4.99";
    let status = userData.subscriptionStatus || "active";
    
    if (!renewalDate) {
      // If no renewal date exists, simulate one month from premium start date
      const premiumSince = userData.premiumSince ? new Date(userData.premiumSince) : new Date();
      const nextRenewal = new Date(premiumSince);
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);
      renewalDate = nextRenewal.toISOString();
      
      // Update the user document with this simulated renewal date
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
    // In a real implementation, this would call the Stripe API to cancel the subscription
    // For now, we'll just update our Firestore document
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists() || !userDoc.data().isPremium) {
      return false;
    }
    
    // Get the renewal date to use as cancel date
    const userData = userDoc.data();
    const renewalDate = userData.renewalDate || new Date().toISOString();
    
    // Update the user document to mark subscription as canceled at the end of the period
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
    
    // Update the user document to reactivate the subscription
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
    console.log('Creating checkout session for user:', userId, email);
    
    // API approach - call our server to create a checkout session
    try {
      // Full URL in production, relative in development
      const apiUrl = window.location.hostname !== 'localhost' 
        ? `${window.location.origin}/api/create-checkout-session` 
        : '/api/create-checkout-session';
      
      console.log('Using API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email,
        }),
      });
      
      console.log('Stripe API Response Status:', response.status);
      const responseText = await response.text();
      console.log('Stripe API Response Body:', responseText);
      
      if (!response.ok) {
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.error || `Server responded with status: ${response.status}`);
        } catch (parseError) {
          throw new Error(`Server error (${response.status}): ${responseText || 'No response body'}`);
        }
      }
      
      try {
        const data = JSON.parse(responseText);
        const { url } = data;
        
        if (!url) {
          throw new Error('Invalid response from server: Missing checkout URL');
        }
        
        console.log('Redirecting to Stripe checkout:', url);
        // Redirect to checkout
        window.location.href = url;
      } catch (parseError) {
        throw new Error(`Failed to parse response: ${parseError.message}`);
      }
    } catch (apiError) {
      console.error('Server-side checkout failed:', apiError);
      throw new Error('Payment processing error. Please try again or contact support.');
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

export const handleSuccessfulPayment = async (userId: string) => {
  try {
    console.log('Updating premium status for user:', userId);
    
    // Create a document reference directly with the user ID instead of querying
    const userDocRef = doc(db, 'users', userId);
    
    // Get the document to check if it exists
    const userDoc = await getDoc(userDocRef);
    
    const premiumData = {
      isPremium: true,
      premiumSince: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subscriptionStatus: 'active'
    };
    
    if (!userDoc.exists()) {
      // Create new user document with premium status
      await setDoc(userDocRef, {
        uid: userId,
        ...premiumData,
        createdAt: new Date().toISOString()
      });
      console.log('Created new user document with premium status');
    } else {
      // Update existing user document
      await updateDoc(userDocRef, premiumData);
      console.log('Updated existing user document with premium status');
    }
  } catch (error) {
    console.error('Error updating premium status:', error);
    throw error;
  }
}; 