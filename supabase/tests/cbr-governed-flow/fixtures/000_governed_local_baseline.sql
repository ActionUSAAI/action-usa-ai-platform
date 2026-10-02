-- ============================================================
-- 000_governed_local_baseline.sql
-- ============================================================
-- PURPOSE: local bootstrap validation artifact only. Reconstructs the
-- exact pre-001 (T1) database baseline that migration 001 and 17 later
-- migrations (through and including 039/040) assume already exists, so
-- that the existing, unmodified migration chain 001-040 can be replayed
-- against a fresh local disposable Supabase database.
--
-- GOVERNING DESIGN: CBR040-LOCAL-BASELINE-DESIGN-A
--   ~/Downloads/CBR040-GOVERNED-LOCAL-BASELINE-BOOTSTRAP-EXACT-DESIGN-GATE.md
--   SHA-256 ec72f7652f81305e2a290e2c23e29e4383546339e0696d504e040365dd15b681
--
-- STATUS: NOT APPROVED FOR REMOTE DEPLOYMENT. This file's local-only vs.
-- canonical status is explicitly NOT ESTABLISHED (governing design Section
-- S). It must not be pushed, linked, or applied to AUSCIS-TEST or
-- Production without a separate, explicit owner decision.
--
-- Migrations 001-040 are intentionally preserved byte-for-byte and are
-- NOT modified, redefined, or duplicated by this file. This file supplies
-- ONLY the objects that the governing design's dependency-closure analysis
-- established as required before migration 001: 1 extension, 5 enum
-- types, and 4 foundational tables (profiles, clients, cases, documents).
-- It deliberately excludes every other schema.sql object (RLS, policies,
-- triggers, functions, indexes, storage, grants, and 5 further tables)
-- per the governing design's minimality rule -- none of those are
-- referenced by any migration in the 001-040 chain.
--
-- Source provenance: all object definitions below are taken from
-- supabase/schema.sql's current content, which git history establishes
-- was last modified 2026-06-26, two days before migration 001 was
-- introduced (2026-06-28) -- i.e. schema.sql's current text has not been
-- touched since before migration 001 existed, and is therefore used here
-- as the governing design's established T1 reconstruction. Columns later
-- added by migrations 022, 025, and 039 (initial_legal_petition,
-- active_legal_petition, storage_bucket, documents_id_case_id_key,
-- whatsapp, country_of_residence, current_city, foreign_street,
-- foreign_province, foreign_postal_code, foreign_country, middle_name,
-- country_of_birth, nationality) are deliberately NOT included here --
-- those migrations add them later in the chain.
-- ============================================================
--
-- BASELINE V2 AMENDMENT (non-semantic header note only; original V1 body
-- above is preserved byte-for-byte). Invocation #4 proved V1's closure
-- incomplete: migration 006 failed on a missing function,
-- is_admin_or_supervisor(), which itself calls get_user_role(). Both are
-- schema.sql-only helper functions (lines 334-343), required (directly or
-- transitively) by 10 migrations: 006, 009, 015, 016, 017, 024, 027, 029,
-- 034, 039.
--
-- GOVERNING RATIFICATION: CBR040-BASELINE-CLOSURE-RATIFY-A
--   ~/Downloads/CBR040-PRE001-FULL-DEPENDENCY-CLOSURE-COMPLETION-AND-RATIFICATION-GATE.md
--   SHA-256 15c21f1aa1f17dc859725301f4e97cb47abeb39dabde3a69f07cbf6ce7f1d404
--
-- The two functions below are added verbatim from supabase/schema.sql
-- (lines 334-343), unmodified: same signature, return type, language,
-- volatility, security characteristics, and qualification as the ratified
-- pre-001 definitions. No other semantic delta is introduced.
-- ============================================================

BEGIN;

-- ── Extensions ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enum types (idempotent guards; PostgreSQL has no native
--    CREATE TYPE IF NOT EXISTS) ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'supervisor', 'agent', 'client');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_status') THEN
    CREATE TYPE case_status AS ENUM (
      'nuevo', 'en_progreso', 'pendiente_documentos', 'en_revision',
      'aprobado', 'denegado', 'cerrado', 'archivado'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_type') THEN
    CREATE TYPE case_type AS ENUM (
      'asilo', 'visa_trabajo', 'residencia', 'ciudadania',
      'daca', 'deportacion', 'visa_familiar', 'otro'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
    CREATE TYPE document_status AS ENUM ('pendiente', 'recibido', 'verificado', 'rechazado');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority') THEN
    CREATE TYPE priority AS ENUM ('baja', 'normal', 'alta', 'urgente');
  END IF;
END$$;

-- ── Foundational tables (dependency order: profiles -> clients -> cases
--    -> documents) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'agent',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  country_of_origin TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  alien_number TEXT,
  ssn_last4 TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'es',
  notes TEXT,
  assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  case_type case_type NOT NULL,
  status case_status NOT NULL DEFAULT 'nuevo',
  priority priority NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL,
  description TEXT,
  uscis_receipt_number TEXT,
  court_date TIMESTAMPTZ,
  filing_date DATE,
  deadline DATE,
  fee_amount DECIMAL(10,2),
  fee_paid BOOLEAN NOT NULL DEFAULT false,
  fee_paid_date DATE,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- ── Case-number generation (pre-001 foundation; governed by
--    CBR040-LOCAL-BASELINE-CASE-NUMBER-A; verbatim from supabase/schema.sql) ──

-- Secuencia para números de caso
CREATE SEQUENCE IF NOT EXISTS case_number_seq START 1000;

-- Función para generar número de caso automático
CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
    NEW.case_number := 'AUA-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('case_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_case_number
  BEFORE INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION generate_case_number();

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  status document_status NOT NULL DEFAULT 'pendiente',
  rejection_reason TEXT,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Pre-001 helper functions (Baseline V2 amendment; provider before
--    consumer: get_user_role() before is_admin_or_supervisor()) ────────
-- Verbatim from supabase/schema.sql lines 334-343. CREATE OR REPLACE
-- FUNCTION is natively idempotent in PostgreSQL -- no DO $$ guard needed.

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('admin', 'supervisor');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMIT;
