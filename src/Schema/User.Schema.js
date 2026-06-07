import mongoose from 'mongoose';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => `usr_${crypto.randomBytes(8).toString('hex')}`
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please fill a valid email address'
    ]
  },
  password: {
    type: String,
    // Made optional to support OAuth/Social Logins seamlessly in the future
    required: function() { return !this.googleId; },
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  googleId: {
    type: String,
    default: null,
    index: true
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  workspaces: [{
    type: String,
    ref: 'Workspace'
  }],
  currentWorkspace: {
    type: String,
    ref: 'Workspace',
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Index email for blazing fast authentication lookups
userSchema.index({ email: 1 });

const User = mongoose.model('User', userSchema);
export default User;