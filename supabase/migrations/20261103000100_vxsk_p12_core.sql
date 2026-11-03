-- VXSK P12 Core Migration
-- DRAFT FOR REVIEW ONLY — DO NOT APPLY TO SUPABASE YET.
-- Date: 2026-11-03
--
-- This adds an isolated P12 tournament schema. It does not alter legacy
-- vxsk_hub_* tables, policies, RPCs, or triggers.
-- Authorization reuses the audited public.vxsk_hub_owner() and
-- public.vxsk_hub_referee() helpers (both require AAL2).
-- All P12 tables deny direct anon/authenticated table access; data is
-- exposed through narrowly scoped SECURITY DEFINER RPCs only.
--
-- Apply only after reviewing this entire file and approving it for staging.
-- This repository does not yet have Supabase CLI migration-history metadata.
-- A manual SQL Editor application therefore needs a separate deployment log.

BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.vxsk_hub_owner()') IS NULL THEN
    RAISE EXCEPTION 'Required helper public.vxsk_hub_owner() is missing';
  END IF;
  IF to_regprocedure('public.vxsk_hub_referee()') IS NULL THEN
    RAISE EXCEPTION 'Required helper public.vxsk_hub_referee() is missing';
  END IF;
  IF to_regclass('public.vxsk_p12_tournaments') IS NOT NULL
     OR to_regclass('public.vxsk_p12_teams') IS NOT NULL
     OR to_regclass('public.vxsk_p12_stages') IS NOT NULL
     OR to_regclass('public.vxsk_p12_matches') IS NOT NULL
     OR to_regclass('public.vxsk_p12_updates') IS NOT NULL
     OR to_regclass('public.vxsk_p12_reports') IS NOT NULL
     OR to_regclass('public.vxsk_p12_audit') IS NOT NULL THEN
    RAISE EXCEPTION 'One or more P12 tables already exist; stop and reconcile before applying';
  END IF;
END
$preflight$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.vxsk_p12_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 100),
  game text NOT NULL CHECK (game IN ('Rocket League', 'VALORANT', 'League of Legends')),
  mode text NOT NULL CHECK (char_length(btrim(mode)) BETWEEN 1 AND 50),
  starts_at timestamptz,
  status text NOT NULL DEFAULT 'announced'
    CHECK (status IN ('announced', 'upcoming', 'live', 'completed', 'cancelled')),
  published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vxsk_p12_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL
    REFERENCES public.vxsk_p12_tournaments(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vxsk_p12_teams_id_tournament_key UNIQUE (id, tournament_id)
);

CREATE UNIQUE INDEX vxsk_p12_teams_name_per_tournament
  ON public.vxsk_p12_teams (tournament_id, lower(btrim(name)));

CREATE TABLE public.vxsk_p12_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL
    REFERENCES public.vxsk_p12_tournaments(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 70),
  format text NOT NULL CHECK (format IN ('single', 'double', 'groups', 'swiss')),
  stage_order integer NOT NULL CHECK (stage_order BETWEEN 1 AND 20),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vxsk_p12_stages_order_unique UNIQUE (tournament_id, stage_order),
  CONSTRAINT vxsk_p12_stages_id_tournament_key UNIQUE (id, tournament_id)
);

