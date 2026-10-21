-- ==============================================================================
-- TRIPINN HOLIDAYS CRM - REVISED NON-DESTRUCTIVE DATABASE RECONCILIATION MIGRATION
-- Migration: 20261021_upgrade_and_sync_schema.sql
-- Description:
--   - Reconciles existing Supabase tables (profiles, leads, lead_activities,
--     whatsapp_messages, webhook_events, integration_settings, meta_conversion_logs).
--   - Adds missing canonical and compatibility columns safely using ADD COLUMN IF NOT EXISTS.
--   - Standardizes roles to 'admin' and 'sales'.
--   - Links profiles.id to auth.users(id) safely (checks for orphans first).
--   - Provisions auth.users -> profiles trigger for new user creation.
--   - Safely cleans duplicate and null wamid/event_id values before adding UNIQUE constraints.
--   - Hardens SECURITY DEFINER helper functions (revoking PUBLIC execution).
--   - Dynamically drops any legacy/permissive policies on all 7 tables.
--   - Enforces strict role-aware RLS: prevents privilege escalation and unauthorized lead reassignment.
--   - Non-destructive: NO tables or customer data are dropped.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. ROLES & PROFILES TABLE (Linked to auth.users, standardized to 'admin' & 'sales')
-- ==============================================================================

-- Ensure 'user_role' enum contains 'admin' and 'sales' if an enum is used
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
        EXCEPTION WHEN duplicate_object THEN null;
        END;
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales';
        EXCEPTION WHEN duplicate_object THEN null;
        END;
    END IF;
END $$;

-- Upgrade public.profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'sales',
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'sales';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Normalize any legacy 'salesperson' role strings to 'sales'
UPDATE public.profiles SET role = 'sales' WHERE role::text = 'salesperson';

-- Ensure default role is 'sales'
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'sales';

-- Safely attach foreign key constraint from profiles.id to auth.users.id
-- If orphan profile rows exist (IDs not in auth.users), logs a notice instead of failing migration
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

    IF orphan_count > 0 THEN
        RAISE NOTICE 'Notice: % profile row(s) have IDs not found in auth.users. Foreign key constraint was skipped to prevent failure. Use preflight query to inspect.', orphan_count;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_type = 'FOREIGN KEY'
              AND table_schema = 'public'
              AND table_name = 'profiles'
              AND constraint_name = 'profiles_id_fkey'
        ) THEN
            BEGIN
                ALTER TABLE public.profiles
                ADD CONSTRAINT profiles_id_fkey
                FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not attach profiles_id_fkey: %', SQLERRM;
            END;
        END IF;
    END IF;
END $$;

-- Enforce role check constraint for 'admin' and 'sales'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_type = 'CHECK'
          AND table_schema = 'public'
          AND table_name = 'profiles'
          AND constraint_name = 'profiles_role_check'
    ) THEN
        BEGIN
            ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_role_check CHECK (role::text IN ('admin', 'sales'));
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not attach profiles_role_check: %', SQLERRM;
        END;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Automatic profile provision trigger on auth.users creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'sales'),
        true
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. LEADS TABLE (Upgrade & Align Schema)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'WhatsApp';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'WhatsApp';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS interested_destination TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS travel_dates TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS number_of_travelers INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC(12, 2);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS budget NUMERIC(12, 2);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'NEW';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'NEW';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'UNQUALIFIED';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS qualified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_salesperson_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS follow_up_completed BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ctwa_clid TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_campaign_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_ad_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_source_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_conversion_sent BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_conversion_sent_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_conversion_response JSONB;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Initial one-time sync of legacy and canonical values
DO $$
BEGIN
    UPDATE public.leads SET lead_source = source WHERE lead_source IS NULL AND source IS NOT NULL;
    UPDATE public.leads SET source = lead_source WHERE source IS NULL AND lead_source IS NOT NULL;
    UPDATE public.leads SET lead_status = status WHERE lead_status IS NULL AND status IS NOT NULL;
    UPDATE public.leads SET status = lead_status WHERE status IS NULL AND lead_status IS NOT NULL;
    UPDATE public.leads SET interested_destination = destination WHERE interested_destination IS NULL AND destination IS NOT NULL;
    UPDATE public.leads SET destination = interested_destination WHERE destination IS NULL AND interested_destination IS NOT NULL;
    UPDATE public.leads SET estimated_budget = budget WHERE estimated_budget IS NULL AND budget IS NOT NULL;
    UPDATE public.leads SET budget = estimated_budget WHERE budget IS NULL AND estimated_budget IS NOT NULL;
    UPDATE public.leads SET internal_notes = notes WHERE internal_notes IS NULL AND notes IS NOT NULL;
    UPDATE public.leads SET notes = internal_notes WHERE notes IS NULL AND internal_notes IS NOT NULL;
