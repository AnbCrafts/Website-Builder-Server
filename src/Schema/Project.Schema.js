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
    default: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <script src="https://cdn.tailwindcss.com"></script>\n  <style>\n    /* Custom CSS Stylesheet */\n    body {\n      background-color: #0A0A0C;\n      color: #FFFFFF;\n      font-family: sans-serif;\n    }\n  </style>\n</head>\n<body class="bg-[#0A0A0C] text-white min-h-screen flex items-center justify-center">\n  <div class="p-8 max-w-md text-center space-y-4 border border-gray-900 bg-[#111318]/40 backdrop-blur-md rounded-2xl">\n    <h1 class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-500">Nirman.AI Sandbox</h1>\n    <p class="text-xs text-gray-500 font-mono uppercase tracking-wider">compiler node ready</p>\n    <p class="text-xs text-gray-400 leading-relaxed">Send an AI Pilot message on the right to generate your website layout, or write custom HTML/CSS/JS directly in the Monaco editor.</p>\n  </div>\n  <script>\n    // Custom JavaScript Logic\n    console.log(\'Nirman.AI Sandbox Node Initialized Successfully.\');\n  </script>\n</body>\n</html>'
  },
  status: {
    type: String,
    enum: ['idle', 'planning', 'generating', 'compiling', 'auditing', 'completed', 'failed'],
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
  },
  pipelineState: {
    currentStage: { 
      type: String, 
      enum: ['idle', 'planning', 'architecting', 'copywriting', 'assets', 'synthesis', 'validating', 'fixing', 'scoring', 'completed', 'failed'],
      default: 'idle' 
    },
    percentage: { type: Number, default: 0 },
    stageLogs: { type: String, default: '' },
    blueprint: { type: mongoose.Schema.Types.Mixed, default: null },
    content: { type: mongoose.Schema.Types.Mixed, default: null }
  }
}, {
  timestamps: true,
  collection: 'projects'
});

// Compound index to speed up fetching a user's target projects inside specific workspaces
projectSchema.index({ ownerId: 1, workspaceId: 1 });

const Project = mongoose.model('Project', projectSchema);
export default Project;