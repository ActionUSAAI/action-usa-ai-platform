-- ============================================================
-- AUCIS — Agent Intelligence System
-- Migration 002: 8 specialized agents + Client Concierge
-- ============================================================

-- ── Shared enum types ─────────────────────────────────────────────────────

CREATE TYPE agent_name_enum AS ENUM (
  'intake_analyzer',
  'document_processor',
  'letter_generator',
  'petition_builder',
  'rfe_analyzer',
  'salary_research',
  'case_monitor',
  'client_concierge'
);

CREATE TYPE agent_status_enum AS ENUM (
  'pending', 'running', 'completed', 'failed', 'retrying'
);

CREATE TYPE doc_type_enum AS ENUM (
  'recommendation_letter', 'award_certificate', 'press_article',
  'membership_proof', 'salary_record', 'tax_return', 'contract',
  'publication', 'patent', 'degree', 'license', 'other'
);

CREATE TYPE institutional_tier_enum AS ENUM ('tier_1', 'tier_2', 'tier_3', 'unknown');

CREATE TYPE letter_status_enum AS ENUM ('draft', 'in_review', 'approved', 'rejected', 'sent');

CREATE TYPE petition_status_enum AS ENUM ('draft', 'under_review', 'finalized', 'submitted');

CREATE TYPE build_phase_enum AS ENUM ('initial', 'rfe');

CREATE TYPE notification_channel_enum AS ENUM ('in_app', 'email', 'both');

CREATE TYPE notification_status_enum AS ENUM ('pending', 'sent', 'failed', 'read');

CREATE TYPE deadline_type_enum AS ENUM (
  'rfe_response', 'petition_filing', 'visa_expiry',
  'i94_expiry', 'extension_filing', 'premium_processing'
);

CREATE TYPE deadline_status_enum AS ENUM ('active', 'met', 'missed', 'extended');

CREATE TYPE rfe_response_status_enum AS ENUM ('pending', 'in_progress', 'completed');

-- ── Helper function (shared updated_at) ───────────────────────────────────
-- already exists from migration 001, skip if present
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- CORE: agent_runs + agent_logs
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  agent_name      agent_name_enum NOT NULL,
  status          agent_status_enum NOT NULL DEFAULT 'pending',
  triggered_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  input_snapshot  JSONB,
  output_summary  JSONB,
  error_detail    TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_case_id   ON public.agent_runs(case_id);
CREATE INDEX idx_agent_runs_status    ON public.agent_runs(status);
CREATE INDEX idx_agent_runs_agent     ON public.agent_runs(agent_name);

CREATE TABLE public.agent_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  level       TEXT NOT NULL DEFAULT 'info'
                CHECK (level IN ('debug','info','warning','error')),
  step        TEXT,
  message     TEXT NOT NULL,
  metadata    JSONB,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_logs_run_id ON public.agent_logs(run_id);