END $$;

-- Indexes for Leads
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_lead_status ON public.leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_qualification_status ON public.leads(qualification_status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_salesperson ON public.leads(assigned_salesperson_id);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON public.leads(follow_up_date) WHERE (follow_up_completed = false AND is_archived = false);
CREATE INDEX IF NOT EXISTS idx_leads_ctwa ON public.leads(ctwa_clid) WHERE ctwa_clid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- ==============================================================================
-- 4. WHATSAPP MESSAGES TABLE (Upgrade, Safe Deduplication & Uniqueness)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    direction TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS wamid TEXT;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS wa_message_id TEXT;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS from_phone TEXT;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS to_phone TEXT;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS message_body TEXT;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS error_details JSONB;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Initial one-time sync of message aliases
DO $$
BEGIN
    UPDATE public.whatsapp_messages SET wamid = wa_message_id WHERE wamid IS NULL AND wa_message_id IS NOT NULL;
    UPDATE public.whatsapp_messages SET wa_message_id = wamid WHERE wa_message_id IS NULL AND wamid IS NOT NULL;
    UPDATE public.whatsapp_messages SET message_body = body WHERE message_body IS NULL AND body IS NOT NULL;
    UPDATE public.whatsapp_messages SET body = message_body WHERE body IS NULL AND message_body IS NOT NULL;
END $$;

-- Handle existing NULL wamid values safely (never delete messages)
UPDATE public.whatsapp_messages
SET wamid = 'legacy_' || id::text
WHERE wamid IS NULL OR trim(wamid) = '';

-- Handle duplicate wamid values safely: keep earliest, suffix duplicates (never delete messages)
WITH duplicates AS (
    SELECT id, wamid,
           ROW_NUMBER() OVER (PARTITION BY wamid ORDER BY created_at ASC, id ASC) as rn
    FROM public.whatsapp_messages
    WHERE wamid IS NOT NULL
)
UPDATE public.whatsapp_messages m
SET wamid = m.wamid || '_dup_' || substr(m.id::text, 1, 8)
FROM duplicates d
WHERE m.id = d.id AND d.rn > 1;

-- Drop partial index if it was previously created
DROP INDEX IF EXISTS public.idx_whatsapp_messages_wamid_unique;

-- Enforce standard unique constraint on wamid for atomic upsert support
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_wamid_key'
    ) THEN
        ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_wamid_key UNIQUE (wamid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead_id ON public.whatsapp_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);

-- ==============================================================================
-- 5. LEAD ACTIVITIES TABLE (Audit Trail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS activity_type TEXT;
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created ON public.lead_activities(created_at DESC);

-- ==============================================================================
-- 6. WEBHOOK EVENTS TABLE (Idempotency & Audit)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    source TEXT DEFAULT 'whatsapp',
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'processed',
    error_message TEXT,
    processed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'whatsapp';
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processed';
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Handle any duplicate event_id safely before adding unique constraint
WITH event_dups AS (
    SELECT id, event_id,
           ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at ASC, id ASC) as rn
    FROM public.webhook_events
    WHERE event_id IS NOT NULL
)
UPDATE public.webhook_events w
SET event_id = w.event_id || '_dup_' || substr(w.id::text, 1, 8)
FROM event_dups d
WHERE w.id = d.id AND d.rn > 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'webhook_events_event_id_key'
    ) THEN
        ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_event_id_key UNIQUE (event_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webhook_events_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON public.webhook_events(created_at DESC);

-- ==============================================================================
-- 7. INTEGRATION SETTINGS TABLE (Application Configuration)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.integration_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.integration_settings ADD COLUMN IF NOT EXISTS value JSONB;
ALTER TABLE public.integration_settings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.integration_settings ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.integration_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.integration_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'integration_settings_key_key'
    ) THEN
        ALTER TABLE public.integration_settings ADD CONSTRAINT integration_settings_key_key UNIQUE (key);
    END IF;
END $$;

-- ==============================================================================
-- 8. META CONVERSION LOGS (CAPI Idempotency & Audit)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.meta_conversion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    ctwa_clid TEXT,
    event_time BIGINT NOT NULL,
    status TEXT NOT NULL,
    response_code INTEGER,
    response_body JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.meta_conversion_logs ADD COLUMN IF NOT EXISTS event_name TEXT;
ALTER TABLE public.meta_conversion_logs ADD COLUMN IF NOT EXISTS ctwa_clid TEXT;
ALTER TABLE public.meta_conversion_logs ADD COLUMN IF NOT EXISTS event_time BIGINT;
ALTER TABLE public.meta_conversion_logs ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.meta_conversion_logs ADD COLUMN IF NOT EXISTS response_code INTEGER;
ALTER TABLE public.meta_conversion_logs ADD COLUMN IF NOT EXISTS response_body JSONB;
ALTER TABLE public.meta_conversion_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.meta_conversion_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

