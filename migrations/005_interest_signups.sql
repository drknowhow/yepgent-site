-- 005_interest_signups.sql
-- Captures form submissions from /interest/ — people asking about a Yep
-- of their own. Service-role Netlify Functions write; nothing else reads.
--
-- Run this once against the yepgent-site Supabase project, then verify in
-- Dashboard → Auth → Policies that RLS is ENABLED with no permissive
-- policy. Service-role bypasses RLS by design.

CREATE TABLE IF NOT EXISTS public.interest_signups (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT         NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  email             TEXT         NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320),
  email_lower       TEXT         NOT NULL,
  use_intent        TEXT         NOT NULL CHECK (use_intent IN ('personal', 'company', 'both')),
  company_name      TEXT         CHECK (company_name IS NULL OR char_length(company_name) <= 200),
  company_size      TEXT         CHECK (company_size IS NULL OR company_size IN ('solo', '2-10', '11-50', '51-200', '200+')),
  what_for          TEXT         NOT NULL CHECK (char_length(what_for) BETWEEN 1 AND 500),
  tech_comfort      TEXT         CHECK (tech_comfort IS NULL OR tech_comfort IN ('low', 'medium', 'high')),
  heard_from        TEXT         CHECK (heard_from IS NULL OR char_length(heard_from) <= 200),
  consent_contact   BOOLEAN      NOT NULL DEFAULT FALSE,
  status            TEXT         NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed', 'spam')),
  source            TEXT,
  metadata          JSONB        NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interest_signups_email_lower_idx
  ON public.interest_signups (email_lower);
CREATE INDEX IF NOT EXISTS interest_signups_created_at_idx
  ON public.interest_signups (created_at DESC);
CREATE INDEX IF NOT EXISTS interest_signups_use_intent_idx
  ON public.interest_signups (use_intent);

-- Lock the table down. Service-role (used by Netlify Functions) bypasses
-- RLS, so writes still work. Anon and authenticated users get nothing.
ALTER TABLE public.interest_signups ENABLE ROW LEVEL SECURITY;

-- Explicit deny for anon + authenticated: no policy = no access under RLS,
-- but adding a restrictive policy makes the intent obvious in the dashboard.
DROP POLICY IF EXISTS "no_public_read" ON public.interest_signups;
CREATE POLICY "no_public_read"
  ON public.interest_signups
  FOR SELECT
  TO anon, authenticated
  USING (FALSE);

-- updated_at maintenance trigger.
CREATE OR REPLACE FUNCTION public.touch_interest_signups_updated_at()
  RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS interest_signups_touch_updated_at ON public.interest_signups;
CREATE TRIGGER interest_signups_touch_updated_at
  BEFORE UPDATE ON public.interest_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_interest_signups_updated_at();
