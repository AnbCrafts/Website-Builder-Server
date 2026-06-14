import Stripe from 'stripe';
import Subscription from '../Schema/Subscription.Schema.js';
import User from '../Schema/User.Schema.js';
import asyncHandler from '../Utils/AsyncHandler.Util.js';
import ApiError from '../Utils/ApiError.Util.js';
import SuccessResponse from '../Utils/SuccessResponse.Util.js';

// Helper to initialize Stripe instances dynamically
const getStripeInstance = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_secret_key_nirman_ai_for_testing';
  return new Stripe(secretKey);
};

// 1. GENERATE CHECKOUT SESSION
export const createCheckoutSession = asyncHandler(async (req, res, next) => {
  const { plan } = req.body;
  const userId = req.user._id;
  const userEmail = req.user.email;

  if (!plan) {
    throw new ApiError(400, 'Billing plan tier is required');
  }

  // Get price ID based on selected tier
  let priceId = '';
  if (plan === 'basic') {
    priceId = process.env.STRIPE_BASIC_PRICE_ID || 'price_mock_basic_12345';
  } else if (plan === 'premium') {
    priceId = process.env.STRIPE_PREMIUM_PRICE_ID || 'price_mock_premium_12345';
  } else if (plan === 'agency') {
    priceId = process.env.STRIPE_AGENCY_PRICE_ID || 'price_mock_agency_12345';
  } else {
    throw new ApiError(400, `Unsupported plan tier: ${plan}`);
  }

  const stripe = getStripeInstance();

  // Find or create subscription profile record to cache customer ID
  let userSub = await Subscription.findOne({ userId });
  let stripeCustomerId = userSub?.stripeCustomerId;

  // Create Stripe customer if none exists
  if (!stripeCustomerId) {
    try {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId }
      });
      stripeCustomerId = customer.id;

      if (userSub) {
        userSub.stripeCustomerId = stripeCustomerId;
        await userSub.save();
      } else {
        userSub = await Subscription.create({
          userId,
          stripeCustomerId,
          plan: 'free',
          status: 'active'
        });
      }
    } catch (err) {
      // If Stripe secret key is mock or invalid, support mock checkout URL for developer speed
      if (process.env.STRIPE_SECRET_KEY === undefined || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_mock')) {
        const mockUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/billing?session_id=cs_mock_${Date.now()}&success=true&plan=${plan}`;
        return res.status(200).json(
          new SuccessResponse(200, { url: mockUrl, isMock: true }, 'Mock Checkout Session generated successfully')
        );
      }
      throw new ApiError(500, `Stripe customer creation failed: ${err.message}`);
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/billing?success=false`,
      metadata: { userId, plan }
    });

    return res.status(200).json(
      new SuccessResponse(200, { url: session.url, isMock: false }, 'Checkout Session generated successfully')
    );
  } catch (err) {
    // Mock checkout redirection fallback for testing environments without real keys
    if (process.env.STRIPE_SECRET_KEY === undefined || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_mock')) {
      const mockUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/billing?session_id=cs_mock_${Date.now()}&success=true&plan=${plan}`;
      return res.status(200).json(
        new SuccessResponse(200, { url: mockUrl, isMock: true }, 'Mock Checkout Session generated successfully')
      );
    }
    throw new ApiError(500, `Checkout Session creation failed: ${err.message}`);
  }
});

// 2. GENERATE BILLING PORTAL SESSION
export const createPortalSession = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const userSub = await Subscription.findOne({ userId });
  if (!userSub || !userSub.stripeCustomerId) {
    throw new ApiError(400, 'No billing account has been initialized. Please complete checkout first.');
  }

  const stripe = getStripeInstance();

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: userSub.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/billing`
    });

    return res.status(200).json(
      new SuccessResponse(200, { url: session.url, isMock: false }, 'Customer Portal generated successfully')
    );
  } catch (err) {
    if (process.env.STRIPE_SECRET_KEY === undefined || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_mock')) {
      const mockUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/billing?portal=mock`;
      return res.status(200).json(
        new SuccessResponse(200, { url: mockUrl, isMock: true }, 'Mock Customer Portal generated successfully')
      );
    }
    throw new ApiError(500, `Customer Portal creation failed: ${err.message}`);
  }
});

// 3. FETCH SUBSCRIPTION STATUS
export const getSubscriptionStatus = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  let userSub = await Subscription.findOne({ userId });
  
  if (!userSub) {
    userSub = await Subscription.create({
      userId,
      plan: 'free',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days trial/free window
    });
  }

  return res.status(200).json(
    new SuccessResponse(200, {
      plan: userSub.plan,
      status: userSub.status,
      currentPeriodStart: userSub.currentPeriodStart,
      currentPeriodEnd: userSub.currentPeriodEnd,
      cancelAtPeriodEnd: userSub.cancelAtPeriodEnd
    }, 'Subscription status retrieved successfully')
  );
});

// 4. STRIPE WEBHOOK EVENT SYNCHRONIZATION
export const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  const stripe = getStripeInstance();
  let event;

  // Verify signature and construct event
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // In local testing/fallback mode if signature header check is skipped or no secret key configured
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (err) {
    console.error(`⚠️  Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Signature Error: ${err.message}`);
  }

  const eventType = event.type;
  const dataObject = event.data.object;

  console.log(`🔔 Stripe Webhook Received event: ${eventType}`);

  try {
    // 4.1 checkout.session.completed
    if (eventType === 'checkout.session.completed') {
      const session = dataObject;
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan || 'free';

      if (userId && stripeSubscriptionId) {
        // Fetch full subscription info from Stripe to record periods
        let stripeSub = {
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
          cancel_at_period_end: false,
          items: { data: [{ price: { id: session.line_items?.[0]?.price?.id || '' } }] }
        };

        try {
          stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        } catch (e) {
          console.warn(`Could not retrieve subscription details from Stripe API: ${e.message}`);
        }

        await Subscription.findOneAndUpdate(
          { userId },
          {
            plan,
            status: stripeSub.status,
            stripeCustomerId,
            stripeSubscriptionId,
            stripePriceId: stripeSub.items?.data?.[0]?.price?.id || null,
            currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end
          },
          { upsert: true }
        );
        console.log(`🏆 Subscription activated for User ${userId}: plan=${plan}`);
      }
    }

    // 4.2 customer.subscription.updated
    if (eventType === 'customer.subscription.updated') {
      const stripeSub = dataObject;
      const stripeSubscriptionId = stripeSub.id;
      const status = stripeSub.status;

      // Find plan mapping from price ID
      const priceId = stripeSub.items?.data?.[0]?.price?.id;
      let plan = 'free';
      if (priceId) {
        if (priceId === process.env.STRIPE_BASIC_PRICE_ID) plan = 'basic';
        else if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) plan = 'premium';
        else if (priceId === process.env.STRIPE_AGENCY_PRICE_ID) plan = 'agency';
      }

      const updateFields = {
        status,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end
      };

      if (plan !== 'free') {
        updateFields.plan = plan;
      }

      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId },
        updateFields
      );
      console.log(`🔄 Subscription updated: subId=${stripeSubscriptionId}, status=${status}`);
    }

    // 4.3 customer.subscription.deleted
    if (eventType === 'customer.subscription.deleted') {
      const stripeSub = dataObject;
      const stripeSubscriptionId = stripeSub.id;

      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId },
        {
          plan: 'free',
          status: 'canceled',
          currentPeriodEnd: new Date()
        }
      );
      console.log(`❌ Subscription canceled/deleted: subId=${stripeSubscriptionId}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error(`❌ Webhook action handling error: ${error.message}`);
    res.status(500).json({ error: 'Webhook processing error', details: error.message });
  }
};

// 5. MOCK SUBSCRIPTION ACTIVATION FOR TESTING
export const mockActivateSubscription = asyncHandler(async (req, res, next) => {
  const { plan } = req.body;
  const userId = req.user._id;

  if (!plan) {
    throw new ApiError(400, 'Billing plan tier is required');
  }

  // Ensure plan is valid
  if (!['free', 'basic', 'premium', 'agency'].includes(plan)) {
    throw new ApiError(400, `Unsupported plan tier: ${plan}`);
  }

  const userSub = await Subscription.findOneAndUpdate(
    { userId },
    {
      plan,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      cancelAtPeriodEnd: false
    },
    { new: true, upsert: true }
  );

  return res.status(200).json(
    new SuccessResponse(200, {
      plan: userSub.plan,
      status: userSub.status,
      currentPeriodStart: userSub.currentPeriodStart,
      currentPeriodEnd: userSub.currentPeriodEnd,
      cancelAtPeriodEnd: userSub.cancelAtPeriodEnd
    }, 'Mock subscription activated successfully')
  );
});