CREATE INDEX IF NOT EXISTS idx_meta_conv_lead ON public.meta_conversion_logs(lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_conv_idempotent ON public.meta_conversion_logs(lead_id, event_name) WHERE status = 'success';

-- ==============================================================================
-- 9. TRIGGERS: AUTOMATIC UPDATED_AT & BIDIRECTIONAL COLUMN SYNCHRONIZATION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_leads_updated_at ON public.leads;
CREATE TRIGGER set_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_whatsapp_messages_updated_at ON public.whatsapp_messages;
CREATE TRIGGER set_whatsapp_messages_updated_at
BEFORE UPDATE ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_integration_settings_updated_at ON public.integration_settings;
CREATE TRIGGER set_integration_settings_updated_at
BEFORE UPDATE ON public.integration_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Bidirectional sync triggers for column aliases:
CREATE OR REPLACE FUNCTION public.sync_lead_column_aliases()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lead_source IS NOT NULL THEN
        NEW.source = NEW.lead_source;
    ELSIF NEW.source IS NOT NULL THEN
        NEW.lead_source = NEW.source;
    END IF;

    IF NEW.lead_status IS NOT NULL THEN
        NEW.status = NEW.lead_status;
    ELSIF NEW.status IS NOT NULL THEN
        NEW.lead_status = NEW.status;
    END IF;

    IF NEW.interested_destination IS NOT NULL THEN
        NEW.destination = NEW.interested_destination;
    ELSIF NEW.destination IS NOT NULL THEN
        NEW.interested_destination = NEW.destination;
    END IF;

    IF NEW.estimated_budget IS NOT NULL THEN
        NEW.budget = NEW.estimated_budget;
    ELSIF NEW.budget IS NOT NULL THEN
        NEW.estimated_budget = NEW.budget;
    END IF;

    IF NEW.internal_notes IS NOT NULL THEN
        NEW.notes = NEW.internal_notes;
    ELSIF NEW.notes IS NOT NULL THEN
        NEW.internal_notes = NEW.notes;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_leads_columns ON public.leads;
CREATE TRIGGER sync_leads_columns
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_column_aliases();

CREATE OR REPLACE FUNCTION public.sync_message_column_aliases()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.wamid IS NOT NULL THEN
        NEW.wa_message_id = NEW.wamid;
    ELSIF NEW.wa_message_id IS NOT NULL THEN
        NEW.wamid = NEW.wa_message_id;
    END IF;

    IF NEW.message_body IS NOT NULL THEN
        NEW.body = NEW.message_body;
    ELSIF NEW.body IS NOT NULL THEN
        NEW.message_body = NEW.body;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_whatsapp_messages_columns ON public.whatsapp_messages;
CREATE TRIGGER sync_whatsapp_messages_columns
BEFORE INSERT OR UPDATE ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.sync_message_column_aliases();

-- ==============================================================================
-- 10. SECURITY DEFINER HELPER FUNCTIONS FOR ROLE-BASED ACCESS CONTROL (RBAC)
-- ==============================================================================

-- Check if current authenticated user has active 'admin' role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
          AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Check if current authenticated user has active staff membership ('admin' or 'sales')
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND is_active = true
          AND role IN ('admin', 'sales')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Restrict function execution: revoke from PUBLIC, grant only to authenticated and service_role
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_active_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- DEFENSE-IN-DEPTH TRIGGERS FOR SECURITY AND INTEGRITY
-- ------------------------------------------------------------------------------

-- 1. Prevent privilege escalation: Non-admins cannot alter role or is_active
CREATE OR REPLACE FUNCTION public.protect_profile_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin() THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Unauthorized: Only administrators can modify user roles';
        END IF;
        IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
            RAISE EXCEPTION 'Unauthorized: Only administrators can modify active status';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privilege_escalation();

-- 2. Prevent lead reassignment: Non-admins cannot reassign leads or assign to others
CREATE OR REPLACE FUNCTION public.protect_lead_reassignment()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT: If sales staff creates a lead without assigning it, auto-assign to themselves
    IF TG_OP = 'INSERT' THEN
        IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
            IF NEW.assigned_salesperson_id IS NULL THEN
                NEW.assigned_salesperson_id = auth.uid();
            ELSIF NEW.assigned_salesperson_id <> auth.uid() THEN
                RAISE EXCEPTION 'Unauthorized: Sales staff cannot assign leads to other staff members';
            END IF;
        END IF;
    -- On UPDATE: Non-admins cannot reassign leads to other staff members
    ELSIF TG_OP = 'UPDATE' THEN
        IF NOT public.is_admin() THEN
            IF NEW.assigned_salesperson_id IS DISTINCT FROM OLD.assigned_salesperson_id THEN
                RAISE EXCEPTION 'Unauthorized: Only administrators can reassign leads to other staff members';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS protect_lead_reassignment_trigger ON public.leads;
CREATE TRIGGER protect_lead_reassignment_trigger
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.protect_lead_reassignment();

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Ensure RLS is enabled on all 7 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_conversion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Dynamically drop ALL pre-existing policies on the 7 tables to ensure
-- no lingering, overly permissive, or conflicting legacy policies remain active
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'profiles',
              'leads',
              'lead_activities',
              'whatsapp_messages',
              'webhook_events',
              'meta_conversion_logs',
              'integration_settings'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- A. PROFILES POLICIES
-- ------------------------------------------------------------------------------
-- Active staff can view active profiles (e.g. for telecaller assignment dropdowns)
CREATE POLICY "Staff can view active profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_active_staff());

-- Users can update their own personal details (full_name, phone, avatar_url),
-- BUT CANNOT change their role or active status (prevents privilege escalation)
CREATE POLICY "Users can update own personal info"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id AND public.is_active_staff())
WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
);