-- ══════════════════════════════════════════════════════════════════════════
-- AGENT 1: Intake Analyzer
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.agent_intake_analysis (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  case_id               UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  criteria_scores       JSONB NOT NULL DEFAULT '{}',
  recommended_visa_type TEXT CHECK (recommended_visa_type IN ('O-1A','O-1B','EB-1A','EB-1B')),
  confidence_score      NUMERIC(5,2) CHECK (confidence_score BETWEEN 0 AND 100),
  strengths             TEXT[],
  weaknesses            TEXT[],
  recommended_criteria  TEXT[],
  missing_evidence      TEXT[],
  executive_summary     TEXT,
  strategy_notes        TEXT,
  version               INTEGER NOT NULL DEFAULT 1,
  superseded_by         UUID REFERENCES public.agent_intake_analysis(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intake_analysis_case_id ON public.agent_intake_analysis(case_id);

-- ══════════════════════════════════════════════════════════════════════════
-- AGENT 2: Document Processor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.agent_processed_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  case_id           UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  storage_path      TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size_bytes   INTEGER,
  mime_type         TEXT,
  document_type     doc_type_enum NOT NULL,
  criterion_tag     TEXT,
  institutional_tier institutional_tier_enum,
  extracted_text    TEXT,
  key_entities      JSONB,
  language_detected TEXT DEFAULT 'en',
  translation_needed BOOLEAN DEFAULT FALSE,
  is_usable         BOOLEAN DEFAULT TRUE,
  validation_notes  TEXT,
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processed_docs_case_id ON public.agent_processed_documents(case_id);
CREATE INDEX idx_processed_docs_type    ON public.agent_processed_documents(document_type);

-- ══════════════════════════════════════════════════════════════════════════
-- AGENT 3: Letter Generator
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.agent_recommendation_letters (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  case_id             UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  recommender_name    TEXT NOT NULL,
  recommender_title   TEXT,
  recommender_org     TEXT,
  recommender_tier    institutional_tier_enum,
  relationship_type   TEXT CHECK (relationship_type IN (
                        'direct_supervisor','peer_expert',
                        'industry_leader','academic','client'
                      )),
  criterion_covered   TEXT NOT NULL,
  letter_draft        TEXT NOT NULL,
  letter_version      INTEGER NOT NULL DEFAULT 1,
  status              letter_status_enum NOT NULL DEFAULT 'draft',
  admin_notes         TEXT,
  approved_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  previous_version_id UUID REFERENCES public.agent_recommendation_letters(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_letters_case_id ON public.agent_recommendation_letters(case_id);
CREATE INDEX idx_letters_status  ON public.agent_recommendation_letters(status);

DROP TRIGGER IF EXISTS trg_letters_updated_at ON public.agent_recommendation_letters;
CREATE TRIGGER trg_letters_updated_at
  BEFORE UPDATE ON public.agent_recommendation_letters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- AGENT 4: Petition Builder
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.agent_petition_drafts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  case_id             UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  petition_type       TEXT NOT NULL CHECK (petition_type IN ('initial','rfe_response')),
  visa_type           TEXT NOT NULL CHECK (visa_type IN ('O-1A','O-1B','EB-1A','EB-1B')),
  cover_letter        TEXT,
  criteria_sections   JSONB NOT NULL DEFAULT '{}',
  evidence_checklist  JSONB NOT NULL DEFAULT '[]',
  criteria_covered    TEXT[],
  criteria_missing    TEXT[],
  completeness_pct    NUMERIC(5,2),
  status              petition_status_enum NOT NULL DEFAULT 'draft',
  build_phase         build_phase_enum NOT NULL DEFAULT 'initial',
  version             INTEGER NOT NULL DEFAULT 1,
  finalized_at        TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_petition_drafts_case_id ON public.agent_petition_drafts(case_id);

DROP TRIGGER IF EXISTS trg_petition_updated_at ON public.agent_petition_drafts;
CREATE TRIGGER trg_petition_updated_at
  BEFORE UPDATE ON public.agent_petition_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- AGENT 5: RFE Analyzer
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.agent_rfe_analyses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  case_id               UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  rfe_document_id       UUID REFERENCES public.agent_processed_documents(id),
  rfe_received_date     DATE,
  rfe_deadline          DATE,
  issues_identified     JSONB NOT NULL DEFAULT '[]',
  uscis_concerns        TEXT[],
  response_strategy     TEXT,
  additional_evidence   TEXT[],
  response_status       rfe_response_status_enum NOT NULL DEFAULT 'pending',
  response_draft_id     UUID REFERENCES public.agent_petition_drafts(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rfe_analyses_case_id ON public.agent_rfe_analyses(case_id);

-- ══════════════════════════════════════════════════════════════════════════
-- AGENT 6: Salary Research
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.agent_salary_analyses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  case_id               UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  occupation_code       TEXT,
  occupation_title      TEXT NOT NULL,
  field_of_expertise    TEXT,
  country_of_origin     TEXT NOT NULL,
  bls_mean_annual       NUMERIC(12,2),
  bls_90th_percentile   NUMERIC(12,2),
  bls_reference_year    INTEGER,
  bls_area              TEXT DEFAULT 'national',
  client_annual_salary  NUMERIC(12,2),
  salary_currency       TEXT DEFAULT 'USD',
  salary_evidence_type  TEXT CHECK (salary_evidence_type IN (
                          'w2','contract','offer_letter','tax_return','bank_statement'
                        )),
  origin_country_avg    NUMERIC(12,2),
  origin_currency       TEXT,
  exchange_rate_used    NUMERIC(10,4),
  origin_avg_usd        NUMERIC(12,2),
  origin_data_source    TEXT,
  origin_reference_year INTEGER,
  pct_above_bls_mean    NUMERIC(7,2),
  pct_above_origin      NUMERIC(7,2),
  qualifies_high_salary BOOLEAN,
  salary_narrative      TEXT,
  comparison_table_json JSONB,
  research_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_salary_analyses_case_id ON public.agent_salary_analyses(case_id);

-- ══════════════════════════════════════════════════════════════════════════
-- AGENT 7: Case Monitor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.agent_case_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  case_id         UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK (event_type IN (
                    'status_change','deadline_alert','document_request',
                    'uscis_notice','approval','denial','rfe_received',
                    'interview_scheduled','rfe_submitted','petition_filed'
                  )),
  event_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  description     TEXT NOT NULL,
  metadata        JSONB,
  requires_action BOOLEAN DEFAULT FALSE,
  action_due_date DATE,
  action_taken    TEXT,
  resolved_at     TIMESTAMPTZ,
  notified_admin  BOOLEAN DEFAULT FALSE,
  notified_client BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.agent_case_deadlines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  deadline_type   deadline_type_enum NOT NULL,
  deadline_date   DATE NOT NULL,
  alert_days      INTEGER[] DEFAULT '{30,14,7,1}',
  status          deadline_status_enum NOT NULL DEFAULT 'active',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_events_case_id    ON public.agent_case_events(case_id);
CREATE INDEX idx_case_events_type       ON public.agent_case_events(event_type);
CREATE INDEX idx_case_deadlines_date    ON public.agent_case_deadlines(deadline_date);
CREATE INDEX idx_case_deadlines_case_id ON public.agent_case_deadlines(case_id);

-- ══════════════════════════════════════════════════════════════════════════
-- AGENT 8: Client Concierge
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.agent_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  case_id         UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_role  TEXT NOT NULL CHECK (recipient_role IN ('client','admin','both')),
  channel         notification_channel_enum NOT NULL DEFAULT 'both',
  status          notification_status_enum NOT NULL DEFAULT 'pending',

  -- Content
  subject         TEXT NOT NULL,
  body_text       TEXT NOT NULL,
  body_html       TEXT,
  action_url      TEXT,
  action_label    TEXT,

  -- Source context
  trigger_event   TEXT,
  source_agent    agent_name_enum,
  priority        TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','urgent')),

  -- Delivery tracking
  sent_at         TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  resend_id       TEXT,
  error_detail    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON public.agent_notifications(recipient_id);
CREATE INDEX idx_notifications_case_id   ON public.agent_notifications(case_id);
CREATE INDEX idx_notifications_status    ON public.agent_notifications(status);
CREATE INDEX idx_notifications_read_at   ON public.agent_notifications(read_at)
  WHERE read_at IS NULL;

CREATE TABLE public.agent_concierge_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  case_id         UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES public.agent_notifications(id) ON DELETE SET NULL,

  message_type    TEXT NOT NULL CHECK (message_type IN (
                    'status_update','task_reminder','document_request',
                    'deadline_alert','welcome','completion','rfe_alert','custom'
                  )),
  audience        TEXT NOT NULL CHECK (audience IN ('client','admin','both')),

  -- AI-generated content
  generated_text  TEXT NOT NULL,
  tone            TEXT DEFAULT 'professional'
                    CHECK (tone IN ('professional','warm','urgent','celebratory')),
  language        TEXT DEFAULT 'en',

  -- Personalization context used
  context_snapshot JSONB,

  approved        BOOLEAN DEFAULT FALSE,
  approved_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_concierge_messages_case_id ON public.agent_concierge_messages(case_id);

-- ══════════════════════════════════════════════════════════════════════════
-- RLS — Row Level Security
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.agent_runs                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_intake_analysis          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_processed_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_recommendation_letters   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_petition_drafts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_rfe_analyses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_salary_analyses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_case_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_case_deadlines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_concierge_messages       ENABLE ROW LEVEL SECURITY;

-- Service role: full access on all agent tables
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'agent_runs','agent_logs','agent_intake_analysis',
    'agent_processed_documents','agent_recommendation_letters',
    'agent_petition_drafts','agent_rfe_analyses','agent_salary_analyses',
    'agent_case_events','agent_case_deadlines',
    'agent_notifications','agent_concierge_messages'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format(
      'CREATE POLICY "service_role_%s_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END$$;

-- Admin: full access via authenticated role
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'agent_runs','agent_logs','agent_intake_analysis',
    'agent_processed_documents','agent_recommendation_letters',
    'agent_petition_drafts','agent_rfe_analyses','agent_salary_analyses',
    'agent_case_events','agent_case_deadlines',
    'agent_notifications','agent_concierge_messages'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format(
      $pol$CREATE POLICY "admin_full_%s" ON public.%I FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))$pol$,
      tbl, tbl
    );
  END LOOP;
END$$;

-- Clients: SELECT only on their own case data
CREATE POLICY "client_view_own_runs"
  ON public.agent_runs FOR SELECT TO authenticated
  USING (case_id IN (
    SELECT c.id FROM public.cases c
    JOIN public.clients cl ON cl.id = c.client_id
    WHERE cl.profile_id = auth.uid()
  ));

CREATE POLICY "client_view_own_notifications"
  ON public.agent_notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "client_mark_notification_read"
  ON public.agent_notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "client_view_own_case_events"
  ON public.agent_case_events FOR SELECT TO authenticated
  USING (case_id IN (
    SELECT c.id FROM public.cases c
    JOIN public.clients cl ON cl.id = c.client_id
    WHERE cl.profile_id = auth.uid()
  ));

CREATE POLICY "client_view_own_deadlines"
  ON public.agent_case_deadlines FOR SELECT TO authenticated
  USING (case_id IN (
    SELECT c.id FROM public.cases c
    JOIN public.clients cl ON cl.id = c.client_id
    WHERE cl.profile_id = auth.uid()
  ));
