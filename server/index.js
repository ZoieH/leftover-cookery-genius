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
  origin: ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:5173', process.env.FRONTEND_URL],
  credentials: true
}));

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
  console.log('Webhook received');
  const sig = req.headers['stripe-signature'];
  console.log('Signature:', sig ? 'Present' : 'Missing');

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('Webhook verified, event type:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      // Handle successful payment
      const userId = session.client_reference_id || (session.metadata && session.metadata.userId);
      console.log('Payment successful for user:', userId);
      
      if (userId) {
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
          // We don't want to fail the webhook if this fails
        }
      } else {
        console.error('User ID missing in session:', session);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Create checkout session endpoint
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    console.log('Received request for checkout session:', req.body);
    const { userId, email } = req.body;

    if (!userId || !email) {
      console.log('Missing required fields:', { userId, email });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('Using price ID:', process.env.VITE_STRIPE_PREMIUM_PRICE_ID);
    console.log('Environment variables:', {
      FRONTEND_URL: process.env.FRONTEND_URL,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not set',
      VITE_STRIPE_PREMIUM_PRICE_ID: process.env.VITE_STRIPE_PREMIUM_PRICE_ID ? 'Set' : 'Not set',
    });

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
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 