CREATE TABLE public.vxsk_p12_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  team_a uuid NOT NULL,
  team_b uuid NOT NULL,
  round_no integer NOT NULL CHECK (round_no BETWEEN 1 AND 60),
  slot integer NOT NULL CHECK (slot BETWEEN 1 AND 256),
  bracket text NOT NULL CHECK (bracket IN ('main', 'winners', 'losers', 'grand_final')),
  group_name text NOT NULL DEFAULT '' CHECK (char_length(group_name) <= 35),
  starts_at timestamptz,
  state text NOT NULL DEFAULT 'scheduled'
    CHECK (state IN ('scheduled', 'live', 'completed', 'cancelled')),
  score_a integer,
  score_b integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vxsk_p12_matches_distinct_teams CHECK (team_a <> team_b),
  CONSTRAINT vxsk_p12_matches_score_pair CHECK (
    (score_a IS NULL AND score_b IS NULL)
    OR (score_a IS NOT NULL AND score_b IS NOT NULL)
  ),
  CONSTRAINT vxsk_p12_matches_score_bounds CHECK (
    (score_a IS NULL OR score_a BETWEEN 0 AND 99)
    AND (score_b IS NULL OR score_b BETWEEN 0 AND 99)
  ),
  CONSTRAINT vxsk_p12_matches_completed_score CHECK (
    state <> 'completed' OR (score_a IS NOT NULL AND score_b IS NOT NULL)
  ),
  CONSTRAINT vxsk_p12_matches_stage_tournament_fkey
    FOREIGN KEY (stage_id, tournament_id)
    REFERENCES public.vxsk_p12_stages(id, tournament_id) ON DELETE CASCADE,
  CONSTRAINT vxsk_p12_matches_team_a_tournament_fkey
    FOREIGN KEY (team_a, tournament_id)
    REFERENCES public.vxsk_p12_teams(id, tournament_id) ON DELETE RESTRICT,
  CONSTRAINT vxsk_p12_matches_team_b_tournament_fkey
    FOREIGN KEY (team_b, tournament_id)
    REFERENCES public.vxsk_p12_teams(id, tournament_id) ON DELETE RESTRICT,
  CONSTRAINT vxsk_p12_matches_id_tournament_key UNIQUE (id, tournament_id)
);

CREATE UNIQUE INDEX vxsk_p12_matches_fixture_unique
  ON public.vxsk_p12_matches (stage_id, bracket, round_no, slot, group_name);

CREATE INDEX vxsk_p12_matches_tournament_stage_state
  ON public.vxsk_p12_matches (tournament_id, stage_id, state, starts_at);

CREATE TABLE public.vxsk_p12_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL
    REFERENCES public.vxsk_p12_tournaments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('announcement', 'live', 'status')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 100),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 700),
  status_after text NOT NULL
    CHECK (status_after IN ('announced', 'upcoming', 'live', 'completed', 'cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vxsk_p12_updates_tournament_recent
  ON public.vxsk_p12_updates (tournament_id, created_at DESC);

CREATE TABLE public.vxsk_p12_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL
    REFERENCES public.vxsk_p12_tournaments(id) ON DELETE CASCADE,
  match_id uuid,
  kind text NOT NULL CHECK (kind IN ('score', 'update', 'incident')),
  score_a integer,
  score_b integer,
  notes text NOT NULL CHECK (char_length(btrim(notes)) BETWEEN 3 AND 800),
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'approved', 'rejected')),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT vxsk_p12_reports_score_pair CHECK (
    (score_a IS NULL AND score_b IS NULL)
    OR (score_a IS NOT NULL AND score_b IS NOT NULL)
  ),
  CONSTRAINT vxsk_p12_reports_score_bounds CHECK (
    (score_a IS NULL OR score_a BETWEEN 0 AND 99)
    AND (score_b IS NULL OR score_b BETWEEN 0 AND 99)
  ),
  CONSTRAINT vxsk_p12_reports_kind_fields CHECK (
    (kind = 'score' AND match_id IS NOT NULL AND score_a IS NOT NULL AND score_b IS NOT NULL)
    OR (kind IN ('update', 'incident') AND score_a IS NULL AND score_b IS NULL)
  ),
  CONSTRAINT vxsk_p12_reports_match_tournament_fkey
    FOREIGN KEY (match_id, tournament_id)
    REFERENCES public.vxsk_p12_matches(id, tournament_id) ON DELETE RESTRICT
);

CREATE INDEX vxsk_p12_reports_queue
  ON public.vxsk_p12_reports (state, created_at DESC);

CREATE INDEX vxsk_p12_reports_pending_score_match
  ON public.vxsk_p12_reports (match_id)
  WHERE kind = 'score' AND state = 'pending';

