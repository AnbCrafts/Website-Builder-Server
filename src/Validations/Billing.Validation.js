import { z } from 'zod';

export const billingValidationSchema = z.object({
  plan: z.enum(['basic', 'premium', 'agency'], {
    required_error: 'Plan selection is required',
    invalid_type_error: 'Plan must be one of basic, premium, or agency'
  })
});
