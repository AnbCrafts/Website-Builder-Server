import { z } from 'zod';

export const workspaceValidationSchema = z.object({
  name: z.string().min(1, 'Workspace name cannot be empty').max(50, 'Workspace name cannot exceed 50 characters').trim(),
  slug: z.string().trim().lowercase().optional(),
  description: z.string().max(250, 'Description cannot exceed 250 characters').trim().optional(),
  ownerId: z.string().min(1, 'Workspace owner ID is required'),
  collaborators: z.array(z.object({
    userId: z.string().min(1, 'Collaborator User ID reference is required'),
    role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
    joinedAt: z.coerce.date().optional()
  })).optional(),
  projects: z.array(z.string()).optional(),
  projectCount: z.number().nonnegative().optional(),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
  deletedAt: z.coerce.date().nullable().optional(),
  
  // Settings nested object validation
  settings: z.object({
    defaultTheme: z.enum(['dark', 'light']).optional(),
    customDomain: z.string().nullable().optional(),
    isPublic: z.boolean().optional()
  }).optional(),
  
  // Fields for collaborator onboarding validation
  email: z.string().email('Please fill a valid email address').trim().toLowerCase().optional(),
  role: z.enum(['admin', 'editor', 'viewer']).optional()
});

