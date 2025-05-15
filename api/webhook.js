const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { handleSuccessfulPayment } = require('../src/services/stripeService');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');
const { buffer } = require('micro');


export const config = {
  api: {
    bodyParser: false,
  },
};

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default async function handler(req, res) {
  console.log('Webhook received');
  console.log('raw request', req);
  console.log(req.headers);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  console.log('sig', sig);
  const buf = await buffer(req);
  console.log('buf', buf);
  console.log('req.text', req.text());
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Payment successful:', session.id);
        
        if (session.client_reference_id) {
          // Update user's premium status in Firebase
          const userRef = doc(db, 'users', session.client_reference_id);
          await updateDoc(userRef, {
            isPremium: true,
            premiumSince: new Date().toISOString(),
            lastPaymentDate: new Date().toISOString()
          });
          console.log('Updated premium status for user:', session.client_reference_id);
        }
        break;

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, {
            isPremium: subscription.status === 'active',
            premiumSince: subscription.status === 'active' ? new Date().toISOString() : null,
            lastPaymentDate: subscription.status === 'active' ? new Date().toISOString() : null
          });
          console.log('Updated subscription status for user:', userId);
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

