import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:5173', process.env.FRONTEND_URL],
  credentials: true
}));

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
      success_url: `${process.env.FRONTEND_URL}/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/upgrade?canceled=true`,
      customer_email: email,
      client_reference_id: userId,
    });

    console.log('Created checkout session:', session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Webhook endpoint
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      // Handle successful payment
      console.log('Payment successful for user:', session.client_reference_id);
      // Here you would update the user's premium status in your database
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 