import mongoose from 'mongoose';
import crypto from 'crypto';

const subscriptionSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => `sub_${crypto.randomBytes(8).toString('hex')}`
  },
  userId: {
    type: String,
    ref: 'User',
    required: [true, 'User reference ID is required'],
    unique: true, // One subscription profile per user account
    index: true
  },
  plan: { 
    type: String, 
    enum: ['free', 'basic', 'premium', 'agency'], 
    default: 'free' 
  },
  status: { 
    type: String, 
    enum: ['active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'expired'], 
    default: 'active' 
  },
  stripeCustomerId: { 
    type: String, 
    default: null,
    index: true 
  },
  stripeSubscriptionId: { 
    type: String, 
    default: null,
    index: true 
  },
  stripePriceId: {
    type: String,
    default: null
  },
  currentPeriodStart: { 
    type: Date, 
    default: Date.now 
  },
  currentPeriodEnd: { 
    type: Date, 
    default: null 
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'subscriptions'
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;