CREATE TABLE public.vxsk_p12_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (char_length(action) BETWEEN 2 AND 80),
  entity_type text NOT NULL CHECK (char_length(entity_type) BETWEEN 2 AND 40),
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vxsk_p12_audit_recent
  ON public.vxsk_p12_audit (created_at DESC);

-- RLS is enabled with no direct client table policies. P12 access is via RPCs.
ALTER TABLE public.vxsk_p12_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vxsk_p12_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vxsk_p12_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vxsk_p12_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vxsk_p12_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vxsk_p12_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vxsk_p12_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.vxsk_p12_tournaments,
  public.vxsk_p12_teams,
  public.vxsk_p12_stages,
  public.vxsk_p12_matches,
  public.vxsk_p12_updates,
  public.vxsk_p12_reports,
  public.vxsk_p12_audit
FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared result guard for the new P12 match table
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.vxsk_p12_guard_result_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.state = 'completed' OR NEW.score_a IS NOT NULL OR NEW.score_b IS NOT NULL)
       AND NOT public.vxsk_hub_owner() THEN
      RAISE EXCEPTION 'Owner verification required to publish a P12 result'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF (
      NEW.score_a IS DISTINCT FROM OLD.score_a
      OR NEW.score_b IS DISTINCT FROM OLD.score_b
      OR (NEW.state = 'completed' AND OLD.state IS DISTINCT FROM 'completed')
    ) AND NOT public.vxsk_hub_owner() THEN
      RAISE EXCEPTION 'Only the Owner may publish P12 match results'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER vxsk_p12_match_result_guard
BEFORE INSERT OR UPDATE ON public.vxsk_p12_matches
FOR EACH ROW EXECUTE FUNCTION public.vxsk_p12_guard_result_write();

-- ---------------------------------------------------------------------------
-- Role checks and snapshots
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.vxsk_p12_owner_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(public.vxsk_hub_owner(), false);
$function$;

CREATE FUNCTION public.vxsk_p12_referee_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(public.vxsk_hub_referee(), false);
$function$;

CREATE FUNCTION public.vxsk_p12_public_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tournaments jsonb;
  v_teams jsonb;
  v_stages jsonb;
  v_matches jsonb;
  v_updates jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.starts_at NULLS LAST, q.created_at DESC), '[]'::jsonb)
  INTO v_tournaments
  FROM (
    SELECT id, title, game, mode, starts_at, status, published, created_at
    FROM public.vxsk_p12_tournaments
    WHERE published = true
    ORDER BY starts_at NULLS LAST, created_at DESC
    LIMIT 200
  ) q;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at, q.name), '[]'::jsonb)
  INTO v_teams
  FROM (
    SELECT tm.id, tm.tournament_id, tm.name, tm.created_at
    FROM public.vxsk_p12_teams tm
    JOIN public.vxsk_p12_tournaments t ON t.id = tm.tournament_id
    WHERE t.published = true
    ORDER BY tm.created_at, tm.name
    LIMIT 2000
  ) q;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.tournament_id, q.stage_order), '[]'::jsonb)
  INTO v_stages
  FROM (
    SELECT s.id, s.tournament_id, s.name, s.format, s.stage_order
    FROM public.vxsk_p12_stages s
    JOIN public.vxsk_p12_tournaments t ON t.id = s.tournament_id
    WHERE t.published = true
    ORDER BY s.tournament_id, s.stage_order
    LIMIT 1000
  ) q;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.starts_at NULLS LAST, q.round_no, q.slot), '[]'::jsonb)
  INTO v_matches
  FROM (
    SELECT m.id, m.tournament_id, m.stage_id, m.team_a, m.team_b,
           m.round_no, m.slot, m.bracket, m.group_name, m.starts_at,
           m.state, m.score_a, m.score_b
    FROM public.vxsk_p12_matches m
    JOIN public.vxsk_p12_tournaments t ON t.id = m.tournament_id
    WHERE t.published = true
    ORDER BY m.starts_at NULLS LAST, m.round_no, m.slot
    LIMIT 3000
  ) q;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb)
  INTO v_updates
  FROM (
    SELECT u.id, u.tournament_id, u.kind, u.title, u.body, u.created_at
    FROM public.vxsk_p12_updates u
    JOIN public.vxsk_p12_tournaments t ON t.id = u.tournament_id
    WHERE t.published = true
    ORDER BY u.created_at DESC
    LIMIT 300
  ) q;

  RETURN jsonb_build_object(
    'tournaments', COALESCE(v_tournaments, '[]'::jsonb),
    'teams', COALESCE(v_teams, '[]'::jsonb),
    'stages', COALESCE(v_stages, '[]'::jsonb),
    'matches', COALESCE(v_matches, '[]'::jsonb),
    'updates', COALESCE(v_updates, '[]'::jsonb),
    'reports', '[]'::jsonb
  );
