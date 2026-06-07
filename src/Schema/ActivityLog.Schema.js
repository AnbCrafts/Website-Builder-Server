import mongoose from 'mongoose';
import crypto from 'crypto';

const activityLogSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => `log_${crypto.randomBytes(8).toString('hex')}`
  },
  userId: {
    type: String,
    ref: 'User',
    required: [true, 'User reference ID is required'],
    index: true // Critically important for fast dashboard audit logs
  },
  action: { 
    type: String, 
    required: true,
    enum: [
      'USER_LOGIN', 'USER_LOGOUT', 
      'WORKSPACE_CREATE', 'WORKSPACE_DELETE', 
      'PROJECT_GENERATE', 'PROJECT_EDIT', 'PROJECT_DELETE',
      'BILLING_PORTAL_ACCESS', 'SUBSCRIPTION_UPDATED'
    ]
  },
  details: { 
    type: String, 
    default: '' 
  },
  ipAddress: { 
    type: String, 
    default: '' 
  },
  userAgent: {
    type: String,
    default: ''
  }
}, {
  timestamps: true, // Auto-generates standard createdAt timestamp metrics
  collection: 'activity_logs'
});

// Compound index optimized to sort and display user logs chronologically
activityLogSchema.index({ userId: 1, createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;