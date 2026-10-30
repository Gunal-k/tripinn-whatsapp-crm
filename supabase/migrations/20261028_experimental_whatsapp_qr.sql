-- ==============================================================================
-- TRIPINN HOLIDAYS CRM - EXPERIMENTAL WHATSAPP QR CONNECTION MIGRATION
-- Migration: 20261028_experimental_whatsapp_qr.sql
-- Description:
--   - Creates isolated tables for experimental QR-based WhatsApp connection (Baileys).
--   - Completely independent from official Cloud API tables (public.whatsapp_messages).
--   - Non-destructive: Does NOT alter or delete any existing CRM or WhatsApp data.
-- ==============================================================================

-- 1. Experimental Connection Sessions Table
-- Stores pairing and connection state metadata (NEVER stores authentication credentials or keys)
CREATE TABLE IF NOT EXISTS public.experimental_whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL, -- e.g. 'default_test_session'
    phone_number TEXT,               -- Normalized phone of connected test WhatsApp device
    status TEXT NOT NULL DEFAULT 'disconnected', -- 'disconnected', 'connecting', 'qr_ready', 'connected', 'failed'
    paired_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- Device details (OS, browser, battery) - NO secrets
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for session lookups
CREATE INDEX IF NOT EXISTS idx_exp_wa_sessions_status ON public.experimental_whatsapp_sessions(status);
CREATE INDEX IF NOT EXISTS idx_exp_wa_sessions_created ON public.experimental_whatsapp_sessions(created_at DESC);

-- 2. Experimental WhatsApp Messages Table
-- Stores incoming & outgoing messages sent via the experimental Baileys QR transport
CREATE TABLE IF NOT EXISTS public.experimental_whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES public.experimental_whatsapp_sessions(session_id) ON DELETE CASCADE,
    provider_message_id TEXT UNIQUE NOT NULL, -- Baileys message ID for strict idempotency
    direction message_direction NOT NULL,      -- 'inbound' | 'outbound'
    from_phone TEXT NOT NULL,
    to_phone TEXT NOT NULL,
    message_body TEXT,
    message_type TEXT NOT NULL DEFAULT 'text',
    status message_status NOT NULL DEFAULT 'received',
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL, -- Matched safely by normalized phone
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for experimental messages
CREATE INDEX IF NOT EXISTS idx_exp_wa_messages_session ON public.experimental_whatsapp_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_exp_wa_messages_lead ON public.experimental_whatsapp_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_exp_wa_messages_from_phone ON public.experimental_whatsapp_messages(from_phone);
CREATE INDEX IF NOT EXISTS idx_exp_wa_messages_created ON public.experimental_whatsapp_messages(created_at DESC);

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE public.experimental_whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experimental_whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Dynamic Policy Cleanup (Idempotent execution)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Admins full access to experimental sessions" ON public.experimental_whatsapp_sessions;
    DROP POLICY IF EXISTS "Staff read experimental sessions" ON public.experimental_whatsapp_sessions;
    DROP POLICY IF EXISTS "Admins full access to experimental messages" ON public.experimental_whatsapp_messages;
    DROP POLICY IF EXISTS "Staff read experimental messages" ON public.experimental_whatsapp_messages;
END $$;

-- Policies for experimental_whatsapp_sessions
CREATE POLICY "Admins full access to experimental sessions"
    ON public.experimental_whatsapp_sessions FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

CREATE POLICY "Staff read experimental sessions"
    ON public.experimental_whatsapp_sessions FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_active = true
        )
    );

-- Policies for experimental_whatsapp_messages
CREATE POLICY "Admins full access to experimental messages"
    ON public.experimental_whatsapp_messages FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin' AND is_active = true
        )
    );

CREATE POLICY "Staff read experimental messages"
    ON public.experimental_whatsapp_messages FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_active = true
        )
    );

