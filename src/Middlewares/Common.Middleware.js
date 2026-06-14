import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { userValidationSchema } from '../Validations/User.Validation.js';
import { workspaceValidationSchema } from '../Validations/Workspace.Validation.js';
import { projectValidationSchema } from '../Validations/Project.Validation.js';
import { billingValidationSchema } from '../Validations/Billing.Validation.js';

// --- 1. DYNAMIC VALIDATOR MIDDLEWARE ---
const getSchemaForFields = (fieldsObj) => {
  if (fieldsObj._schema === 'User') return userValidationSchema;
  if (fieldsObj._schema === 'Workspace') return workspaceValidationSchema;
  if (fieldsObj._schema === 'Project') return projectValidationSchema;
  if (fieldsObj._schema === 'Billing') return billingValidationSchema;


  const keys = Object.keys(fieldsObj).filter(k => k !== '_schema');
  
  if (keys.includes('email') || keys.includes('username') || keys.includes('password') || keys.includes('googleId')) {
    return userValidationSchema;
  }
  if (keys.includes('currentCode') || keys.includes('metaPrompt') || keys.includes('title') || keys.includes('workspaceId')) {
    return projectValidationSchema;
  }
  if (keys.includes('ownerId') || keys.includes('slug') || keys.includes('collaborators') || keys.includes('projectCount')) {
    return workspaceValidationSchema;
  }
  if (keys.includes('name')) {
    return workspaceValidationSchema;
  }
  if (keys.includes('plan')) {
    return billingValidationSchema;
  }

  throw new Error('Could not automatically determine validation schema for fields: ' + keys.join(', '));
};


export const validateFields = (fieldsObj) => {
  return (req, res, next) => {
    try {
      const masterSchema = getSchemaForFields(fieldsObj);
      const keysToValidate = Object.keys(fieldsObj).filter(k => k !== '_schema');
      
      // Pick specified fields dynamically
      const mask = {};
      keysToValidate.forEach((key) => {
        mask[key] = true;
      });
      
      const pickedSchema = masterSchema.pick(mask);
      const validatedData = pickedSchema.parse(req.body);
      
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          details: (error.issues || error.errors || []).map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      return res.status(400).json({ error: 'Validation Error', message: error.message });
    }
  };
};

// --- 2. GLOBAL RATE LIMITER ---
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// --- 3. AI GENERATION RATE LIMITER ---
export const aiGenerationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 generations per hour
  message: {
    error: 'AI Generation Limit Exceeded',
    message: 'You have reached the maximum AI generations allowed per hour. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
