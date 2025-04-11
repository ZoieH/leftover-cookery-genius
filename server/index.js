const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const dotenv = require('dotenv');
const path = require('path');
const admin = require('firebase-admin');

// Load environment variables
dotenv.config();

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
} else {
  console.warn('Firebase Admin SDK credentials not provided - webhook cannot update database');
}

const app = express();

// Middleware for CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL] 
    : ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:5173', process.env.FRONTEND_URL],
  credentials: true
}));

// Middleware to handle preflight requests
app.options('*', cors());

// Add security headers for production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Protect against clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Help protect against XSS
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Help protect against sniff attacks
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Strict transport security
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    // Prevent loading in an iframe
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    // Enable referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
}

// Special handling for Stripe webhooks
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

// For Stripe webhook - must come before express.json() middleware
app.post('/api/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  // Production logging should be minimal
  console.log('Webhook received');
  
  if (!sig) {
    console.error('Webhook Error: No signature header');
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
      // Handle more event types as needed
      default:
        // For unhandled events, just log their type
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Extracted webhook event handlers
async function handleCheckoutSessionCompleted(session) {
  const userId = session.client_reference_id || (session.metadata && session.metadata.userId);
  console.log('Payment successful for user:', userId);
  
  if (!userId) {
    console.error('User ID missing in session:', session.id);
    return;
  }
  
  try {
    // Update user's premium status in Firestore using Firebase Admin SDK
    const db = admin.firestore();
    const premiumData = {
      isPremium: true,
      premiumSince: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subscriptionId: session.subscription,
      stripeCustomerId: session.customer,
      subscriptionStatus: 'active'
    };
    
    // Update Firestore using document ID as userId
    await db.collection('users').doc(userId).set(premiumData, { merge: true });
    
    console.log('Successfully updated premium status for user:', userId);
  } catch (updateError) {
    console.error('Error updating user premium status:', updateError);
    // In production, consider sending alerts for critical failures
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    // Find the user with this subscription ID
    const db = admin.firestore();
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('subscriptionId', '==', subscription.id).get();
    
    if (snapshot.empty) {
      console.log('No user found with subscription ID:', subscription.id);
      return;
    }
    
    // Update subscription status
    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({
      subscriptionStatus: subscription.status,
      updatedAt: new Date().toISOString()
    });
    
    console.log('Updated subscription status for user:', userDoc.id);
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionCancelled(subscription) {
  try {
    // Find the user with this subscription ID
    const db = admin.firestore();
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('subscriptionId', '==', subscription.id).get();
    
    if (snapshot.empty) {
      console.log('No user found with subscription ID:', subscription.id);
      return;
    }
    
    // Update user document
    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({
      subscriptionStatus: 'canceled',
      isPremium: subscription.cancel_at_period_end ? true : false, // Keep premium until period end
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      updatedAt: new Date().toISOString()
    });
    
    console.log('Updated subscription cancellation for user:', userDoc.id);
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

// Add a route to catch all methods for the checkout endpoint
app.all('/api/create-checkout-session', (req, res, next) => {
  if (req.method === 'POST') {
    next();
  } else {
    console.warn(`Method ${req.method} not allowed on /api/create-checkout-session`);
    res.status(405).json({ error: 'Method not allowed', allowedMethods: ['POST'] });
  }
});

// Add a simple status endpoint to check server health
app.get('/api/status', (req, res) => {
  const status = {
    server: 'online',
    timestamp: new Date().toISOString(),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'not-configured',
      adminInitialized: !!admin.apps.length
    },
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.json(status);
});

// Create checkout session endpoint
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    // Debugging logs for Vercel deployment
    console.log('Checkout request received', {
      body: req.body,
      method: req.method,
      path: req.path,
      headers: req.headers['content-type']
    });
    
    // Check environment variables
    console.log('Environment variables check:', {
      stripe_key_length: process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.length : 0,
      price_id_exists: !!process.env.VITE_STRIPE_PREMIUM_PRICE_ID,
      price_id: process.env.VITE_STRIPE_PREMIUM_PRICE_ID,
      frontend_url: process.env.FRONTEND_URL,
      firebase_project: process.env.FIREBASE_PROJECT_ID,
      firebase_email_exists: !!process.env.FIREBASE_CLIENT_EMAIL,
      firebase_key_length: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0
    });
    
    const { userId, email } = req.body;

    if (!userId || !email) {
      console.error('Missing required fields in request body');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create a simplified checkout session - skipping customer creation for now
    try {
      console.log('Creating Stripe checkout session...');
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: process.env.VITE_STRIPE_PREMIUM_PRICE_ID,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL}/payment-success?user=${encodeURIComponent(userId)}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment-canceled`,
        customer_email: email,
        client_reference_id: userId,
        metadata: {
          userId: userId
        }
      });

      console.log('Created checkout session:', session.id);
      res.json({ url: session.url });
    } catch (stripeError) {
      console.error('Stripe API error details:', {
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message,
        param: stripeError.param,
        statusCode: stripeError.statusCode,
        requestId: stripeError.requestId,
        rawType: stripeError.raw?.type,
        rawMessage: stripeError.raw?.message
      });
      throw stripeError; // Re-throw for general error handling
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    // Extract relevant error details for diagnosis
    const errorDetails = {
      message: error.message,
      name: error.name,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      stripeError: error.type ? {
        type: error.type,
        code: error.code,
        param: error.param
      } : undefined
    };
    
    console.error('Error details:', JSON.stringify(errorDetails));
    
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      message: process.env.NODE_ENV === 'production' 
        ? 'An error occurred while processing your request' 
        : error.message,
      // Only include debug info if not in production
      debug: process.env.NODE_ENV !== 'production' ? errorDetails : undefined
    });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 