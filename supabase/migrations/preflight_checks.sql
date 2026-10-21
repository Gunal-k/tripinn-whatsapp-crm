-- ==============================================================================
-- TRIPINN HOLIDAYS CRM - PREFLIGHT DIAGNOSTIC QUERY
-- Run this in Supabase SQL Editor BEFORE applying the migration.
-- (READ-ONLY: Does not modify, alter, or delete any data)
-- ==============================================================================

-- 1. Check whatsapp_messages for NULL or duplicate wamid values
SELECT 
    '1. whatsapp_messages: null or empty wamid count' AS check_name,
    COUNT(*)::text AS issue_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE 'ACTION_NEEDED: Migration will safely assign deterministic legacy IDs without deleting messages' 
    END AS status
FROM public.whatsapp_messages
WHERE wamid IS NULL OR trim(wamid) = ''

UNION ALL

SELECT 
    '2. whatsapp_messages: duplicate wamid occurrences' AS check_name,
    COUNT(*)::text AS issue_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE 'ACTION_NEEDED: Migration will safely keep earliest message and suffix duplicates without deleting data' 
    END AS status
FROM (
    SELECT wamid, COUNT(*) 
    FROM public.whatsapp_messages 
    WHERE wamid IS NOT NULL 
    GROUP BY wamid 
    HAVING COUNT(*) > 1
) dups

UNION ALL

-- 2. Check webhook_events for duplicate event_id values
SELECT 
    '3. webhook_events: duplicate event_id occurrences' AS check_name,
    COUNT(*)::text AS issue_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE 'ACTION_NEEDED: Migration will safely suffix duplicate events for atomic unique constraint' 
    END AS status
FROM (
    SELECT event_id, COUNT(*) 
    FROM public.webhook_events 
    WHERE event_id IS NOT NULL 
    GROUP BY event_id 
    HAVING COUNT(*) > 1
) event_dups

UNION ALL

-- 3. Check profiles for non-standard roles
SELECT 
    '4. profiles: roles not equal to admin or sales' AS check_name,
    COUNT(*)::text AS issue_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE 'INFO: Migration will automatically normalize legacy salesperson roles to sales' 
    END AS status
FROM public.profiles
WHERE role::text NOT IN ('admin', 'sales')

UNION ALL

-- 4. Check for orphan profiles (profiles whose ID is not present in auth.users)
SELECT 
    '5. profiles: orphan rows not linked to auth.users' AS check_name,
    COUNT(*)::text AS issue_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS: Safe to attach profiles_id_fkey foreign key constraint' 
        ELSE 'MANUAL REVIEW: Orphan profiles exist without auth.users account; foreign key will be safely deferred' 
    END AS status
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)

UNION ALL

-- 5. Check leads with missing phone numbers
SELECT 
    '6. leads: rows with null or empty phone' AS check_name,
    COUNT(*)::text AS issue_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE 'WARNING: Leads without phone numbers cannot be matched with incoming WhatsApp messages' 
    END AS status
FROM public.leads
WHERE phone IS NULL OR trim(phone) = ''

UNION ALL

-- 6. Check for admin profiles
SELECT 
    '7. profiles: active admin count' AS check_name,
    COUNT(*)::text AS issue_count,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS: At least one active admin exists' 
        ELSE 'ACTION_NEEDED: No admin user found. Follow guide to create the first admin profile' 
    END AS status
FROM public.profiles
WHERE role = 'admin' AND is_active = true

UNION ALL

-- 7. Check profiles with missing full_name or email
SELECT 
    '8. profiles: missing full_name or email' AS check_name,
    COUNT(*)::text AS issue_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE 'INFO: Some profiles are missing full_name or email. They can update their info in the CRM' 
    END AS status
FROM public.profiles
WHERE full_name IS NULL OR trim(full_name) = '' OR email IS NULL OR trim(email) = ''

UNION ALL

-- 8. Existing policies audit
SELECT 
    '9. policies: existing policies to be replaced' AS check_name,
    COUNT(*)::text AS issue_count,
    'INFO: Migration will dynamically clean these legacy policies before applying new strict RBAC' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
      'profiles', 'leads', 'lead_activities', 'whatsapp_messages', 
      'webhook_events', 'meta_conversion_logs', 'integration_settings'
  );
