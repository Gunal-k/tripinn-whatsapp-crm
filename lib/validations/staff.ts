import { z } from 'zod';

export const createStaffSchema = z.object({
  full_name: z.string().min(2, 'Staff full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'sales']).default('sales'),
  phone: z.string().optional().nullable().or(z.literal('')),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
