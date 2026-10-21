-- ==============================================================================
-- TRIPINN HOLIDAYS CRM - INITIAL DATABASE SCHEMA & RLS MIGRATION
-- Migration: 20261021_initial_schema.sql
-- Description: Creates profiles, leads, activities, whatsapp messages, webhook events,
--              integration settings, indexes, triggers, and comprehensive RLS policies.
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ENUMS
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'salesperson');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_source AS ENUM ('WhatsApp', 'Instagram', 'Facebook', 'website', 'referral', 'manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM (
        'NEW',
        'CONTACTED',
        'QUALIFIED',
        'FOLLOW_UP',
        'PAYMENT_PENDING',
        'BOOKED',
        'COMPLETED',
        'LOST'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE qualification_status AS ENUM ('UNQUALIFIED', 'PENDING', 'QUALIFIED', 'DISQUALIFIED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed', 'received');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 2. PROFILES TABLE (Linked to auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'salesperson',
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. LEADS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL, -- Normalized E.164 without '+' or leading zeros (e.g. 919876543210)
    email TEXT,
    lead_source lead_source NOT NULL DEFAULT 'WhatsApp',
    interested_destination TEXT,
    travel_dates TEXT,
    number_of_travelers INTEGER CHECK (number_of_travelers IS NULL OR number_of_travelers > 0),
    estimated_budget NUMERIC(12, 2) CHECK (estimated_budget IS NULL OR estimated_budget >= 0),
    lead_status lead_status NOT NULL DEFAULT 'NEW',
    qualification_status qualification_status NOT NULL DEFAULT 'UNQUALIFIED',
    qualified_at TIMESTAMPTZ,
    qualified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_salesperson_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    last_contact_date TIMESTAMPTZ,
    follow_up_date TIMESTAMPTZ,
    follow_up_notes TEXT,
    follow_up_completed BOOLEAN NOT NULL DEFAULT false,
    internal_notes TEXT,
    -- Meta Click-to-WhatsApp (CTWA) Attribution fields
    ctwa_clid TEXT,
    meta_campaign_id TEXT,
    meta_ad_id TEXT,
    meta_source_id TEXT,
    meta_conversion_sent BOOLEAN NOT NULL DEFAULT false,
    meta_conversion_sent_at TIMESTAMPTZ,
    meta_conversion_response JSONB,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for Leads
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_qualification ON public.leads(qualification_status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.leads(assigned_salesperson_id);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON public.leads(follow_up_date) WHERE (follow_up_completed = false AND is_archived = false);
CREATE INDEX IF NOT EXISTS idx_leads_ctwa_clid ON public.leads(ctwa_clid) WHERE ctwa_clid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- ==============================================================================
-- 4. LEAD ACTIVITIES TABLE (Audit timeline)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'status_change', 'qualification', 'note_added', 'whatsapp_inbound', 'whatsapp_outbound', 'follow_up_scheduled', 'follow_up_completed', 'meta_conversion'
    title TEXT NOT NULL,
    description TEXT,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created ON public.lead_activities(created_at DESC);

-- ==============================================================================
-- 5. WHATSAPP MESSAGES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    wamid TEXT UNIQUE NOT NULL, -- Meta's WhatsApp Message ID (e.g. wamid.HBgL...)
    direction message_direction NOT NULL,
    from_phone TEXT NOT NULL,
    to_phone TEXT NOT NULL,
    message_body TEXT,
    message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image', 'document', 'audio', 'location', 'template', 'button_reply'
    status message_status NOT NULL DEFAULT 'pending',
    error_details JSONB,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead_id ON public.whatsapp_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wamid ON public.whatsapp_messages(wamid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);

-- ==============================================================================
-- 6. WEBHOOK EVENTS TABLE (Idempotency and Audit)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL, -- WhatsApp message id or status id used for deduplication
    source TEXT NOT NULL DEFAULT 'whatsapp',
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'processed', -- 'processed', 'failed', 'duplicate_ignored'
    error_message TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON public.webhook_events(created_at DESC);

-- ==============================================================================
-- 7. INTEGRATION SETTINGS TABLE (Non-secret application settings)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.integration_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 8. META CONVERSIONS IDEMPOTENCY LOG
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.meta_conversion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL, -- e.g. 'Lead' or 'Purchase'
    ctwa_clid TEXT,
    event_time BIGINT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'failed', 'dry_run'
    response_code INTEGER,
    response_body JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_meta_conversion_logs_lead ON public.meta_conversion_logs(lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_conversion_idempotency ON public.meta_conversion_logs(lead_id, event_name) WHERE status = 'success';

-- ==============================================================================
-- 9. AUTOMATIC TIMESTAMP UPDATE TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_leads_updated_at ON public.leads;
CREATE TRIGGER set_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_whatsapp_messages_updated_at ON public.whatsapp_messages;
CREATE TRIGGER set_whatsapp_messages_updated_at
BEFORE UPDATE ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_integration_settings_updated_at ON public.integration_settings;
CREATE TRIGGER set_integration_settings_updated_at
BEFORE UPDATE ON public.integration_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_conversion_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if the current user is active staff
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- A. PROFILES POLICIES
-- Any authenticated user can read active profiles (needed to see salesperson names)
CREATE POLICY "Allow authenticated staff to read profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_active_staff());

-- Users can update their own profile name/phone
CREATE POLICY "Allow users to update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can manage all profiles
CREATE POLICY "Admins full management of profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin());

-- B. LEADS POLICIES
-- Active staff can view leads
CREATE POLICY "Staff can view leads"
ON public.leads FOR SELECT
TO authenticated
USING (
    public.is_admin() OR 
    (public.is_active_staff() AND (assigned_salesperson_id = auth.uid() OR assigned_salesperson_id IS NULL))
);

-- Active staff can insert leads
CREATE POLICY "Staff can insert leads"
ON public.leads FOR INSERT
TO authenticated
WITH CHECK (public.is_active_staff());

-- Staff can update their assigned leads or admins can update any lead
CREATE POLICY "Staff can update leads"
ON public.leads FOR UPDATE
TO authenticated
USING (
    public.is_admin() OR 
    (public.is_active_staff() AND assigned_salesperson_id = auth.uid())
)
WITH CHECK (
    public.is_admin() OR 
    (public.is_active_staff() AND assigned_salesperson_id = auth.uid())
);

-- Only admins can delete/archive leads permanently
CREATE POLICY "Only admins can delete leads"
ON public.leads FOR DELETE
TO authenticated
USING (public.is_admin());

-- C. LEAD ACTIVITIES POLICIES
CREATE POLICY "Staff can read activities"
ON public.lead_activities FOR SELECT
TO authenticated
USING (public.is_active_staff());

CREATE POLICY "Staff can insert activities"
ON public.lead_activities FOR INSERT
TO authenticated
WITH CHECK (public.is_active_staff());

-- D. WHATSAPP MESSAGES POLICIES
CREATE POLICY "Staff can read messages"
ON public.whatsapp_messages FOR SELECT
TO authenticated
USING (public.is_active_staff());

CREATE POLICY "Staff can insert outbound messages"
ON public.whatsapp_messages FOR INSERT
TO authenticated
WITH CHECK (public.is_active_staff());

CREATE POLICY "Staff can update message status"
ON public.whatsapp_messages FOR UPDATE
TO authenticated
USING (public.is_active_staff());

-- E. INTEGRATION SETTINGS POLICIES
CREATE POLICY "Staff can read non-secret settings"
ON public.integration_settings FOR SELECT
TO authenticated
USING (public.is_active_staff());

CREATE POLICY "Only admins can modify settings"
ON public.integration_settings FOR ALL
TO authenticated
USING (public.is_admin());

-- F. WEBHOOK EVENTS & META LOGS
-- Only admins can inspect webhook audits & conversion logs in dashboard
CREATE POLICY "Admins can view webhook logs"
ON public.webhook_events FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can view meta conversion logs"
ON public.meta_conversion_logs FOR SELECT
TO authenticated
USING (public.is_admin());
