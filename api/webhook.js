// Import required Stripe and Firebase modules
import Stripe from 'stripe';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin SDK initialized');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
}

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

// Webhook event handlers
async function handleCheckoutSessionCompleted(session) {
  const userId = session.client_reference_id || (session.metadata && session.metadata.userId);
  
  if (!userId) {
    console.error('User ID missing in session:', session.id);
    return;
  }
  
  try {
    // Only proceed if Firebase is initialized
    if (admin.apps.length) {
      const db = admin.firestore();
      
      // Enhanced premium data with Stripe information
      const premiumData = {
        isPremium: true,
        premiumSince: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subscriptionId: session.subscription,
        stripeCustomerId: session.customer,
        subscriptionStatus: 'active',
        paymentSource: 'stripe',
        subscriptionType: 'monthly'
      };
      
      await db.collection('users').doc(userId).set(premiumData, { merge: true });
      console.log('Successfully updated premium status for user:', userId);
    }
  } catch (updateError) {
    console.error('Error updating user premium status:', updateError);
  }
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  
  try {
    if (admin.apps.length) {
      const db = admin.firestore();
      
      // Find the user with this customer ID
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();
      
      if (snapshot.empty) {
        console.log('No user found with customer ID:', customerId);
        return;
      }
      
      // Should be only one user with this customer ID
      snapshot.forEach(async (doc) => {
        const userData = doc.data();
        const userId = doc.id;
        
        const updateData = {
          updatedAt: new Date().toISOString(),
          subscriptionStatus: subscription.status,
        };
        
        // If subscription is canceled or past_due, mark as not premium
        if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
          updateData.isPremium = false;
        }
        
        await db.collection('users').doc(userId).update(updateData);
        console.log(`Updated subscription status to ${subscription.status} for user:`, userId);
      });
    }
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionCancelled(subscription) {
  const customerId = subscription.customer;
  
  try {
    if (admin.apps.length) {
      const db = admin.firestore();
      
      // Find the user with this customer ID
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();
      
      if (snapshot.empty) {
        console.log('No user found with customer ID:', customerId);
        return;
      }
      
      // Should be only one user with this customer ID
      snapshot.forEach(async (doc) => {
        const userId = doc.id;
        
        await db.collection('users').doc(userId).update({
          isPremium: false,
          subscriptionStatus: 'canceled',
          updatedAt: new Date().toISOString(),
        });
        
        console.log('Marked subscription as canceled for user:', userId);
      });
    }
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

export default async function handler(req, res) {
  // Check that this is a POST request
  if (req.method !== 'POST') {
    console.error('Method not allowed:', req.method);
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Get the signature from the headers
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    console.error('No Stripe signature found');
    return res.status(400).json({ error: 'Webhook Error: No signature header' });
  }

  let event;
  try {
    // Use raw body for signature verification
    const rawBody = await buffer(req);
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!stripeWebhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      stripeWebhookSecret
    );
    
    console.log('Webhook verified, processing event:', event.type);
    
    // Handle each event type appropriately
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    // Return success
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(400).json({ error: `Webhook Error: ${error.message}` });
  }
}

// Helper function to get the raw request body
export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(req) {
  const chunks = [];
  
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  
  return Buffer.concat(chunks);
} 