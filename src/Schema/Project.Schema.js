import mongoose from 'mongoose';
import crypto from 'crypto';

// --- 1. HISTORY SCHEMA (VERSION CONTROL & TIME-TRAVEL) ---
const historySchema = new mongoose.Schema({
  version: { 
    type: Number, 
    required: true 
  },
  codeSnapshot: { 
    type: String, 
    required: true 
  },
  promptSnapshot: {
    type: String,
    default: ''
  },
  agentLogs: {
    layoutArchitect: {
      success: { type: Boolean, default: true },
      latencyMs: { type: Number, default: 0 },
      tokensUsed: { type: Number, default: 0 },
      summary: { type: String, default: '' }
    },
    copywriter: {
      success: { type: Boolean, default: true },
      latencyMs: { type: Number, default: 0 },
      tokensUsed: { type: Number, default: 0 },
      summary: { type: String, default: '' }
    },
    illustrator: {
      success: { type: Boolean, default: true },
      imagesGenerated: { type: [String], default: [] }
    }
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
}, { _id: false }); // Prevents nested subdocuments from generating unnecessary _ids

// --- 2. WARNING SCHEMA (DESIGN CRITIC AUDITS) ---
const warningSchema = new mongoose.Schema({
  id: { 
    type: String, 
    default: () => `warn_${crypto.randomBytes(4).toString('hex')}` 
  },
  type: { 
    type: String, 
    enum: ['Accessibility', 'Performance', 'SEO', 'Tailwind Layout', 'Structure Error'],
    required: true 
  },
  severity: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'], 
    default: 'low' 
  },
  message: { 
    type: String, 
    required: true 
  },
  location: {
    line: { type: Number, default: null },
    column: { type: Number, default: null },
    elementTag: { type: String, default: '' }
  }
}, { _id: false });

// --- 3. DESIGN AUDIT SCHEMA ---
const designAuditSchema = new mongoose.Schema({
  score: { 
    type: Number, 
    min: 0, 
    max: 100, 
    default: 100 
  },
  lastAuditedAt: { 
    type: Date, 
    default: null 
  },
  warnings: [warningSchema]
}, { _id: false });

// --- 4. PROJECT SETTINGS SCHEMA ---
const projectSettingsSchema = new mongoose.Schema({
  theme: { 
    type: String, 
    enum: ['dark', 'light'], 
    default: 'dark' 
  },
  framework: { 
    type: String, 
    default: 'TailwindCSS + GSAP Core' 
  },
  enableAiAutosave: {
    type: Boolean,
    default: true
  }
}, { _id: false });

// --- 5. MAIN PROJECT SCHEMA ---
const projectSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => `prj_${crypto.randomBytes(8).toString('hex')}`
  },
  workspaceId: {
    type: String,
    ref: 'Workspace',
    required: [true, 'Workspace ID is required'],
    index: true // Highly optimized for relational workspace fetching queries
  },
  ownerId: {
    type: String,
    ref: 'User',
    required: [true, 'Owner ID is required'],
    index: true // Highly optimized for fetching user dashboard profiles
  },
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
    minlength: [1, 'Title cannot be empty']
  },
  metaPrompt: {
    type: String,
    trim: true,
    default: ''
  },
  currentCode: {
    type: String,
    required: [true, 'Current code state template is required'],
    default: '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n</head>\n<body>\n</body>\n</html>'
  },
  status: {
    type: String,
    enum: ['idle', 'generating', 'compiling', 'auditing', 'completed', 'failed'],
    default: 'idle'
  },
  visibility: {
    type: String,
    enum: ['private', 'public'],
    default: 'private'
  },
  history: [historySchema],
  designAudit: {
    type: designAuditSchema,
    default: () => ({ score: 100, lastAuditedAt: null, warnings: [] })
  },
  settings: {
    type: projectSettingsSchema,
    default: () => ({ theme: 'dark', framework: 'TailwindCSS + GSAP Core', enableAiAutosave: true })
  }
}, {
  timestamps: true,
  collection: 'projects'
});

// Compound index to speed up fetching a user's target projects inside specific workspaces
projectSchema.index({ ownerId: 1, workspaceId: 1 });

const Project = mongoose.model('Project', projectSchema);
export default Project;