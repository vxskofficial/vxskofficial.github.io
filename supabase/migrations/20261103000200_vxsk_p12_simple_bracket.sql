-- VXSK P12 Simple Single-Elimination Bracket Extension
-- DRAFT FOR REVIEW / DRY-RUN ONLY — DO NOT APPLY WITH COMMIT YET.
-- Adds auto bracket generation, byes, winner advancement and Owner score entry.
-- Does not modify the legacy vxsk_hub_* system or production.
--
-- Before applying: run the complete file in the Supabase STAGING SQL Editor
-- with the final COMMIT; replaced by ROLLBACK;. Then review the result.

BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.vxsk_p12_matches') IS NULL
     OR to_regclass('public.vxsk_p12_teams') IS NULL
     OR to_regclass('public.vxsk_p12_stages') IS NULL
     OR to_regclass('public.vxsk_p12_tournaments') IS NULL
     OR to_regclass('public.vxsk_p12_audit') IS NULL THEN
    RAISE EXCEPTION 'P12 core migration is not installed; stop before applying the bracket extension';
  END IF;

  IF to_regprocedure('public.vxsk_p12_generate_single_bracket(uuid,text[],boolean,boolean)') IS NOT NULL
     OR to_regprocedure('public.vxsk_p12_owner_record_score(uuid,integer,integer)') IS NOT NULL
     OR to_regprocedure('public.vxsk_p12_apply_match_result(uuid,integer,integer,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'P12 bracket extension already exists; stop and inspect before rerunning';
  END IF;
END
$preflight$;

-- Future-round matches need empty participant positions until earlier winners advance.
ALTER TABLE public.vxsk_p12_matches
  ALTER COLUMN team_a DROP NOT NULL,
  ALTER COLUMN team_b DROP NOT NULL;

ALTER TABLE public.vxsk_p12_matches
  ADD COLUMN winner_team_id uuid,
  ADD COLUMN next_match_id uuid,
  ADD COLUMN next_team_slot text;

ALTER TABLE public.vxsk_p12_matches
  DROP CONSTRAINT IF EXISTS vxsk_p12_matches_state_check;

ALTER TABLE public.vxsk_p12_matches
  ADD CONSTRAINT vxsk_p12_matches_state_check
  CHECK (state IN ('waiting', 'scheduled', 'live', 'completed', 'bye', 'cancelled'));

ALTER TABLE public.vxsk_p12_matches
  ADD CONSTRAINT vxsk_p12_matches_winner_team_fkey
  FOREIGN KEY (winner_team_id, tournament_id)
  REFERENCES public.vxsk_p12_teams(id, tournament_id)
  ON DELETE RESTRICT;

ALTER TABLE public.vxsk_p12_matches
  ADD CONSTRAINT vxsk_p12_matches_next_match_fkey
  FOREIGN KEY (next_match_id, tournament_id)
  REFERENCES public.vxsk_p12_matches(id, tournament_id)
  ON DELETE CASCADE;

ALTER TABLE public.vxsk_p12_matches
  ADD CONSTRAINT vxsk_p12_matches_next_slot_check
  CHECK (
    (next_match_id IS NULL AND next_team_slot IS NULL)
    OR (next_match_id IS NOT NULL AND next_team_slot IN ('A', 'B'))
  );

ALTER TABLE public.vxsk_p12_matches
  ADD CONSTRAINT vxsk_p12_matches_winner_member_check
  CHECK (
    winner_team_id IS NULL
    OR winner_team_id IS NOT DISTINCT FROM team_a
    OR winner_team_id IS NOT DISTINCT FROM team_b
  );

ALTER TABLE public.vxsk_p12_matches
  ADD CONSTRAINT vxsk_p12_matches_waiting_fields_check
  CHECK (
    state <> 'waiting'
    OR (
      num_nonnulls(team_a, team_b) < 2
      AND score_a IS NULL AND score_b IS NULL
      AND winner_team_id IS NULL
    )
  );

ALTER TABLE public.vxsk_p12_matches
  ADD CONSTRAINT vxsk_p12_matches_bye_fields_check
  CHECK (
    state <> 'bye'
    OR (
      num_nonnulls(team_a, team_b) = 1
      AND winner_team_id IS NOT NULL
      AND (winner_team_id IS NOT DISTINCT FROM team_a
           OR winner_team_id IS NOT DISTINCT FROM team_b)
      AND score_a IS NULL AND score_b IS NULL
    )
  );

ALTER TABLE public.vxsk_p12_matches
  ADD CONSTRAINT vxsk_p12_matches_ready_fields_check
  CHECK (
    state NOT IN ('scheduled', 'live', 'completed')
    OR (team_a IS NOT NULL AND team_b IS NOT NULL)
  );

CREATE UNIQUE INDEX vxsk_p12_matches_next_slot_unique
  ON public.vxsk_p12_matches (next_match_id, next_team_slot)
  WHERE next_match_id IS NOT NULL;

CREATE INDEX vxsk_p12_matches_bracket_display
  ON public.vxsk_p12_matches (stage_id, round_no, slot);

-- Require Owner + AAL2 for all direct match-row changes, including bracket
-- topology, byes, score publication, winner assignment and advancement.
CREATE OR REPLACE FUNCTION public.vxsk_p12_guard_result_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT COALESCE(public.vxsk_hub_owner(), false) THEN
    RAISE EXCEPTION 'Owner verification with 2FA required for P12 match changes'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- Internal helper. It is not executable by API roles; only the Owner RPCs
-- below call it. It publishes a result and fills the winner's next-round slot.
CREATE FUNCTION public.vxsk_p12_apply_match_result(
  p_match uuid,
  p_score_a integer,
  p_score_b integer,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_match public.vxsk_p12_matches%ROWTYPE;
  v_next public.vxsk_p12_matches%ROWTYPE;
  v_format text;
  v_tournament_status text;
  v_winner uuid;
BEGIN
  IF NOT COALESCE(public.vxsk_hub_owner(), false) THEN
    RAISE EXCEPTION 'Owner verification with 2FA required'
      USING ERRCODE = '42501';
  END IF;

  IF p_match IS NULL OR p_score_a IS NULL OR p_score_b IS NULL
     OR p_score_a NOT BETWEEN 0 AND 99 OR p_score_b NOT BETWEEN 0 AND 99 THEN
    RAISE EXCEPTION 'Choose a match and enter two scores from 0 to 99'
      USING ERRCODE = '22023';
  END IF;

  SELECT m.*, s.format
  INTO v_match, v_format
  FROM public.vxsk_p12_matches m
  JOIN public.vxsk_p12_stages s
    ON s.id = m.stage_id AND s.tournament_id = m.tournament_id
  WHERE m.id = p_match
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '22023';
  END IF;

  IF v_match.state NOT IN ('scheduled', 'live')
     OR v_match.team_a IS NULL OR v_match.team_b IS NULL THEN
    RAISE EXCEPTION 'This match is not ready for a score'
      USING ERRCODE = '22023';
  END IF;

  IF p_score_a = p_score_b AND v_format = 'single' THEN
    RAISE EXCEPTION 'Knockout matches cannot end in a draw; enter the confirmed winner score'
      USING ERRCODE = '22023';
  END IF;

  SELECT status
  INTO v_tournament_status
  FROM public.vxsk_p12_tournaments
  WHERE id = v_match.tournament_id
  FOR SHARE;

  IF NOT FOUND OR v_tournament_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'This tournament is closed and cannot accept results'
      USING ERRCODE = '22023';
  END IF;

  IF p_score_a > p_score_b THEN
    v_winner := v_match.team_a;
  ELSIF p_score_b > p_score_a THEN
    v_winner := v_match.team_b;
  ELSE
    v_winner := NULL;
  END IF;

  UPDATE public.vxsk_p12_matches
  SET score_a = p_score_a,
      score_b = p_score_b,
      winner_team_id = v_winner,
      state = 'completed',
      updated_at = now()
  WHERE id = p_match;

  IF v_winner IS NOT NULL AND v_match.next_match_id IS NOT NULL THEN
    SELECT *
    INTO v_next
    FROM public.vxsk_p12_matches
    WHERE id = v_match.next_match_id
      AND tournament_id = v_match.tournament_id
    FOR UPDATE;

    IF NOT FOUND OR v_next.state NOT IN ('waiting', 'scheduled') THEN
      RAISE EXCEPTION 'Next-round slot is not available; stop and review this bracket';
    END IF;

    IF v_match.next_team_slot = 'A' THEN
      IF v_next.team_a IS NOT NULL THEN
        RAISE EXCEPTION 'Next-round Team A slot is already occupied';
      END IF;
      UPDATE public.vxsk_p12_matches
      SET team_a = v_winner,
          state = CASE WHEN team_b IS NOT NULL THEN 'scheduled' ELSE 'waiting' END,
          updated_at = now()
      WHERE id = v_next.id;
    ELSIF v_match.next_team_slot = 'B' THEN
      IF v_next.team_b IS NOT NULL THEN
        RAISE EXCEPTION 'Next-round Team B slot is already occupied';
      END IF;
      UPDATE public.vxsk_p12_matches
      SET team_b = v_winner,
          state = CASE WHEN team_a IS NOT NULL THEN 'scheduled' ELSE 'waiting' END,
          updated_at = now()
      WHERE id = v_next.id;
    ELSE
      RAISE EXCEPTION 'Bracket advancement mapping is invalid';
    END IF;
  END IF;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (
    COALESCE(p_actor, auth.uid()),
    'record_match_result',
    'match',
    p_match,
    jsonb_build_object(
      'score_a', p_score_a,
      'score_b', p_score_b,
      'winner_team_id', v_winner,
      'next_match_id', v_match.next_match_id,
      'next_team_slot', v_match.next_team_slot
    )
  );
END;
$function$;

-- Owner creates entrants and the whole single-elimination tree in one atomic RPC.
-- Input order is the seed order unless p_shuffle is true. The bracket size and
-- all round/slot numbering are generated internally and never entered by staff.
CREATE FUNCTION public.vxsk_p12_generate_single_bracket(
  p_tournament uuid,
  p_team_names text[],
  p_shuffle boolean,
  p_publish boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tournament public.vxsk_p12_tournaments%ROWTYPE;
  v_stage_id uuid;
  v_name text;
  v_team_id uuid;
  v_team_ids uuid[] := ARRAY[]::uuid[];
  v_names text[];
  v_seed_order integer[] := ARRAY[1, 2];
  v_new_seed_order integer[];
  v_current_size integer := 2;
  v_bracket_size integer := 1;
  v_rounds integer := 0;
  v_round integer;
  v_round_count integer;
  v_offset integer := 0;
  v_next_offset integer;
  v_slot integer;
  v_parent_index integer;
  v_seed_a integer;
  v_seed_b integer;
  v_team_a uuid;
  v_team_b uuid;
  v_state text;
  v_match_id uuid;
  v_match_ids uuid[] := ARRAY[]::uuid[];
  v_bye record;
  v_total integer;
BEGIN
  IF NOT COALESCE(public.vxsk_hub_owner(), false) THEN
    RAISE EXCEPTION 'Owner verification with 2FA required'
      USING ERRCODE = '42501';
  END IF;

  IF p_tournament IS NULL OR p_publish IS NULL THEN
    RAISE EXCEPTION 'Tournament and publish choice are required'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(array_length(p_team_names, 1), 0) NOT BETWEEN 2 AND 64 THEN
    RAISE EXCEPTION 'Add between 2 and 64 teams before generating the bracket'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_team_names) AS n(name)
    WHERE n.name IS NULL
       OR char_length(btrim(n.name)) NOT BETWEEN 2 AND 80
  ) THEN
    RAISE EXCEPTION 'Each team name must contain between 2 and 80 characters'
      USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(DISTINCT lower(btrim(n.name)))
    FROM unnest(p_team_names) AS n(name)
  ) <> array_length(p_team_names, 1) THEN
    RAISE EXCEPTION 'Team names must be unique within this tournament'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_tournament
  FROM public.vxsk_p12_tournaments
  WHERE id = p_tournament
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE = '22023';
  END IF;

  IF v_tournament.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'A closed tournament cannot receive a new bracket';
  END IF;

  IF EXISTS (SELECT 1 FROM public.vxsk_p12_teams WHERE tournament_id = p_tournament)
     OR EXISTS (SELECT 1 FROM public.vxsk_p12_stages WHERE tournament_id = p_tournament)
     OR EXISTS (SELECT 1 FROM public.vxsk_p12_matches WHERE tournament_id = p_tournament) THEN
    RAISE EXCEPTION 'This tournament already has entrants or fixtures; create a new empty tournament for a new bracket';
  END IF;

  SELECT array_agg(
           btrim(n.name)
           ORDER BY CASE WHEN COALESCE(p_shuffle, false)
                         THEN random()
                         ELSE n.ordinality::double precision
                    END
         )
  INTO v_names
  FROM unnest(p_team_names) WITH ORDINALITY AS n(name, ordinality);

  v_total := array_length(v_names, 1);

  WHILE v_bracket_size < v_total LOOP
    v_bracket_size := v_bracket_size * 2;
    v_rounds := v_rounds + 1;
  END LOOP;

  WHILE v_current_size < v_bracket_size LOOP
    v_new_seed_order := ARRAY[]::integer[];
    FOREACH v_seed_a IN ARRAY v_seed_order LOOP
      v_new_seed_order := array_append(v_new_seed_order, v_seed_a);
      v_new_seed_order := array_append(v_new_seed_order, (v_current_size * 2) + 1 - v_seed_a);
    END LOOP;
    v_seed_order := v_new_seed_order;
    v_current_size := v_current_size * 2;
  END LOOP;

  INSERT INTO public.vxsk_p12_stages
    (tournament_id, name, format, stage_order, created_by)
  VALUES
    (p_tournament, 'Single Elimination', 'single', 1, auth.uid())
  RETURNING id INTO v_stage_id;

  FOREACH v_name IN ARRAY v_names LOOP
    INSERT INTO public.vxsk_p12_teams(tournament_id, name, created_by)
    VALUES (p_tournament, v_name, auth.uid())
    RETURNING id INTO v_team_id;
    v_team_ids := array_append(v_team_ids, v_team_id);
  END LOOP;

  -- Create every round as match cards; future rounds start with TBD positions.
  v_offset := 0;
  FOR v_round IN 1..v_rounds LOOP
    v_round_count := v_bracket_size / power(2::numeric, v_round)::integer;

    FOR v_slot IN 1..v_round_count LOOP
      v_team_a := NULL;
      v_team_b := NULL;
      v_state := 'waiting';

      IF v_round = 1 THEN
        v_seed_a := v_seed_order[((v_slot - 1) * 2) + 1];
        v_seed_b := v_seed_order[((v_slot - 1) * 2) + 2];

        IF v_seed_a <= v_total THEN
          v_team_a := v_team_ids[v_seed_a];
        END IF;
        IF v_seed_b <= v_total THEN
          v_team_b := v_team_ids[v_seed_b];
        END IF;

        IF v_team_a IS NULL OR v_team_b IS NULL THEN
          v_state := 'bye';
        ELSE
          v_state := 'scheduled';
        END IF;
      END IF;

      INSERT INTO public.vxsk_p12_matches
        (tournament_id, stage_id, team_a, team_b, round_no, slot,
         bracket, group_name, state, winner_team_id, created_by)
      VALUES
        (p_tournament, v_stage_id, v_team_a, v_team_b, v_round, v_slot,
         'main', '', v_state,
         CASE WHEN v_state = 'bye' THEN COALESCE(v_team_a, v_team_b) ELSE NULL END,
         auth.uid())
      RETURNING id INTO v_match_id;

      v_match_ids := array_append(v_match_ids, v_match_id);
    END LOOP;

    v_offset := v_offset + v_round_count;
  END LOOP;

  -- Connect each match winner to the correct side of the next round.
  v_offset := 0;
  FOR v_round IN 1..(v_rounds - 1) LOOP
    v_round_count := v_bracket_size / power(2::numeric, v_round)::integer;
    v_next_offset := v_offset + v_round_count;

    FOR v_slot IN 1..v_round_count LOOP
      v_parent_index := v_next_offset + ((v_slot + 1) / 2);
      UPDATE public.vxsk_p12_matches
      SET next_match_id = v_match_ids[v_parent_index],
          next_team_slot = CASE WHEN mod(v_slot, 2) = 1 THEN 'A' ELSE 'B' END
      WHERE id = v_match_ids[v_offset + v_slot];
    END LOOP;

    v_offset := v_offset + v_round_count;
  END LOOP;

  -- A BYE never counts as a played win. It only fills the next-round slot.
  FOR v_bye IN
    SELECT next_match_id, next_team_slot, winner_team_id
    FROM public.vxsk_p12_matches
    WHERE tournament_id = p_tournament
      AND stage_id = v_stage_id
      AND state = 'bye'
      AND next_match_id IS NOT NULL
  LOOP
    IF v_bye.next_team_slot = 'A' THEN
      UPDATE public.vxsk_p12_matches
      SET team_a = v_bye.winner_team_id,
          state = CASE WHEN team_b IS NOT NULL THEN 'scheduled' ELSE 'waiting' END,
          updated_at = now()
      WHERE id = v_bye.next_match_id AND team_a IS NULL;
    ELSE
      UPDATE public.vxsk_p12_matches
      SET team_b = v_bye.winner_team_id,
          state = CASE WHEN team_a IS NOT NULL THEN 'scheduled' ELSE 'waiting' END,
          updated_at = now()
      WHERE id = v_bye.next_match_id AND team_b IS NULL;
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Could not place a BYE into its next-round slot';
    END IF;
  END LOOP;

  UPDATE public.vxsk_p12_tournaments
  SET published = p_publish,
      status = CASE WHEN p_publish THEN 'upcoming' ELSE 'announced' END,
      updated_at = now()
  WHERE id = p_tournament;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'generate_single_bracket',
    'stage',
    v_stage_id,
    jsonb_build_object(
      'entrant_count', v_total,
      'bracket_size', v_bracket_size,
      'rounds', v_rounds,
      'byes', v_bracket_size - v_total,
      'shuffled', COALESCE(p_shuffle, false),
      'published', p_publish
    )
  );

  RETURN v_stage_id;
