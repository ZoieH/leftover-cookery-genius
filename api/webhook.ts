// Import required Stripe and Firebase modules
import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

// We will use dynamic imports for Firebase Admin to avoid TypeScript errors
let admin: any;
const initializeFirebase = async () => {
  if (typeof window === 'undefined') {
    // Only import on the server side
    const adminModule = await import('firebase-admin');
    admin = adminModule.default;
    
    if (!admin.apps.length) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID as string,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY as string)?.replace(/\\n/g, '\n'),
          }),
        });
        console.log('Firebase Admin SDK initialized for webhook');
      } catch (error) {
        console.error('Error initializing Firebase Admin SDK:', error);
      }
    }
  }
  return admin;
};

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Type-safe interfaces for Stripe objects
interface CheckoutSessionData {
  id: string;
  client_reference_id?: string;
  metadata?: {
    userId?: string;
    [key: string]: string | undefined;
  };
  subscription?: string;
  customer?: string;
}

interface SubscriptionData {
  customer: string;
  status: string;
}

// Webhook event handlers
async function handleCheckoutSessionCompleted(session: CheckoutSessionData): Promise<void> {
  const admin = await initializeFirebase();
  if (!admin) return;
  
  const userId = session.client_reference_id || (session.metadata && session.metadata.userId);
  
  if (!userId) {
    console.error('User ID missing in session:', session.id);
    return;
  }
  
  try {
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
  } catch (updateError) {
    console.error('Error updating user premium status:', updateError);
  }
}

async function handleSubscriptionUpdated(subscription: SubscriptionData): Promise<void> {
  const admin = await initializeFirebase();
  if (!admin) return;
  
  const customerId = subscription.customer;
  
  try {
    const db = admin.firestore();
    
    // Find the user with this customer ID
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();
    
    if (snapshot.empty) {
      console.log('No user found with customer ID:', customerId);
      return;
    }
    
    // Should be only one user with this customer ID
    const updates: Promise<any>[] = [];
    snapshot.forEach((doc: any) => {
      const userId = doc.id;
      
      const updateData = {
        updatedAt: new Date().toISOString(),
        subscriptionStatus: subscription.status,
      };
      
      // If subscription is canceled or past_due, mark as not premium
      if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
        updateData.isPremium = false;
      }
      
      updates.push(db.collection('users').doc(userId).update(updateData));
      console.log(`Updating subscription status to ${subscription.status} for user:`, userId);
    });
    
    await Promise.all(updates);
    console.log('All user records updated successfully');
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionCancelled(subscription: SubscriptionData): Promise<void> {
  const admin = await initializeFirebase();
  if (!admin) return;
  
  const customerId = subscription.customer;
  
  try {
    const db = admin.firestore();
    
    // Find the user with this customer ID
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();
    
    if (snapshot.empty) {
      console.log('No user found with customer ID:', customerId);
      return;
    }
    
    // Should be only one user with this customer ID
    const updates: Promise<any>[] = [];
    snapshot.forEach((doc: any) => {
      const userId = doc.id;
      
      updates.push(db.collection('users').doc(userId).update({
        isPremium: false,
        subscriptionStatus: 'canceled',
        updatedAt: new Date().toISOString(),
      }));
      
      console.log('Marking subscription as canceled for user:', userId);
    });
    
    await Promise.all(updates);
    console.log('All cancellations processed successfully');
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Initialize Firebase
  await initializeFirebase();
  
  // Check that this is a POST request
  if (req.method !== 'POST') {
    console.error('Method not allowed:', req.method);
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  // Get the signature from the headers
  const sig = req.headers['stripe-signature'] as string;
  if (!sig) {
    console.error('No Stripe signature found');
    res.status(400).json({ error: 'Webhook Error: No signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    // Use raw body for signature verification
    const rawBody = await buffer(req);
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
    
    if (!stripeWebhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
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
        await handleCheckoutSessionCompleted(event.data.object as any);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as any);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object as any);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    // Return success
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    res.status(400).json({ error: `Webhook Error: ${error.message}` });
  }
}

// Special Next.js API configuration to get raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to get the raw request body
async function buffer(req: NextApiRequest): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', reject);
  });
} 