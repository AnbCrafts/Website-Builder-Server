import mongoose from 'mongoose';
import crypto from 'crypto';

// --- 1. COLLABORATOR SCHEMA ---
const collaboratorSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    ref: 'User', 
    required: [true, 'Collaborator User ID reference is required'],
    index: true
  },
  role: { 
    type: String, 
    enum: ['admin', 'editor', 'viewer'], 
    default: 'viewer' 
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false }); // Avoid subdocument ID overhead

// --- 2. WORKSPACE SETTINGS SCHEMA ---
const workspaceSettingsSchema = new mongoose.Schema({
  defaultTheme: { 
    type: String, 
    enum: ['dark', 'light'], 
    default: 'dark' 
  },
  customDomain: { 
    type: String, 
    default: null,
    sparse: true, // Optimizes index space for null parameters
    trim: true
  },
  isPublic: { 
    type: Boolean, 
    default: false 
  }
}, { _id: false });

// --- 3. MAIN WORKSPACE SCHEMA ---
const workspaceSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => `wsp_${crypto.randomBytes(8).toString('hex')}`
  },
  name: {
    type: String,
    required: [true, 'Workspace name is required'],
    trim: true,
    maxlength: [50, 'Workspace name cannot exceed 50 characters'],
    minlength: [1, 'Workspace name cannot be empty']
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    // Note: To enforce uniqueness across a user's account, add a compound index below
  },
  description: {
    type: String,
    trim: true,
    maxlength: [250, 'Description cannot exceed 250 characters'],
    default: ''
  },
  ownerId: {
    type: String,
    ref: 'User',
    required: [true, 'Workspace owner ID is required'],
    index: true // High-performance lookup query indexing
  },
  collaborators: [collaboratorSchema],
  projects: [{
    type: String,
    ref: 'Project'
  }],
  projectCount: {
    type: Number,
    default: 0,
    min: 0
  },
  settings: {
    type: workspaceSettingsSchema,
    default: () => ({ defaultTheme: 'dark', customDomain: null, isPublic: false })
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active',
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'workspaces'
});

// --- COMPOUND INDEXES FOR MAXIMUM IN-MEMORY FETCH PERFORMANCE ---
// Guarantees a single user cannot create duplicate workspace URL slugs
workspaceSchema.index({ ownerId: 1, slug: 1 }, { unique: true });

// Pre-save hook middleware to auto-generate basic standard URL slugs from workspace name
workspaceSchema.pre('validate', function (next) {
  if (this.name && (!this.slug || this.isModified('name'))) {
    this.slug = this.name
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-') // Replaces spaces and special chars with a clean dash '-'
      .replace(/^-+|-+$/g, '');  // Trims leading/trailing dashes
  }
  next();
});

const Workspace = mongoose.model('Workspace', workspaceSchema);
export default Workspace;