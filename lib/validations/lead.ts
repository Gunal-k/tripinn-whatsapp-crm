import { z } from 'zod';
import { isValidInternationalPhone, normalizePhoneNumber } from '../utils/phone';

export const leadSourceSchema = z.enum([
  'WhatsApp',
  'Instagram',
  'Facebook',
  'website',
  'referral',
  'manual',
]);

export const leadStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'FOLLOW_UP',
  'PAYMENT_PENDING',
  'BOOKED',
  'COMPLETED',
  'LOST',
]);

export const createLeadSchema = z.object({
  name: z.string().min(2, 'Customer name must be at least 2 characters'),
  phone: z
    .string()
    .min(8, 'Phone number is too short')
    .refine((val) => isValidInternationalPhone(val), {
      message: 'Phone number must be a valid international number with country code (e.g. +91 9876543210)',
    })
    .transform((val) => normalizePhoneNumber(val)),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  lead_source: leadSourceSchema.default('WhatsApp'),
  interested_destination: z.string().optional().nullable(),
  travel_dates: z.string().optional().nullable(),
  number_of_travelers: z.coerce.number().int().positive().optional().nullable(),
  estimated_budget: z.coerce.number().positive().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
  assigned_salesperson_id: z.string().optional().nullable(),
  follow_up_date: z.string().optional().nullable(),
  follow_up_notes: z.string().optional().nullable(),
  // Meta attribution
  ctwa_clid: z.string().optional().nullable(),
  meta_campaign_id: z.string().optional().nullable(),
  meta_ad_id: z.string().optional().nullable(),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  lead_status: leadStatusSchema.optional(),
  qualification_status: z.enum(['UNQUALIFIED', 'PENDING', 'QUALIFIED', 'DISQUALIFIED']).optional(),
  meta_conversion_sent: z.boolean().optional(),
  meta_conversion_sent_at: z.string().optional().nullable(),
  meta_conversion_response: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const qualifyLeadCriteriaSchema = z.object({
  verifiedTravelDates: z.boolean().refine((val) => val === true, {
    message: 'Travel dates or travel window must be verified',
  }),
  verifiedBudget: z.boolean().refine((val) => val === true, {
    message: 'Estimated budget must match minimum package viability',
  }),
  verifiedTravelers: z.boolean().refine((val) => val === true, {
    message: 'Number of adult/child travelers must be confirmed',
  }),
  qualificationNotes: z.string().min(5, 'Please provide explicit qualification notes'),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type QualifyLeadCriteria = z.infer<typeof qualifyLeadCriteriaSchema>;