END;
$function$;

CREATE FUNCTION public.vxsk_p12_staff_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tournaments jsonb;
  v_teams jsonb;
  v_stages jsonb;
  v_matches jsonb;
  v_updates jsonb;
  v_reports jsonb := '[]'::jsonb;
  v_is_owner boolean := false;
BEGIN
  IF NOT public.vxsk_hub_referee() THEN
    RAISE EXCEPTION 'Referee access with 2FA required' USING ERRCODE = '42501';
  END IF;

  v_is_owner := public.vxsk_hub_owner();

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb)
  INTO v_tournaments
  FROM (
    SELECT id, title, game, mode, starts_at, status, published, created_at
    FROM public.vxsk_p12_tournaments
    WHERE v_is_owner OR published = true
    ORDER BY created_at DESC
    LIMIT 300
  ) q;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at, q.name), '[]'::jsonb)
  INTO v_teams
  FROM (
    SELECT tm.id, tm.tournament_id, tm.name, tm.created_at
    FROM public.vxsk_p12_teams tm
    JOIN public.vxsk_p12_tournaments t ON t.id = tm.tournament_id
    WHERE v_is_owner OR t.published = true
    ORDER BY tm.created_at, tm.name
    LIMIT 3000
  ) q;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.tournament_id, q.stage_order), '[]'::jsonb)
  INTO v_stages
  FROM (
    SELECT st.id, st.tournament_id, st.name, st.format, st.stage_order
    FROM public.vxsk_p12_stages st
    JOIN public.vxsk_p12_tournaments t ON t.id = st.tournament_id
    WHERE v_is_owner OR t.published = true
    ORDER BY st.tournament_id, st.stage_order
    LIMIT 1500
  ) q;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.starts_at NULLS LAST, q.round_no, q.slot), '[]'::jsonb)
  INTO v_matches
  FROM (
    SELECT m.id, m.tournament_id, m.stage_id, m.team_a, m.team_b,
           m.round_no, m.slot, m.bracket, m.group_name, m.starts_at,
           m.state, m.score_a, m.score_b, m.created_at
    FROM public.vxsk_p12_matches m
    JOIN public.vxsk_p12_tournaments t ON t.id = m.tournament_id
    WHERE v_is_owner OR t.published = true
    ORDER BY m.starts_at NULLS LAST, m.round_no, m.slot
    LIMIT 5000
  ) q;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb)
  INTO v_updates
  FROM (
    SELECT u.id, u.tournament_id, u.kind, u.title, u.body, u.status_after, u.created_at
    FROM public.vxsk_p12_updates u
    JOIN public.vxsk_p12_tournaments t ON t.id = u.tournament_id
    WHERE v_is_owner OR t.published = true
    ORDER BY u.created_at DESC
    LIMIT 1000
  ) q;

  -- Incident details, evidence notes and the Owner decision queue are Owner-only.
  IF v_is_owner THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb)
    INTO v_reports
    FROM (
      SELECT id, tournament_id, match_id, kind, score_a, score_b,
             notes, state, submitted_by, decided_by, created_at, decided_at
      FROM public.vxsk_p12_reports
      WHERE state = 'pending'
      ORDER BY created_at ASC
      LIMIT 500
    ) q;
  END IF;

  RETURN jsonb_build_object(
    'tournaments', COALESCE(v_tournaments, '[]'::jsonb),
    'teams', COALESCE(v_teams, '[]'::jsonb),
    'stages', COALESCE(v_stages, '[]'::jsonb),
    'matches', COALESCE(v_matches, '[]'::jsonb),
    'updates', COALESCE(v_updates, '[]'::jsonb),
    'reports', COALESCE(v_reports, '[]'::jsonb)
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Owner-only tournament administration
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.vxsk_p12_create_tournament(
  p_title text,
  p_game text,
  p_mode text,
  p_start timestamptz,
  p_publish boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_published boolean := COALESCE(p_publish, false);
BEGIN
  IF NOT public.vxsk_hub_owner() THEN
    RAISE EXCEPTION 'Owner and 2FA required' USING ERRCODE = '42501';
  END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 100
     OR p_game IS NULL OR p_game NOT IN ('Rocket League', 'VALORANT', 'League of Legends')
     OR p_mode IS NULL OR char_length(btrim(p_mode)) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Invalid tournament details' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vxsk_p12_tournaments
    (title, game, mode, starts_at, status, published, created_by)
  VALUES
    (btrim(p_title), p_game, btrim(p_mode), p_start,
     CASE WHEN v_published THEN 'upcoming' ELSE 'announced' END,
     v_published, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'create_tournament', 'tournament', v_id,
          jsonb_build_object('game', p_game, 'published', v_published));
  RETURN v_id;
END;
$function$;

CREATE FUNCTION public.vxsk_p12_add_team(p_tournament uuid, p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.vxsk_hub_owner() THEN
    RAISE EXCEPTION 'Owner and 2FA required' USING ERRCODE = '42501';
  END IF;
  IF p_tournament IS NULL OR p_name IS NULL
     OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 80
     OR NOT EXISTS (SELECT 1 FROM public.vxsk_p12_tournaments WHERE id = p_tournament) THEN
    RAISE EXCEPTION 'Invalid tournament entrant' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vxsk_p12_teams(tournament_id, name, created_by)
  VALUES (p_tournament, btrim(p_name), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'add_entrant', 'team', v_id,
          jsonb_build_object('tournament_id', p_tournament));
  RETURN v_id;
END;
$function$;

CREATE FUNCTION public.vxsk_p12_add_stage(
  p_tournament uuid,
  p_name text,
  p_format text,
  p_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.vxsk_hub_owner() THEN
    RAISE EXCEPTION 'Owner and 2FA required' USING ERRCODE = '42501';
  END IF;
  IF p_tournament IS NULL OR p_name IS NULL
     OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 70
     OR p_format IS NULL OR p_format NOT IN ('single', 'double', 'groups', 'swiss')
     OR p_order IS NULL OR p_order NOT BETWEEN 1 AND 20
     OR NOT EXISTS (SELECT 1 FROM public.vxsk_p12_tournaments WHERE id = p_tournament) THEN
    RAISE EXCEPTION 'Invalid tournament stage' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vxsk_p12_stages
    (tournament_id, name, format, stage_order, created_by)
  VALUES (p_tournament, btrim(p_name), p_format, p_order, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'add_stage', 'stage', v_id,
          jsonb_build_object('tournament_id', p_tournament, 'format', p_format, 'order', p_order));
  RETURN v_id;
END;
$function$;

CREATE FUNCTION public.vxsk_p12_add_match(
  p_stage uuid,
  p_a uuid,
  p_b uuid,
  p_round integer,
  p_slot integer,
  p_bracket text,
  p_group text,
  p_start timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_tournament uuid;
  v_format text;
  v_group text := COALESCE(btrim(p_group), '');
BEGIN
  IF NOT public.vxsk_hub_owner() THEN
    RAISE EXCEPTION 'Owner and 2FA required' USING ERRCODE = '42501';
  END IF;
  IF p_stage IS NULL OR p_a IS NULL OR p_b IS NULL OR p_a = p_b
     OR p_round IS NULL OR p_round NOT BETWEEN 1 AND 60
     OR p_slot IS NULL OR p_slot NOT BETWEEN 1 AND 256
     OR p_bracket IS NULL OR p_bracket NOT IN ('main', 'winners', 'losers', 'grand_final')
     OR char_length(v_group) > 35 THEN
    RAISE EXCEPTION 'Invalid match fixture details' USING ERRCODE = '22023';
  END IF;

  SELECT tournament_id, format
  INTO v_tournament, v_format
  FROM public.vxsk_p12_stages
  WHERE id = p_stage;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage not found' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vxsk_p12_teams
    WHERE id = p_a AND tournament_id = v_tournament
  ) OR NOT EXISTS (
    SELECT 1 FROM public.vxsk_p12_teams
    WHERE id = p_b AND tournament_id = v_tournament
  ) THEN
    RAISE EXCEPTION 'Both entrants must belong to this tournament' USING ERRCODE = '22023';
  END IF;

  IF (v_format = 'double' AND p_bracket NOT IN ('winners', 'losers', 'grand_final'))
     OR (v_format <> 'double' AND p_bracket <> 'main') THEN
    RAISE EXCEPTION 'Bracket lane does not match this stage format' USING ERRCODE = '22023';
  END IF;

  IF v_group <> '' AND v_format <> 'groups' THEN
    RAISE EXCEPTION 'Group name is only valid for a group stage' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vxsk_p12_matches
    (tournament_id, stage_id, team_a, team_b, round_no, slot,
     bracket, group_name, starts_at, created_by)
  VALUES
    (v_tournament, p_stage, p_a, p_b, p_round, p_slot,
     p_bracket, v_group, p_start, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'add_match', 'match', v_id,
          jsonb_build_object('tournament_id', v_tournament, 'stage_id', p_stage,
                             'round', p_round, 'slot', p_slot, 'bracket', p_bracket));
  RETURN v_id;
END;
$function$;

CREATE FUNCTION public.vxsk_p12_announce(
  p_tournament uuid,
  p_kind text,
  p_title text,
  p_message text,
  p_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.vxsk_hub_owner() THEN
    RAISE EXCEPTION 'Owner and 2FA required' USING ERRCODE = '42501';
  END IF;
  IF p_tournament IS NULL
     OR p_kind IS NULL OR p_kind NOT IN ('announcement', 'live', 'status')
     OR p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 100
     OR char_length(COALESCE(p_message, '')) > 700
     OR p_status IS NULL OR p_status NOT IN ('announced', 'upcoming', 'live', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid tournament update' USING ERRCODE = '22023';
  END IF;

  -- Lock the tournament row to serialize closure against score-report submission.
  PERFORM 1
  FROM public.vxsk_p12_tournaments
  WHERE id = p_tournament
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE = '22023';
  END IF;

  IF p_status IN ('completed', 'cancelled')
     AND EXISTS (
       SELECT 1
       FROM public.vxsk_p12_reports
       WHERE tournament_id = p_tournament
         AND kind = 'score'
         AND state = 'pending'
     ) THEN
    RAISE EXCEPTION 'Resolve pending score reports before closing this tournament';
  END IF;

  UPDATE public.vxsk_p12_tournaments
  SET status = p_status, updated_at = now()
  WHERE id = p_tournament;

  INSERT INTO public.vxsk_p12_updates
    (tournament_id, kind, title, body, status_after, created_by)
  VALUES
    (p_tournament, p_kind, btrim(p_title), COALESCE(p_message, ''), p_status, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'publish_update', 'update', v_id,
          jsonb_build_object('tournament_id', p_tournament, 'kind', p_kind, 'status', p_status));
  RETURN v_id;
END;
$function$;

CREATE FUNCTION public.vxsk_p12_publish(p_tournament uuid, p_publish boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.vxsk_hub_owner() THEN
    RAISE EXCEPTION 'Owner and 2FA required' USING ERRCODE = '42501';
  END IF;
  IF p_tournament IS NULL OR p_publish IS NULL THEN
    RAISE EXCEPTION 'Tournament and visibility are required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.vxsk_p12_tournaments
  SET published = p_publish, updated_at = now()
  WHERE id = p_tournament;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN p_publish THEN 'publish_tournament' ELSE 'unpublish_tournament' END,
          'tournament', p_tournament, jsonb_build_object('published', p_publish));
  RETURN true;
END;
$function$;

CREATE FUNCTION public.vxsk_p12_mark_match_live(p_match uuid, p_live boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tournament uuid;
BEGIN
  IF NOT public.vxsk_hub_owner() THEN
    RAISE EXCEPTION 'Owner and 2FA required' USING ERRCODE = '42501';
  END IF;
  IF p_match IS NULL OR p_live IS NULL THEN
    RAISE EXCEPTION 'Match and status are required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.vxsk_p12_matches m
  SET state = CASE WHEN p_live THEN 'live' ELSE 'scheduled' END,
      updated_at = now()
  FROM public.vxsk_p12_tournaments t
  WHERE m.id = p_match
    AND t.id = m.tournament_id
    AND t.status NOT IN ('completed', 'cancelled')
    AND m.state IN ('scheduled', 'live')
  RETURNING m.tournament_id INTO v_tournament;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN p_live THEN 'mark_match_live' ELSE 'mark_match_scheduled' END,
          'match', p_match, jsonb_build_object('tournament_id', v_tournament));
  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Referee submission and Owner decision
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.vxsk_p12_submit_report(
  p_tournament uuid,
  p_match uuid,
  p_kind text,
  p_a integer,
  p_b integer,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_notes text := btrim(COALESCE(p_notes, ''));
  v_match_state text;
  v_tournament_status text;
BEGIN
  IF NOT public.vxsk_hub_referee() THEN
    RAISE EXCEPTION 'Referee role and 2FA required' USING ERRCODE = '42501';
  END IF;
  IF p_tournament IS NULL OR p_kind IS NULL
     OR p_kind NOT IN ('score', 'update', 'incident')
     OR char_length(v_notes) NOT BETWEEN 3 AND 800 THEN
    RAISE EXCEPTION 'Invalid referee report' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_tournament_status
  FROM public.vxsk_p12_tournaments
  WHERE id = p_tournament AND published = true
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reports may only be submitted for published tournaments'
      USING ERRCODE = '42501';
  END IF;

  IF p_kind = 'score' THEN
    IF v_tournament_status NOT IN ('announced', 'upcoming', 'live') THEN
      RAISE EXCEPTION 'This tournament is not accepting score reports';
    END IF;
    IF p_match IS NULL OR p_a IS NULL OR p_b IS NULL
       OR p_a NOT BETWEEN 0 AND 99 OR p_b NOT BETWEEN 0 AND 99 THEN
      RAISE EXCEPTION 'A score report requires a match and two scores from 0 to 99'
        USING ERRCODE = '22023';
    END IF;

    SELECT state INTO v_match_state
    FROM public.vxsk_p12_matches
    WHERE id = p_match AND tournament_id = p_tournament
    FOR UPDATE;

    IF NOT FOUND OR v_match_state NOT IN ('scheduled', 'live') THEN
      RAISE EXCEPTION 'Only scheduled or live matches can receive a score report'
        USING ERRCODE = '22023';
    END IF;

    -- The match row lock serializes referee submissions for this fixture.
    IF EXISTS (
      SELECT 1 FROM public.vxsk_p12_reports
      WHERE match_id = p_match AND kind = 'score' AND state = 'pending'
    ) THEN
      RAISE EXCEPTION 'A score report is already awaiting Owner review';
    END IF;
  ELSE
    IF p_a IS NOT NULL OR p_b IS NOT NULL THEN
      RAISE EXCEPTION 'Only score reports may contain scores' USING ERRCODE = '22023';
    END IF;
    IF p_match IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.vxsk_p12_matches
      WHERE id = p_match AND tournament_id = p_tournament
    ) THEN
      RAISE EXCEPTION 'Report match does not belong to this tournament' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text, 0)
  );

  IF (
    SELECT count(*)
    FROM public.vxsk_p12_reports
    WHERE submitted_by = auth.uid()
      AND created_at > now() - interval '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION 'Hourly referee report limit reached';
  END IF;

  INSERT INTO public.vxsk_p12_reports
    (tournament_id, match_id, kind, score_a, score_b, notes, submitted_by)
  VALUES
    (p_tournament, p_match, p_kind, p_a, p_b, v_notes, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'submit_report', 'report', v_id,
          jsonb_build_object('tournament_id', p_tournament, 'match_id', p_match, 'kind', p_kind));
  RETURN v_id;
END;
$function$;

CREATE FUNCTION public.vxsk_p12_decide_report(p_report uuid, p_approve boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_report public.vxsk_p12_reports%ROWTYPE;
  v_match_state text;
  v_tournament_status text;
BEGIN
  IF NOT public.vxsk_hub_owner() THEN
    RAISE EXCEPTION 'Owner and 2FA required' USING ERRCODE = '42501';
  END IF;
  IF p_report IS NULL OR p_approve IS NULL THEN
    RAISE EXCEPTION 'Report and decision are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_report
  FROM public.vxsk_p12_reports
  WHERE id = p_report AND state = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending report not found';
  END IF;
  IF v_report.submitted_by = auth.uid() THEN
    RAISE EXCEPTION 'A report author cannot approve or reject their own report'
      USING ERRCODE = '42501';
  END IF;

  IF p_approve AND v_report.kind = 'score' THEN
    SELECT t.status INTO v_tournament_status
    FROM public.vxsk_p12_tournaments t
    WHERE t.id = v_report.tournament_id
    FOR SHARE;

    IF NOT FOUND OR v_tournament_status NOT IN ('announced', 'upcoming', 'live') THEN
      RAISE EXCEPTION 'This tournament is no longer eligible for score approval';
    END IF;

    SELECT state INTO v_match_state
    FROM public.vxsk_p12_matches
    WHERE id = v_report.match_id AND tournament_id = v_report.tournament_id
    FOR UPDATE;

    IF NOT FOUND OR v_match_state NOT IN ('scheduled', 'live') THEN
      RAISE EXCEPTION 'This match is no longer eligible for score approval';
    END IF;

    UPDATE public.vxsk_p12_matches
    SET score_a = v_report.score_a,
        score_b = v_report.score_b,
        state = 'completed',
        updated_at = now()
    WHERE id = v_report.match_id;
  END IF;

  UPDATE public.vxsk_p12_reports
  SET state = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      decided_by = auth.uid(),
      decided_at = now()
  WHERE id = p_report;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), CASE WHEN p_approve THEN 'approve_report' ELSE 'reject_report' END,
          'report', p_report,
          jsonb_build_object('kind', v_report.kind, 'tournament_id', v_report.tournament_id,
                             'match_id', v_report.match_id));
  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Least-privilege function grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.vxsk_p12_guard_result_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_owner_ok() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_referee_ok() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_public_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_staff_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_create_tournament(text, text, text, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_add_team(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_add_stage(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_add_match(uuid, uuid, uuid, integer, integer, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_announce(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_publish(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_mark_match_live(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_submit_report(uuid, uuid, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_decide_report(uuid, boolean) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.vxsk_p12_public_snapshot() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_owner_ok() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_referee_ok() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_staff_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_create_tournament(text, text, text, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_add_team(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_add_stage(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_add_match(uuid, uuid, uuid, integer, integer, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_announce(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_publish(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_mark_match_live(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_submit_report(uuid, uuid, text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_decide_report(uuid, boolean) TO authenticated;

COMMIT;

-- Post-apply verification (run separately after explicit approval):
-- 1) Confirm all 13 vxsk_p12_* RPCs exist and have the intended EXECUTE grants.
-- 2) Confirm all seven P12 tables have RLS enabled and no direct anon/authenticated table grants.
-- 3) Confirm the trigger vxsk_p12_match_result_guard exists.
-- 4) Test as anonymous, authenticated non-staff, Referee (AAL2), and Owner (AAL2).
-- 5) Verify a submitted score is not public until an Owner different from the submitter approves it.
