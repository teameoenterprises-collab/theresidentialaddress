-- =====================================================================
--  THE RESIDENTIAL ADDRESS — CLIENT PORTAL
--  Supabase Schema — Safe to run multiple times
--
--  INSTRUCTIONS:
--  1. Go to Supabase Dashboard → SQL Editor → New Query
--  2. Paste this entire file and click Run
--  3. Sign up at the portal with admin@theresidentialaddress.com
--  4. Come back and run ONLY the last UPDATE statement to make it admin
-- =====================================================================


-- ============================================================
-- STEP 1: CREATE TABLES
-- ============================================================

-- Profiles: one row per user, linked to Supabase auth
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT        NOT NULL,
    email       TEXT,
    role        TEXT        NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
    country     TEXT,
    whatsapp    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add email column if upgrading from an older schema version
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Services: the 5 product types you offer
CREATE TABLE IF NOT EXISTS public.services (
    id    SERIAL PRIMARY KEY,
    slug  TEXT   UNIQUE NOT NULL,
    name  TEXT   NOT NULL,
    icon  TEXT   NOT NULL,
    color TEXT   NOT NULL
);

-- Client Services: which services a client has subscribed to
CREATE TABLE IF NOT EXISTS public.client_services (
    id          SERIAL      PRIMARY KEY,
    client_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    service_id  INT         NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    status      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'complete', 'inactive')),
    notes       TEXT,
    address     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (client_id, service_id)
);

-- Mail: scanned mail items uploaded by admin for a client
CREATE TABLE IF NOT EXISTS public.mail (
    id          BIGSERIAL   PRIMARY KEY,
    client_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender      TEXT        NOT NULL,
    subject     TEXT        NOT NULL,
    description TEXT,
    category    TEXT        NOT NULL DEFAULT 'other' CHECK (category IN ('usps', 'bank', 'irs', 'other')),
    file_path   TEXT,
    file_url    TEXT,
    is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
    uploaded_by UUID        REFERENCES public.profiles(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add description column if upgrading from older schema
ALTER TABLE public.mail ADD COLUMN IF NOT EXISTS description TEXT;

-- Documents: lease agreements, utility bills, LLC docs, etc.
CREATE TABLE IF NOT EXISTS public.documents (
    id          BIGSERIAL   PRIMARY KEY,
    client_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    doc_type    TEXT        NOT NULL DEFAULT 'other',
    file_url    TEXT,
    uploaded_by UUID        REFERENCES public.profiles(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- STEP 2: SEED SERVICE TYPES
-- ============================================================

INSERT INTO public.services (slug, name, icon, color) VALUES
    ('address', 'US Residential Address', '🏠', '#dbeafe'),
    ('llc',     'LLC Formation',          '🏢', '#d1fae5'),
    ('itin',    'ITIN Application',       '📋', '#fef3c7'),
    ('bank',    'Bank Assistance',        '🏦', '#ede9fe'),
    ('phone',   'US Phone (eSIM)',        '📱', '#fce7f3')
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents       ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 4: DROP OLD POLICIES (safe to re-run)
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"      ON public.profiles;

DROP POLICY IF EXISTS "cs_select_own"              ON public.client_services;
DROP POLICY IF EXISTS "cs_all_admin"               ON public.client_services;

DROP POLICY IF EXISTS "mail_select_own"            ON public.mail;
DROP POLICY IF EXISTS "mail_update_own"            ON public.mail;
DROP POLICY IF EXISTS "mail_all_admin"             ON public.mail;

DROP POLICY IF EXISTS "docs_select_own"            ON public.documents;
DROP POLICY IF EXISTS "docs_all_admin"             ON public.documents;


-- ============================================================
-- STEP 5: CREATE HELPER FUNCTION
-- Checks admin status without recursion (SECURITY DEFINER
-- bypasses RLS so it won't loop back into the profiles policy)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;


-- ============================================================
-- STEP 6: CREATE POLICIES
-- ============================================================

-- PROFILES --
-- A user can only read their own profile row
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- A user can insert their own profile row on signup
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- A user can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Admin can read all profiles (uses helper fn, no recursion)
CREATE POLICY "profiles_select_admin" ON public.profiles
    FOR SELECT USING (public.is_admin());

-- Admin can update all profiles
CREATE POLICY "profiles_update_admin" ON public.profiles
    FOR UPDATE USING (public.is_admin());


-- CLIENT SERVICES --
-- Client sees only their own subscribed services
CREATE POLICY "cs_select_own" ON public.client_services
    FOR SELECT USING (auth.uid() = client_id);

-- Admin has full access to all client services
CREATE POLICY "cs_all_admin" ON public.client_services
    FOR ALL USING (public.is_admin());


-- MAIL --
-- Client sees only their own mail
CREATE POLICY "mail_select_own" ON public.mail
    FOR SELECT USING (auth.uid() = client_id);

-- Client can mark their own mail as read
CREATE POLICY "mail_update_own" ON public.mail
    FOR UPDATE USING (auth.uid() = client_id);

-- Admin has full access to all mail
CREATE POLICY "mail_all_admin" ON public.mail
    FOR ALL USING (public.is_admin());


-- DOCUMENTS --
-- Client sees only their own documents
CREATE POLICY "docs_select_own" ON public.documents
    FOR SELECT USING (auth.uid() = client_id);

-- Admin has full access to all documents
CREATE POLICY "docs_all_admin" ON public.documents
    FOR ALL USING (public.is_admin());


-- ============================================================
-- STEP 7: CREATE STORAGE BUCKETS + POLICIES
-- ============================================================

-- Create the two storage buckets (safe to re-run)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'mail-scans',
    'mail-scans',
    true,
    20971520,
    ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
  ),
  (
    'documents',
    'documents',
    true,
    20971520,
    ARRAY['image/jpeg','image/png','image/webp','application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  )
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop old storage policies so re-runs don't error
DROP POLICY IF EXISTS "mail_scans_upload" ON storage.objects;
DROP POLICY IF EXISTS "mail_scans_read"   ON storage.objects;
DROP POLICY IF EXISTS "mail_scans_delete" ON storage.objects;
DROP POLICY IF EXISTS "documents_upload"  ON storage.objects;
DROP POLICY IF EXISTS "documents_read"    ON storage.objects;
DROP POLICY IF EXISTS "documents_delete"  ON storage.objects;

-- mail-scans: authenticated users can upload
CREATE POLICY "mail_scans_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'mail-scans');

-- mail-scans: everyone can read (public bucket)
CREATE POLICY "mail_scans_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'mail-scans');

-- mail-scans: authenticated users can delete their uploads
CREATE POLICY "mail_scans_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'mail-scans');

-- documents: authenticated users can upload
CREATE POLICY "documents_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documents');

-- documents: everyone can read (public bucket)
CREATE POLICY "documents_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'documents');

-- documents: authenticated users can delete their uploads
CREATE POLICY "documents_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'documents');


-- ============================================================
-- STEP 8: PROMOTE ADMIN ACCOUNT
--
-- Sign up at the portal first with admin@theresidentialaddress.com
-- then run this query to make it admin. Safe to run multiple times.
-- ============================================================

UPDATE public.profiles
SET role = 'admin'
WHERE id = (
    SELECT id FROM auth.users
    WHERE email = 'admin@theresidentialaddress.com'
);