-- Only admins can create profiles, change roles, or toggle active status
CREATE POLICY "Admins full management of profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- B. LEADS POLICIES
-- ------------------------------------------------------------------------------
-- Admins can view all leads; sales staff can only view leads assigned to them
CREATE POLICY "Staff can view assigned leads"
ON public.leads FOR SELECT
TO authenticated
USING (
    public.is_admin() OR
    (public.is_active_staff() AND assigned_salesperson_id = auth.uid())
);

-- Active staff (admin or sales) can insert new leads (manual intake)
CREATE POLICY "Staff can insert leads"
ON public.leads FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin() OR
    (public.is_active_staff() AND (assigned_salesperson_id IS NULL OR assigned_salesperson_id = auth.uid()))
);

-- Admins can update any lead (including reassigning).
-- Sales staff can ONLY update leads assigned to them, and CANNOT reassign the lead
-- to another salesperson (enforced via WITH CHECK assigned_salesperson_id = auth.uid())
CREATE POLICY "Staff can update assigned leads"
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

-- Only admins can delete/purge leads
CREATE POLICY "Only admins can delete leads"
ON public.leads FOR DELETE
TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- C. LEAD ACTIVITIES POLICIES
-- ------------------------------------------------------------------------------
-- Staff can view activities for leads assigned to them (or admins view all)
CREATE POLICY "Staff can view lead activities"
ON public.lead_activities FOR SELECT
TO authenticated
USING (
    public.is_admin() OR
    EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_activities.lead_id
          AND l.assigned_salesperson_id = auth.uid()
    )
);

-- Staff can record activities on leads
CREATE POLICY "Staff can insert lead activities"
ON public.lead_activities FOR INSERT
TO authenticated
WITH CHECK (public.is_active_staff());

-- ------------------------------------------------------------------------------
-- D. WHATSAPP MESSAGES POLICIES
-- ------------------------------------------------------------------------------
-- Staff can view messages for leads assigned to them (or admins view all)
CREATE POLICY "Staff can view whatsapp messages"
ON public.whatsapp_messages FOR SELECT
TO authenticated
USING (
    public.is_admin() OR
    EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = whatsapp_messages.lead_id
          AND l.assigned_salesperson_id = auth.uid()
    )
);

-- Staff can record outbound messages dispatched from CRM
CREATE POLICY "Staff can insert outbound whatsapp messages"
ON public.whatsapp_messages FOR INSERT
TO authenticated
WITH CHECK (public.is_active_staff() AND direction = 'outbound');

-- Staff can update message status (e.g. delivered/read)
CREATE POLICY "Staff can update message status"
ON public.whatsapp_messages FOR UPDATE
TO authenticated
USING (public.is_active_staff())
WITH CHECK (public.is_active_staff());

-- ------------------------------------------------------------------------------
-- E. INTEGRATION SETTINGS POLICIES
-- ------------------------------------------------------------------------------
-- Active staff can read settings
CREATE POLICY "Staff can view integration settings"
ON public.integration_settings FOR SELECT
TO authenticated
USING (public.is_active_staff());

-- Only admins can insert, update, or delete settings
CREATE POLICY "Admins can manage integration settings"
ON public.integration_settings FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- F. WEBHOOK EVENTS & META LOGS (Audit Trails)
-- ------------------------------------------------------------------------------
-- Only admins can view raw webhook audit logs
CREATE POLICY "Admins can view webhook audit logs"
ON public.webhook_events FOR SELECT
TO authenticated
USING (public.is_admin());

-- Only admins can view Meta conversion logs
CREATE POLICY "Admins can view meta conversion logs"
ON public.meta_conversion_logs FOR SELECT
TO authenticated
USING (public.is_admin());
