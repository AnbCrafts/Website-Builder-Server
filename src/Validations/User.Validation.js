import { z } from 'zod';

export const userValidationSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long').trim(),
  email: z.string().email('Please fill a valid email address').trim().toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  googleId: z.string().nullable().optional(),
  avatarUrl: z.string().url('Avatar URL must be a valid URL').or(z.string().max(0)).optional(),
  workspaces: z.array(z.string()).optional(),
  currentWorkspace: z.string().nullable().optional(),
  workspaceId: z.string().min(1).optional(),
  isVerified: z.boolean().optional(),
  role: z.enum(['user', 'admin']).optional()
});
