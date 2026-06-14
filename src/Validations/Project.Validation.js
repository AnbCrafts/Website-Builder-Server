import { z } from 'zod';

export const projectValidationSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  ownerId: z.string().min(1, 'Owner ID is required'),
  title: z.string().min(1, 'Project title cannot be empty').max(100, 'Title cannot exceed 100 characters').trim(),
  metaPrompt: z.string().trim().optional(),
  currentCode: z.string().min(1, 'Current code state template is required'),
  status: z.enum(['idle', 'generating', 'compiling', 'auditing', 'completed', 'failed']).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  history: z.array(z.object({
    version: z.number(),
    codeSnapshot: z.string(),
    promptSnapshot: z.string().optional(),
    agentLogs: z.object({
      layoutArchitect: z.object({
        success: z.boolean().optional(),
        latencyMs: z.number().optional(),
        tokensUsed: z.number().optional(),
        summary: z.string().optional()
      }).optional(),
      copywriter: z.object({
        success: z.boolean().optional(),
        latencyMs: z.number().optional(),
        tokensUsed: z.number().optional(),
        summary: z.string().optional()
      }).optional(),
      illustrator: z.object({
        success: z.boolean().optional(),
        imagesGenerated: z.array(z.string()).optional()
      }).optional()
    }).optional(),
    timestamp: z.coerce.date().optional()
  })).optional(),
  designAudit: z.object({
    score: z.number().min(0).max(100).optional(),
    lastAuditedAt: z.coerce.date().nullable().optional(),
    warnings: z.array(z.object({
      id: z.string().optional(),
      type: z.enum(['Accessibility', 'Performance', 'SEO', 'Tailwind Layout', 'Structure Error']),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      message: z.string(),
      location: z.object({
        line: z.number().nullable().optional(),
        column: z.number().nullable().optional(),
        elementTag: z.string().optional()
      }).optional()
    })).optional()
  }).optional(),
  settings: z.object({
    theme: z.enum(['dark', 'light']).optional(),
    framework: z.string().optional(),
    enableAiAutosave: z.boolean().optional()
  }).optional(),

  // Fields for dynamic field validation of create, generate, update, and rollback requests
  description: z.string().max(5000, 'Description cannot exceed 5000 characters').trim().optional(),
  prompt: z.string().trim().optional(),
  theme: z.enum(['dark', 'light']).optional(),
  framework: z.string().optional(),
  version: z.number().optional()
});

