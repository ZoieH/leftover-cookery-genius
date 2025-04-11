const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

// Load environment variables
dotenv.config();

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

// Initialize Firebase Admin (if environment variables are set)
if (process.env.FIREBASE_PROJECT_ID && 
    process.env.FIREBASE_CLIENT_EMAIL && 
    process.env.FIREBASE_PRIVATE_KEY) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin SDK initialized');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
}

const app = express();

// Middleware for CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL] 
    : ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:5173', process.env.FRONTEND_URL],
  credentials: true
}));

// Middleware to parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/api/status', (req, res) => {
  res.json({
    server: 'online',
    timestamp: new Date().toISOString(),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      adminInitialized: !!admin.apps.length
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// Webhook endpoint for Stripe events
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  if (!sig) {
    return res.status(400).send('Webhook Error: No signature header');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

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

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Webhook event handlers
async function handleCheckoutSessionCompleted(session) {
  const userId = session.client_reference_id || (session.metadata && session.metadata.userId);
  
  if (!userId) {
    console.error('User ID missing in session:', session.id);
    return;
  }
  
  try {
    if (admin.apps.length) {
      const db = admin.firestore();
      const premiumData = {
        isPremium: true,
        premiumSince: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subscriptionId: session.subscription,
        stripeCustomerId: session.customer,
        subscriptionStatus: 'active'
      };
      
      await db.collection('users').doc(userId).set(premiumData, { merge: true });
      console.log('Successfully updated premium status for user:', userId);
    }
  } catch (updateError) {
    console.error('Error updating user premium status:', updateError);
  }
}

async function handleSubscriptionUpdated(subscription) {
  // Handle subscription updates
  console.log('Subscription updated:', subscription.id);
}

async function handleSubscriptionCancelled(subscription) {
  // Handle subscription cancellations
  console.log('Subscription cancelled:', subscription.id);
}

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 