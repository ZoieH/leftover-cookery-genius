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
    // Use the Stripe Payment Link with coupon support
    const paymentLinkUrl = "https://buy.stripe.com/cN26rbbQG1Ylb7y8ww";
    
    // Add client reference ID and prefilled email to the URL
    const urlWithParams = new URL(paymentLinkUrl);
    urlWithParams.searchParams.append("client_reference_id", userId);
    urlWithParams.searchParams.append("prefilled_email", email);
    
    // Add success and cancel URL parameters with proper encoding
    const successUrl = `${window.location.origin}/payment-success?user=${encodeURIComponent(userId)}&success=true`;
    const cancelUrl = `${window.location.origin}/payment-canceled?returnUrl=${encodeURIComponent(window.location.pathname)}`;
    
    urlWithParams.searchParams.append("success_url", successUrl);
    urlWithParams.searchParams.append("cancel_url", cancelUrl);
    
    // Redirect to the payment link
    window.location.href = urlWithParams.toString();
    
  } catch (error) {
    console.error('Error redirecting to checkout:', error);
    throw new Error('Payment processing error. Please try again or contact support.');
  }
};

export const handleSuccessfulPayment = async (userId: string) => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    const premiumData = {
      isPremium: true,
      premiumSince: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subscriptionStatus: 'active'
    };
    
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid: userId,
        ...premiumData,
        createdAt: new Date().toISOString()
      });
    } else {
      await updateDoc(userDocRef, premiumData);
    }
    
    // Update local state as a fallback
    localStorage.setItem('isPremium', 'true');
    localStorage.setItem('premiumSince', new Date().toISOString());
  } catch (error) {
    console.error('Error updating premium status:', error);
    // Always ensure user gets premium access by updating local storage
    localStorage.setItem('isPremium', 'true');
    localStorage.setItem('premiumSince', new Date().toISOString());
    throw error;
  }
}; 