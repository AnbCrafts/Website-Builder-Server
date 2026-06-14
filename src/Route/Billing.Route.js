import express from 'express';
import { createCheckoutSession, createPortalSession, getSubscriptionStatus, mockActivateSubscription } from '../Controller/Billing.Controller.js';
import { authenticateUser } from '../Middlewares/User.Middleware.js';
import { validateFields } from '../Middlewares/Common.Middleware.js';

const BillingRouter = express.Router();

// Validation schema config
const checkoutSchema = {
  _schema: 'Billing',
  plan: ''
};

// Billing endpoints
BillingRouter.post('/billing/checkout', authenticateUser, validateFields(checkoutSchema), createCheckoutSession);
BillingRouter.post('/billing/portal', authenticateUser, createPortalSession);
BillingRouter.get('/billing/status', authenticateUser, getSubscriptionStatus);
BillingRouter.post('/billing/mock-activate', authenticateUser, validateFields(checkoutSchema), mockActivateSubscription);

export default BillingRouter;