END;
$function$;

CREATE FUNCTION public.vxsk_p12_owner_record_score(
  p_match uuid,
  p_score_a integer,
  p_score_b integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT COALESCE(public.vxsk_hub_owner(), false) THEN
    RAISE EXCEPTION 'Owner verification with 2FA required'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.vxsk_p12_apply_match_result(
    p_match, p_score_a, p_score_b, auth.uid()
  );
  RETURN true;
END;
$function$;

-- Reconnect the existing referee approval flow to automatic bracket advancement.
CREATE OR REPLACE FUNCTION public.vxsk_p12_decide_report(
  p_report uuid,
  p_approve boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_report public.vxsk_p12_reports%ROWTYPE;
  v_tournament_status text;
BEGIN
  IF NOT COALESCE(public.vxsk_hub_owner(), false) THEN
    RAISE EXCEPTION 'Owner and 2FA required' USING ERRCODE = '42501';
  END IF;
  IF p_report IS NULL OR p_approve IS NULL THEN
    RAISE EXCEPTION 'Report and decision are required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_report
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
    SELECT status
    INTO v_tournament_status
    FROM public.vxsk_p12_tournaments
    WHERE id = v_report.tournament_id
    FOR SHARE;

    IF NOT FOUND OR v_tournament_status NOT IN ('announced', 'upcoming', 'live') THEN
      RAISE EXCEPTION 'This tournament is no longer eligible for score approval';
    END IF;

    PERFORM public.vxsk_p12_apply_match_result(
      v_report.match_id,
      v_report.score_a,
      v_report.score_b,
      auth.uid()
    );
  END IF;

  UPDATE public.vxsk_p12_reports
  SET state = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      decided_by = auth.uid(),
      decided_at = now()
  WHERE id = p_report;

  INSERT INTO public.vxsk_p12_audit(actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    CASE WHEN p_approve THEN 'approve_report' ELSE 'reject_report' END,
    'report',
    p_report,
    jsonb_build_object(
      'kind', v_report.kind,
      'tournament_id', v_report.tournament_id,
      'match_id', v_report.match_id
    )
  );

  RETURN true;
END;
$function$;

-- Only API-facing RPCs are executable by authenticated users.
-- The internal apply helper and trigger function remain non-executable to clients.
REVOKE ALL ON FUNCTION public.vxsk_p12_guard_result_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_apply_match_result(uuid, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_generate_single_bracket(uuid, text[], boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_owner_record_score(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vxsk_p12_decide_report(uuid, boolean) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.vxsk_p12_generate_single_bracket(uuid, text[], boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_owner_record_score(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vxsk_p12_decide_report(uuid, boolean) TO authenticated;

COMMIT;

-- Verification after installation:
-- 1) Confirm the three new columns and the new states exist.
-- 2) Confirm the bracket generator and Owner score RPCs have authenticated EXECUTE,
--    anon does not, and both are SECURITY DEFINER.
-- 3) Confirm the internal apply helper and trigger function have no anon/auth EXECUTE.
-- 4) Generate a disposable 5-team draft bracket: expect 7 match nodes, 3 BYEs,
--    two first-round matches with two teams, and automatic later-round slots.
-- 5) Confirm score approval / Owner score entry fills the correct next-round slot.
