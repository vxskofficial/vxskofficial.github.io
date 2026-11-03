# VXSK Backend & Product Handoff
**Last updated:** 2026-11-03  
**Repository:** `vxskofficial/vxskofficial.github.io`  
**Working branch:** `staging/vxsk-cloudflare-preview`  
**Production branch:** `main` — do not modify or merge without explicit approval.

## Deployment model
- Work is committed to the staging branch only.
- The Cloudflare Worker at `aged-king-409c.gamerotp2.workers.dev` is a separate manual preview deployment. GitHub commits do not update it automatically.
- After a staging change, download the branch ZIP, extract it, and manually deploy its static assets to the Worker.
- Do not merge staging or feature branches to `main` without the owner's explicit approval.
- Never put Supabase service-role keys, AI provider keys, payment secrets, email API keys, D17 PINs, OTPs, or other credentials in HTML/JS or this handoff.

## Recent frontend changes already committed on staging
1. Mobile header: logo remains left, toolbar controls right in one row; SQUADS sits immediately before Friends. Latest CSS cache-buster is `vxsk-mobile-polish.css?v=1.2.1-mobile-toolbar`; service-worker cache is `vxsk-public-v12.8.39-owner-spotlight`. The user visually tested the preceding toolbar fix and confirmed it looked good.
2. Crew/leadership section: Voxzan owner spotlight was moved before “Meet the Crew”; the leadership card desktop width is capped (220–280px) instead of stretching. CSS cache-buster: `vxsk-p13-crew.css?v=13.0.2-owner-first`. Mobile card grid rules were retained.
3. Public contact email: the homepage, Merch footer and Privacy Notice were updated to `vxskevents@gmail.com`. These are ordinary `mailto:` links; they open the visitor's email app and do **not** send automated server notifications.
4. The current telephone contact display was not converted into a WhatsApp link. Do not publish a personal number as a WhatsApp business contact unless it is confirmed as a dedicated public VXSK line managed with appropriate adult/business oversight.
5. Header navigation was simplified: the public menu now has one **Teams** destination to `teams.html`; homepage Featured Teams remains a curated preview. Team Manager was removed from the homepage/Teams/team-profile public menus and a shortcut was added in the owner-only Staff Access view inside Staff Command. `team-manager.html` still checks Owner + MFA itself.
6. All of the above is staging-branch work only. Last verified `main` homepage SHA before this work was `4321c69bd23feb3af7d49a6be263678e51dc94b9`; verify again before any future promotion.

## What the current source tells us
This audit now includes a **user-supplied read-only Supabase schema export** (2026-11-03), in addition to source inspection. The repository root has no checked-in `supabase/` migrations/functions folder or SQL schema files. The export confirms the listed public tables, columns, RLS flags, policies, public RPC names/signatures, SECURITY DEFINER flags and triggers at export time. It does **not** include function bodies, EXECUTE grants, FK/unique/index/constraint definitions, storage policies/buckets, Edge Function deployments, auth settings or live records. Those still need verification.

### Authentication and roles
- Browser config contains a Supabase publishable key only. Keep the service-role key server-side.
- Staff access is based on `staff_roles` and role checks (owner/reviewer/staff), with MFA/AAL2 checks in the staff workflows.
- Owner authority is enforced by Supabase RPCs such as `vxsk_hub_owner`, not by frontend-only hiding.
- Staging guard code is present; keep staging pointed at its separate staging Supabase project.

### Implemented or partially implemented backend areas found in source
- **Applications:** `registrations`, `review_notes`; `review_registration` and `owner_delete_registration` RPCs. Staff UI caps the list at 200 and reports that older Netlify Forms do not auto-sync.
- **Tournament/Game Hub:** tables referenced include `vxsk_hub_events`, `vxsk_hub_matches`, `vxsk_hub_teams`, `vxsk_hub_match_players`, `vxsk_hub_team_members`, `vxsk_hub_notifications`, `vxsk_hub_badges`, `vxsk_hub_status`, and `match_center_posts`. The P12 staff UI uses `vxsk_p12_*` RPCs for public/staff snapshots, tournament creation, teams, stages, matches, announcements, publishing, reports and owner/referee checks. Group/Swiss standings are calculated from approved match scores in frontend code. This is not yet a cross-season global ranking system.
- **Arena Hub teams:** `arena-hub.js` calls `vxsk_hub_create_team`, `vxsk_hub_join_team`, `vxsk_hub_team_roster`, `vxsk_hub_team_decide`, `vxsk_hub_leave_team`, `vxsk_hub_ready`, `vxsk_hub_set_status`, and `vxsk_hub_report`.
- **Community/social:** uses RPC families including `vxsk_social_*`, `vxsk_showmatch_*`, `vxsk_group_*`, and `vxsk_hub_react`; some media is stored in the `vxsk-avatars` bucket. These features have staging-only/privacy limitations described in `privacy.html`.
- **Staff/crew profiles:** public crew uses `vxsk_p13_public_crew`; owner/staff management references `vxsk_p13_owner_ok`, `vxsk_p13_owner_crew`, `vxsk_p13_save_crew`, `vxsk_p13_set_crew_visibility`, and the `vxsk-crew-photos` bucket.
- **Teams directory / Featured Teams:** manager reads and writes `vxsk_directory_teams`; team logos use `vxsk-team-logos`. Public Featured Teams and the Teams directory both use the shared Teams Hub reader, so the duplication appears to be two frontend presentations of one source, not necessarily two databases. Recommended product direction: one canonical Teams directory with a three-team featured strip on the homepage, and a single “Teams” navigation destination.
- **Marketplace / boosters / coaches:** requests use `vxsk_market_*` and `vxsk_coaching_*` RPCs. Reviews and staff panels use RPCs such as `vxsk_market_review_list`, `vxsk_market_review`, `vxsk_market_owner_requests`, `vxsk_market_owner_request_status`, `vxsk_coaching_owner_applications`, `vxsk_coaching_owner_review`, `vxsk_coaching_owner_bookings`, `vxsk_coaching_owner_booking_status`, `vxsk_market_staff_reviews`, `vxsk_market_moderate_review`, and `vxsk_server_feedback_staff_list`. Booster photos use `vxsk-booster-photos`.
- **Merch/payments:** `merch.html` explicitly says “Requests only — no online payment is collected.” Marketplace requests explicitly report “No payment was made.” No payment checkout, verified payment webhook, payment reconciliation, or automated payment email function was found in the reviewed source.
- **Server feedback:** `vxsk_server_feedback_submit` / `vxsk_server_feedback_staff_list` are referenced. The frontend explicitly does not claim email delivery.
- **VXSK AI:** `vxsk-ai-pilot.js` labels the feature a private mock pilot and calls `vxsk_ai_mock_message`; the UI says “Supabase mock replies · No OpenAI billing.” The owner UI calls `vxsk_ai_owner_snapshot`, `vxsk_owner_staff_search`, and `vxsk_ai_owner_control`. No provider-backed AI Edge Function or server-side model integration was found. It is not production AI yet.
- **Owner Records/Delete Center:** the Records panel is deliberately read-only. `vxsk-owner-cleanup.js` has no delete/update operation; the rendered Delete controls are disabled as “BACKEND PENDING.” Existing separate delete flows exist in a few areas (for example, owner deletion of a registration, a content-editor post delete protected by RLS, and a group creator deleting a group). There is no single audited owner-wide delete backend in the reviewed source.
- **Team Manager navigation:** `team-manager.html` remains a separate owner+MFA page. The public homepage header, Teams directory, and team profile menus no longer link to it. The Manager shortcut is now inside the owner-only Staff Access view in Staff Command. The destination page still performs its own owner + MFA check.

### Important missing or unverified areas
1. Global player, team and staff rankings: no dedicated global leaderboard/season ranking backend was identified in the reviewed source. Tournament group/Swiss standings exist, and booster rank fields are self-reported; neither is a verified cross-site player/team/staff ranking.
2. VXSK Points: no points ledger, balance view, award rules, or redemption ledger was found. Required sources requested by the owner: verified merch purchases, applications, showmatch/tournament participation, coaching and booster activity. Design this as an auditable ledger, not a balance a browser can edit.
3. Payments: no real online payment is connected. D17 should not be implemented as a public personal-number transfer form. D17 consumer terms describe a personal wallet/app and require the user to keep the PIN confidential. For e-commerce, obtain the official merchant/e-commerce arrangement from La Poste Tunisienne or an authorized payment provider first; only then integrate server-created checkout sessions and verified signed webhooks. Never collect a D17 PIN, OTP, card details, or wallet credentials in VXSK forms.
4. Payment notifications: automated email after a verified payment requires a server-side webhook/Edge Function and an email delivery provider configured via server secrets. A `mailto:` link is only a visitor contact shortcut.
5. Owner delete center: define per-record deletion/archive rules, dependencies, backup/restore plan, audit log, MFA+Owner checks, and explicit confirmation. Prefer archive/soft-delete for teams, tournament history, and financial records; hard-delete only where legally/operationally appropriate.
6. Database schema: existing code references many tables/RPCs but those names and policies must be checked against the live staging project before writing migrations. A typo/mismatch in the current cleanup panel table names is also possible.
7. VXSK AI: add a server-side AI function only after the provider, budget cap, per-user quotas, rate limits, allowed use cases, moderation, logging and privacy notice are specified. Provider key must live in Supabase secrets, never in client JS.
8. Header/category icons: current homepage nav includes custom inline SVGs (not PNG logo assets). Replace only after preparing a consistent, properly licensed local icon pack; keep accessible alt/labels and optimize file sizes.
9. App promo: currently a static VXSK logo/wordmark and “PLAY. CONNECT. COMPETE.” copy; redesign/animate as a coherent motion treatment rather than an unrelated floating logo.
10. Contact: homepage/merch/privacy mail links now use `vxskevents@gmail.com`. The existing phone contact is unchanged; WhatsApp linking awaits confirmation that it is a dedicated public business line.

### Supabase schema evidence received on 2026-11-03
- Confirmed public tables include the main application, roles, registrations, notes, match-center posts, opponent requests, AI pilot (vxsk_ai_*), directory teams (vxsk_directory_teams), Game Hub, marketplace/coaching (vxsk_market_*), crew (vxsk_p13_crew), social/chat/calls, and audit tables.
- RLS is enabled on every table reported by the user. All showed FORCE ROW LEVEL SECURITY=false. This does not by itself prove a vulnerability: SECURITY DEFINER RPCs may intentionally be the only API for tables with no direct SELECT policy. Do not add broad table policies without reviewing RPC bodies and grants.
- The export listed no direct table policies for several market tables (for example vxsk_market_requests, vxsk_market_feedback, vxsk_market_booster_apps); the frontend should use their role-checked RPCs rather than direct table reads.
- Confirmed mock AI RPCs exist: vxsk_ai_mock_message, vxsk_ai_owner_snapshot, and vxsk_ai_owner_control; usage/membership/settings/audit tables also exist. The existence of these objects does not make the AI provider-backed.
- Confirmed tournament RPC family includes vxsk_p12_public_snapshot, vxsk_p12_staff_snapshot, create/add/publish/report/decide RPCs and owner/referee check functions. Tournament standings exist; a global player/team/staff ranking is still not evidenced.
- No points ledger table or RPC appears in the supplied export. No payment transaction/checkout/webhook tables or functions appear in the supplied export.
- Actual marketplace table names reported are vxsk_market_booster_apps, vxsk_market_requests, and vxsk_market_feedback, not the earlier names the Records UI attempted.
- Staging code correction applied: vxsk-owner-cleanup.js now reads booster applications via vxsk_market_review_list, marketplace requests via vxsk_market_owner_requests, and feedback via vxsk_server_feedback_staff_list; the Records dropdown no longer labels these as backend pending. This remains read-only; Delete controls stay disabled until destructive RPCs are audited and installed.
- Next DB audit must inspect SECURITY DEFINER function bodies and EXECUTE grants for role checks, AI mock, tournament score approvals, marketplace request/status, crew management, and Records sources. Also inspect table constraints/FKs/indexes and Storage policies before migrations.

### Critical RPC body and EXECUTE-grant review (user-supplied on 2026-11-03)
- The user supplied definitions, owners, SECURITY DEFINER flags, search_path settings and EXECUTE privileges for selected RPCs. All displayed selected functions are owned by `postgres` and are SECURITY DEFINER.
- The reviewed functions use either an empty search_path or `pg_catalog`. User tables/functions are generally schema-qualified in the supplied bodies. Continue checking every SECURITY DEFINER helper, not only the public wrapper.
- `vxsk_ai_owner_control`, `vxsk_ai_owner_snapshot`, and `vxsk_owner_staff_set` enforce a signed-in Owner with JWT AAL2. The staff-role setter protects the caller's own Owner account, refuses changes to another Owner, and writes `vxsk_staff_role_audit`.
- `vxsk_hub_owner` and `vxsk_hub_referee` require AAL2 plus Owner or Owner/Reviewer role respectively. `vxsk_hub_guard_result_write` is trigger-only in the reported ACL (no anon/authenticated EXECUTE) and prevents non-Owner publication/changes to match scores.
- `vxsk_ai_mock_message` requires authentication. It requires AAL2 only when `pilot_only` is enabled; it serializes per-user quota updates using a locked membership row and returns simulated replies only. It does not call an AI provider.
- `vxsk_market_owner_requests`, `vxsk_market_review_list`, `vxsk_server_feedback_staff_list`, and `vxsk_market_owner_request_status` delegate role enforcement to `vxsk_market_private.is_owner()` / `is_staff()`. Those helper definitions and their ACLs were not included, so Owner/Staff and MFA enforcement are **not yet verified**. The status function body does not itself write an audit row; inspect table triggers/audit mechanisms before relying on a full status-change audit trail.
- `vxsk_p13_save_crew` has `anon EXECUTE=true` and `authenticated EXECUTE=true`; its body calls `public.vxsk_p13_owner_ok()` before writing. The helper definition is still needed to confirm Owner+AAL2 enforcement. Once confirmed, remove anon EXECUTE unless there is a documented public use case.
- `vxsk_hub_editor` also has `anon EXECUTE=true`; it returns `public.can_edit_match_center()`. Inspect that helper to confirm anonymous callers only receive a safe false/true capability result and no sensitive data. If no public use case requires it, revoke anon EXECUTE.
- `vxsk_market_create_request` requires authentication, validates service/payment-method choices, caps daily requests, checks approved boosters, and inserts a request with a calculated displayed price. It is **not payment collection or payment verification**. Explicit NULL checks for `p_service` and `p_method` would make validation clearer because SQL `NOT IN` comparisons with NULL evaluate to NULL; inspect NOT NULL/check constraints as well.
- The two anon-executable functions are not proven exploitable from the supplied bodies alone because both delegate/return helper checks. Treat them as least-privilege hardening items pending helper review, not as confirmed vulnerabilities.
- Next helper review: fetch definitions and ACLs for `public.can_edit_match_center()`, `public.vxsk_p13_owner_ok()`, and `vxsk_market_private.is_owner()`, `vxsk_market_private.is_staff()`, and `vxsk_market_private.nickname(uuid)`. Also include `public.vxsk_p12_owner_ok()` if it protects tournament-management RPCs.

### Anonymous EXECUTE hardening applied (user-confirmed on 2026-11-03)
- User ran both REVOKE statements successfully:
  - `REVOKE EXECUTE ON FUNCTION public.vxsk_p13_owner_ok() FROM anon;`
  - `REVOKE EXECUTE ON FUNCTION public.vxsk_hub_editor() FROM anon;`
- These revoke only the explicit anon grants; authenticated access was not targeted. Still verify effective privileges with `has_function_privilege('anon', ...)` and `has_function_privilege('authenticated', ...)`, since effective permissions can also come through PUBLIC or role membership.
- No other database permissions or data were changed by these two statements.

### Helper-function review (user-supplied on 2026-11-03)
- `public.can_edit_match_center()` is SECURITY DEFINER, owned by postgres, empty search_path, and executable by authenticated only (not anon). It returns true only when `auth.uid()` exists, JWT AAL is `aal2`, and the user is an Owner or has a row in `match_center_editors`. This supports the `vxsk_hub_editor` wrapper; anon invocation returns false through the helper.
- `public.vxsk_p13_owner_ok()` is SECURITY DEFINER, postgres-owned, `search_path=pg_catalog`, and executable by anon and authenticated. It returns true only for a signed-in AAL2 Owner, delegated through `public.vxsk_hub_owner()`. The body gives no indication that anon can obtain an administrative true result (anon has no auth.uid()). Still revoke anon EXECUTE as least-privilege hardening if no anonymous frontend use is required; preserve authenticated EXECUTE if the owner UI calls it directly.
- `vxsk_market_private.is_owner()` and `is_staff()` are postgres-owned SECURITY DEFINER helpers, `search_path=pg_catalog`, with EXECUTE only for postgres. They enforce AAL2 and the expected Owner or Owner/Reviewer role. Marketplace wrappers are also postgres-owned SECURITY DEFINER functions, so nested helper calls execute as their owner; lack of direct authenticated EXECUTE on the private helpers is intentional and not a blocker.
- `vxsk_market_private.nickname(uuid)` is likewise postgres-only. It reads a capped nickname/display name from `auth.users.raw_user_meta_data`; the reviewed marketplace list RPCs call it after their role checks. No direct anon/authenticated EXECUTE is granted.
- No row for `public.vxsk_p12_owner_ok()` appeared in the user's returned query output. This is unverified/possibly absent, despite earlier source references to P12 owner checks; verify the actual P12 RPC authorization helpers before relying on the frontend name.
- Current helper review does not show a confirmed authorization bypass. Recommended hardening: `REVOKE EXECUTE ON FUNCTION public.vxsk_p13_owner_ok() FROM anon;` and `REVOKE EXECUTE ON FUNCTION public.vxsk_hub_editor() FROM anon;` after confirming there is no deliberate anonymous client call. Authenticated permissions remain unchanged by these statements.
- Next review should inspect all P12 mutation/decision/publish RPC definitions and the actual owner/referee helper(s), including function ACLs, then inspect table constraints/FKs/indexes and Storage bucket policies. No database changes have been made as part of this review.

### Follow-up ACL verification and P12 source reconciliation (user-supplied / source-checked 2026-11-03)
- User re-ran the effective EXECUTE check after hardening. Confirmed:
  - `public.vxsk_hub_editor()`: anon=false, authenticated=true.
  - `public.vxsk_p13_owner_ok()`: anon=false, authenticated=true.
  These results verify the intended ACL state for the two functions.
- Inspected staging frontend `vxsk-p12-game-hub.js`. Its RPC calls are:
  - `vxsk_p12_public_snapshot`
  - `vxsk_p12_staff_snapshot`
  - `vxsk_p12_owner_ok`
  - `vxsk_p12_referee_ok`
  - `vxsk_p12_decide_report`
  - `vxsk_p12_create_tournament`
  - `vxsk_p12_add_team`
  - `vxsk_p12_add_stage`
  - `vxsk_p12_add_match`
  - `vxsk_p12_announce`
  - `vxsk_p12_publish`
  - `vxsk_p12_mark_match_live`
  - `vxsk_p12_submit_report`
- The user's latest query output contained only the two ACL-verified helper functions and no P12 RPCs. This is a discrepancy to resolve before assessing tournament security. Possibilities include a different Supabase project, a schema other than `public`, absent P12 functions/migration, or an incomplete result excerpt.
- The staging browser config references Supabase project ref `opzqnmahfgehaewgciwg` (URL host `opzqnmahfgehaewgciwg.supabase.co`). Confirm the SQL Editor is connected to that exact project before running the next inventory. Do not share the publishable key or any secret.
- Next query should LEFT JOIN an explicit expected-name list against `pg_proc` across all schemas, returning one row per expected RPC even when absent, plus signature, owner, SECURITY DEFINER, search_path, effective anon/authenticated EXECUTE, and function definition for existing matches. Then inspect all P12 mutation and report-decision bodies before changes.
- No P12 database changes have been made.

### P12 RPC inventory result (user-supplied on 2026-11-03)
- User ran a LEFT JOIN inventory for all 13 exact RPC names used by `vxsk-p12-game-hub.js`, searching all schemas. Every row returned NULL for schema, signature, security_definer, owner, settings, EXECUTE flags and definition. This means none of those exact function names exists in the database queried; this is not an EXECUTE-grant issue.
- Expected names checked: `vxsk_p12_public_snapshot`, `vxsk_p12_staff_snapshot`, `vxsk_p12_owner_ok`, `vxsk_p12_referee_ok`, `vxsk_p12_decide_report`, `vxsk_p12_create_tournament`, `vxsk_p12_add_team`, `vxsk_p12_add_stage`, `vxsk_p12_add_match`, `vxsk_p12_announce`, `vxsk_p12_publish`, `vxsk_p12_mark_match_live`, and `vxsk_p12_submit_report`.
- The current staging frontend config points at Supabase project ref `opzqnmahfgehaewgciwg`. The returned absence conflicts with an earlier user-supplied schema summary that reported a P12 RPC family. Likely explanations include that the previous export came from a different Supabase project, the current Dashboard SQL Editor is connected to another project, or the P12 migrations were not applied to this project.
- Treat P12 backend as unavailable in the database just queried until project identity is confirmed and the inventory is repeated. Do not create replacement functions or migrations until reconciling project identity and reviewing the actual table schema, policies, constraints, and migration history.
- Next safe step: user should compare the Project Ref shown in the Supabase Dashboard's project settings / project URL with `opzqnmahfgehaewgciwg` from staging config. If they match, run an inventory for similarly named routines (for example `p12`, `tournament`) and inspect migration history before considering applying the missing migration. No database changes have been made for P12.

### Supabase project identity confirmed (user-confirmed on 2026-11-03)
- User confirmed the Dashboard Project Reference ID is exactly `opzqnmahfgehaewgciwg`, matching the Supabase URL configured in staging.
- Therefore the absence of all 13 `vxsk_p12_*` RPCs is not explained by accidentally querying a different project. The older schema summary reporting P12 RPCs conflicts with the latest live inventory.
- Working hypotheses: P12 migration was not applied to this project, P12 routines were renamed/dropped, or the earlier schema export was taken before a schema change. Search current routines/tables and inspect migration history before deciding.
- Do not create replacement RPCs yet; first establish the actual current tournament tables and available similarly named routines. No P12 database changes have been made.

### Current tournament object inventory (user-supplied on 2026-11-03)
- After confirming the Dashboard Project Ref matches staging, user searched all non-system schemas for routines/tables named like `p12` or `tournament`, plus `vxsk_hub_*` tables.
- Result contained 11 public base tables and no matching P12/tournament-named routines:
  `vxsk_hub_badges`, `vxsk_hub_events`, `vxsk_hub_match_players`, `vxsk_hub_match_reports`, `vxsk_hub_matches`, `vxsk_hub_notifications`, `vxsk_hub_reactions`, `vxsk_hub_reports`, `vxsk_hub_status`, `vxsk_hub_team_members`, `vxsk_hub_teams`.
- This confirms the current database has Game Hub tables but the staging P12 page's 13 exact `vxsk_p12_*` RPC calls are absent. It does not prove that every tournament-related RPC is absent: similarly named `vxsk_hub_*` functions may exist, and the previous query only found P12/tournament substrings.
- Existing earlier export reported `vxsk_hub_owner()`, `vxsk_hub_referee()`, `vxsk_hub_editor()` and trigger `vxsk_hub_guard_result_write()`; at least some helper/trigger logic is separate from the missing P12 API.
- Next safe audit: inspect columns, types, primary/foreign/unique/check constraints, indexes, RLS policies and effective table grants for the 11 `vxsk_hub_*` tables; separately inventory function names/signatures beginning `vxsk_hub_`. Do not create P12 replacements until the existing table model and any existing Hub RPCs are understood.

### Existing Game Hub table/RLS inventory review (user-supplied on 2026-11-03)
- User supplied a full table/column/constraint/policy/effective-privilege inventory for the 11 `public.vxsk_hub_*` base tables. All reported tables have RLS enabled and FORCE=false.
- Current schema is not directly compatible with the P12 frontend data model:
  - Existing events table is `vxsk_hub_events` with `title`, `game`, `starts_at`, `details`, `published`, `prize`, `cover_path`; it has no P12 fields such as `mode` or a tournament `status` in the supplied column list.
  - Existing matches table is `vxsk_hub_matches`, with text `side_a` and `side_b`, plus `round_name`, `bracket_slot`, scores and event_id. P12 frontend expects `team_a` and `team_b` IDs, `stage_id`, `round_no`, `slot`, `bracket`, `group_name`, and state/score fields.
  - Existing tables contain no stage table in the 11-table inventory. P12 frontend expects a `stages` collection with format/order and stage IDs.
  - Existing `vxsk_hub_match_reports` has `referee_id`, `proposed_score_a/b`, `notes`, and `state`; P12 frontend expects report fields like `submitted_by`, `kind`, `score_a/b`, and a P12-specific decision RPC.
  This is a data-model/API mismatch, not merely missing EXECUTE grants.
- Existing data access posture, from supplied effective privileges and policies:
  - Published events, published matches, and published teams are publicly readable through RLS; editors/captains can read their unpublished rows according to the policies.
  - Most other Game Hub tables shown are read-only through direct client table access (effective authenticated SELECT true, INSERT/UPDATE/DELETE false). Their management likely depends on RPCs, to be verified from the separate `vxsk_hub_*` function inventory.
  - `vxsk_hub_notifications` is directly updatable by authenticated users, but its RLS policy limits updates to rows where `user_id=auth.uid()`. If users only need to mark `seen`, consider narrowing column-level UPDATE grants to `seen` after checking all frontend uses; current row policy alone allows changes to other columns on one's own notification row.
  - Event and match RLS policies allow editor INSERT/UPDATE, but effective direct table privileges reported for authenticated users are false. This is consistent with RPC-mediated writes and should not be “fixed” by broad table grants without inspecting existing RPCs.
  - `vxsk_hub_match_reports` is referee-readable under RLS; direct INSERT/UPDATE/DELETE are not granted in the reported effective privileges. Review existing RPCs for report submission and approval.
- The `vxsk_hub_guard_result_write` trigger (from previous schema export) guards score/state publication and requires Owner for publishing/changing results. Preserve this control when designing any P12 compatibility layer; referee report submission should not bypass Owner approval.
- Next required evidence is the separate function inventory query output for every `public.vxsk_hub_*` and `public.vxsk_p12_*` routine, including bodies and effective EXECUTE grants. Do not create new tables/functions or alter current policies until that inventory and the existing client call sites have been mapped.

### Existing `vxsk_hub_*` RPC security review and frontend mapping (user-supplied definitions + source inspection, 2026-11-03)
- User supplied definitions for all 16 ordinary `vxsk_hub_*` RPCs plus the result-write trigger; all are postgres-owned SECURITY DEFINER with empty search_path. Ordinary functions in the supplied set have authenticated EXECUTE but not anon, except `vxsk_hub_team_roster(uuid)`, which also has anon EXECUTE. The trigger function has no anon/authenticated EXECUTE.
- Authorization patterns:
  - `vxsk_hub_owner()`: signed-in AAL2 user with `staff_roles.role='owner'`.
  - `vxsk_hub_referee()`: signed-in AAL2 user with role owner or reviewer.
  - `vxsk_hub_editor()`: delegates to `can_edit_match_center()`, which requires AAL2 and Owner or membership in `match_center_editors`.
  - `vxsk_hub_owner_decide_report`, `vxsk_hub_award_badge`, and `vxsk_hub_owner_assign_player` require the Owner helper before privileged writes.
  - `vxsk_hub_referee_report` requires Referee helper, published match, score bounds 0-99, notes <=700 and a per-referee 10/hour cap; it inserts a pending report.
  - `vxsk_hub_owner_decide_report` locks a pending report row, sets approved/rejected, and on approval updates match score/state; the result-write trigger independently requires Owner for score/completed-state changes.
  - Team RPCs require authentication and enforce captain/team ownership; join is rate-limited and team-size capped; team decision is captain-only; ready check-in only updates the signed-in assigned player on a published scheduled match.
  - Other functions validate categories/emoji/status and apply per-user limits where shown.
- Public roster nuance: `vxsk_hub_team_roster(uuid)` is the only ordinary RPC in the supplied set with anon EXECUTE. It returns a roster only for a published team and includes only accepted members; visible nickname is returned only when the social profile is `discoverable`, otherwise it returns `Private player`. This appears intentionally public-facing. Keep anon EXECUTE only if the public team roster UI is intended; otherwise revoke it.
- Minor hardening/quality observations, not confirmed critical vulnerabilities:
  - `vxsk_hub_award_badge` emits a notification even when the badge insert hits `ON CONFLICT DO NOTHING`; repeated award calls can create duplicate notifications. Consider checking whether INSERT inserted a row before creating the notification.
  - `vxsk_hub_owner_assign_player` similarly sends a notification even when the assignment row was already present due to `ON CONFLICT DO NOTHING`.
  - `vxsk_hub_create_team` caps a user's teams at 3 with a COUNT before INSERT; concurrent calls can race past the cap unless serialized or backed by a suitable constraint/lock.
  - `vxsk_hub_team_roster` public access is controlled by its published-team gate and discoverability, but confirm product intent before changing grants.
  - `vxsk_hub_notifications` direct UPDATE is row-limited to the recipient; client currently updates only `seen=true`. Consider column-level UPDATE grant limited to `seen` after verifying no other client use.
- Source mapping checked on staging:
  - `arena-hub.js` uses existing `vxsk_hub_*` RPCs: join_team, team_roster, team_decide, leave_team, ready, create_team, set_status, report; it reads events/matches/teams and personal rows directly under RLS. It marks own notifications read with a direct UPDATE of `seen`.
  - `vxsk-p12-game-hub.js` is a separate, newer tournament control frontend and exclusively calls the missing `vxsk_p12_*` RPC family listed above.
  - The older `vxsk_hub_*` backend is therefore not equivalent to the P12 backend; it covers teams, event/match display, player check-in, referee score reports and Owner approval, but lacks the P12 stages/brackets/group/Swiss/match-team-ID data model.
- Recommended architectural choice before implementation: decide explicitly whether to (A) extend the existing Game Hub schema with stages and team-linked matches while preserving its working arena/team/community functionality, or (B) add a separately versioned P12 tournament schema and compatibility RPCs. Avoid creating 13 wrappers that pretend the old tables have P12 fields. Any new writes must preserve Owner-only result publication and the existing AAL2 Referee/Owner checks.

### P12 architecture decision recommendation and final Hub RPC observations (2026-11-03)
- Based on the live schema and source mismatch, recommended safe path is to add a separately versioned `vxsk_p12_*` tournament data model and RPC layer, rather than alter legacy `vxsk_hub_events` / `vxsk_hub_matches` in-place or pretend the legacy schema already matches P12. Keep Arena Hub team/community flows operational. P12 tournament entrants can be separate per-tournament records; an optional link to an existing `vxsk_hub_teams.id` can be designed later if team reuse is required.
- Suggested new P12 entities to design (not yet created): tournaments, tournament entrants/teams, stages, matches, updates/announcements, and referee reports/decisions. Include foreign keys, constraints, indexes, RLS, audit events, and idempotency where applicable. Map exactly to frontend fields or revise frontend and RPC contract together.
- Existing Hub RPC review additions:
  - `vxsk_hub_referee_report` checks referee AAL2, published match, score bounds, notes length and hourly rate cap, but as supplied it does not reject a match already completed or prevent multiple pending reports for the same match. Consider a unique partial constraint for one pending report per match (or explicit row-lock/state validation) and prevent approval of stale reports after a match is completed, unless correction workflow is explicitly intended.
  - `vxsk_hub_owner_decide_report` approves/rejects a pending report by ID and on approval updates match score/state. The result guard adds Owner verification, but a future workflow should validate the report is still current and the match remains eligible for approval.
  - `vxsk_hub_award_badge` and `vxsk_hub_owner_assign_player` can generate duplicate notifications when their INSERT hits `ON CONFLICT DO NOTHING`; notify only when the insert actually creates a row.
  - `vxsk_hub_create_team` has a concurrent-count race for the maximum-three-team limit; serialize per-user creation or enforce a robust database-level rule.
  - `vxsk_hub_notifications` frontend only updates `seen=true`; current row policy confines updates to the user's own rows but broad table UPDATE allows changing other columns on one's own notification. Consider column-level UPDATE permission for `seen` only.
- Next read-only audit before writing any migration: inventory indexes on all 11 `vxsk_hub_*` tables, non-internal triggers and trigger function bodies, and migration history. Then design a P12 migration under version control and apply only to staging after explicit review. Do not touch production `main` or legacy Hub schema until backward-compatibility testing is complete.

### Legacy Game Hub index inventory review (user-supplied on 2026-11-03)
- Existing useful indexes confirmed:
  - Event feed: `vxsk_hub_events(published, starts_at)`.
  - Public match board: `vxsk_hub_matches(published, game, starts_at)`.
  - Public team directory: `vxsk_hub_teams(published, game)`.
  - Notifications inbox: `vxsk_hub_notifications(user_id, created_at DESC)`.
  - Referee report queue: `vxsk_hub_match_reports(state, created_at DESC)`.
  - Abuse/report history: `vxsk_hub_reports(reporter_id, created_at DESC)`.
  - PK/unique indexes cover primary identifiers and team/player membership uniqueness.
- Candidate missing indexes based on known query patterns (not yet approved or created):
  - `vxsk_hub_match_players(user_id, match_id)`: Arena Hub loads match-player assignments by `user_id`; current PK begins with `match_id` and does not efficiently support reverse lookup by user.
  - `vxsk_hub_match_reports(referee_id, created_at DESC)`: `vxsk_hub_referee_report` rate-limits by referee and recent created_at; current state/created index does not cover referee_id.
  - `vxsk_hub_team_members(user_id, requested_at DESC)`: join-team rate limit counts a user's requests in the last hour; current PK begins with team_id.
  - `vxsk_hub_teams(captain_id)`: create-team cap counts teams by captain_id; no captain index is in the supplied inventory.
  - Consider `vxsk_hub_matches(event_id)` only if measured queries filter by event_id; do not add without confirming workload/query plan.
- These are performance candidates, not security issues. Before adding, inspect approximate table sizes and EXPLAIN plans; use `CREATE INDEX CONCURRENTLY` where appropriate outside a transaction, after confirming operational impact. Do not add redundant indexes or make live schema changes before migration review.
- Trigger inventory output has not yet been received. Need inspect all non-internal triggers and bodies before finalizing P12 or proposing changes to existing match-result controls.

### Legacy Game Hub trigger inventory review (user-supplied on 2026-11-03)
- User supplied the complete non-internal trigger inventory for `public.vxsk_hub_%` tables. Exactly one trigger was returned: `vxsk_hub_result_guard`, BEFORE INSERT OR UPDATE on `public.vxsk_hub_matches`, calling `public.vxsk_hub_guard_result_write()`.
- Guard behavior confirmed:
  - On INSERT, rejects a non-Owner inserting a match already marked `completed` or with either score non-NULL.
  - On UPDATE, rejects a non-Owner changing either score or transitioning state into `completed`.
  - The Owner check delegates to `public.vxsk_hub_owner()`, which requires signed-in Owner and JWT AAL2.
- Important scope limitation: the trigger is specifically a score/result-publication guard, not a complete state-transition or publication guard. As written, it does not reject non-Owner changes such as `completed -> cancelled` when scores stay the same, nor does it guard changes to `published`. Current effective direct table privileges for authenticated users showed INSERT/UPDATE false, and the supplied existing RPCs do not expose these arbitrary match updates, so this is not a confirmed exploitable path in the current access model. New P12 RPCs must validate every permitted state transition server-side and retain Owner+AAL2 result approval.
- Combined legacy Game Hub audit now covers table columns/constraints/RLS/effective privileges, indexes, RPC bodies/ACLs, and the single trigger. Candidate performance indexes remain uncreated pending workload/query-plan review.
- Next pre-migration check: inspect `supabase_migrations.schema_migrations` presence and version/name history to establish whether any P12 migration file/version previously ran. Then design an isolated P12 schema and RPC contract, review the complete SQL in version control, and apply to staging only after confirmation. No DB migration has been written or applied.

### Migration metadata inventory result (user-supplied on 2026-11-03)
- User queried non-system information_schema columns with names matching `%migration%`. Returned:
  - `auth.schema_migrations(version)`
  - `realtime.schema_migrations(version, inserted_at)`
  - `storage.migrations(id, name, hash, executed_at)`
- These are subsystem-managed migration records for Supabase Auth, Realtime, and Storage; they are not by themselves the application's Supabase CLI migration history and do not establish whether P12 SQL was applied.
- No `supabase_migrations.schema_migrations` appeared in the user's result. This may mean the CLI migration-history schema/table is absent, or is not visible through the current metadata query/permissions. Do not treat absence from this metadata query as conclusive proof that migrations never ran.
- Next safe check: query pg_namespace/pg_class for the `supabase_migrations` schema and its relations, check whether current role can SELECT the history table, and if present read only migration `version` and `name` metadata. Do not inspect auth/realtime/storage migration rows for P12 application history. If no CLI history table exists, rely on the repository's migration files / deployment records and schema object inventory; do not infer migration history from subsystem tables.
- No database changes have been made.

### Post-ROLLBACK object absence check (user-supplied on 2026-11-03)
- User subsequently ran the expected-object verification query after the successful rollback dry-run.
- All 7 expected P12 tables returned `exists=false`: `vxsk_p12_tournaments`, `vxsk_p12_teams`, `vxsk_p12_stages`, `vxsk_p12_matches`, `vxsk_p12_updates`, `vxsk_p12_reports`, `vxsk_p12_audit`.
- All 13 expected P12 RPCs returned `exists=false`: `vxsk_p12_public_snapshot`, `vxsk_p12_staff_snapshot`, `vxsk_p12_owner_ok`, `vxsk_p12_referee_ok`, `vxsk_p12_create_tournament`, `vxsk_p12_add_team`, `vxsk_p12_add_stage`, `vxsk_p12_add_match`, `vxsk_p12_announce`, `vxsk_p12_publish`, `vxsk_p12_mark_match_live`, `vxsk_p12_submit_report`, `vxsk_p12_decide_report`.
- This is the expected post-rollback state and confirms the draft objects were not persisted. Do not rerun with `COMMIT` until the SQL has passed final review and the user explicitly authorizes a real staging deployment.

### P12 draft third-pass review — publication/status and report concurrency (2026-11-03)
- Updated `supabase/migrations/20261103000100_vxsk_p12_core.sql` after second-pass review:
  - Staff snapshot restricts unpublished drafts and all related child collections to Owner; Referee/Reviewer sees only published tournaments and their entrants, stages, matches and updates.
  - Report submission locks the published tournament row and rejects reports on unpublished tournaments.
  - Score reports are accepted only while tournament status is announced/upcoming/live; completed/cancelled tournaments cannot receive new score reports.
  - Owner score approval checks the tournament remains announced/upcoming/live before applying the score.
  - Added a non-unique partial index on pending score reports by match; the match row lock plus explicit pending-report check serializes submissions. Removed the partial UNIQUE pending-report index to avoid an index-conflict wait interacting with Owner approval's report/match lock order.
- These changes happened after the previous rollback dry-run. The latest draft must be re-tested with a fresh copy ending in `ROLLBACK;`; the earlier success does not validate this changed file.
- No Supabase changes have been applied. The user supplied the expected post-rollback inventory showing all 7 tables and 13 RPCs absent; this remains the intended database state until explicit deployment approval.

### P12 draft second-pass security review (2026-11-03 — changes NOT yet dry-run)
- The migration draft was further reviewed for confidentiality and concurrency:
  - `vxsk_p12_staff_snapshot()` now returns unpublished tournament drafts and associated entrants/stages/matches/updates only to Owner; Referees/Reviewers see published tournament data only.
  - Sensitive report details (including incident notes) remain Owner-only in the snapshot; the “OWNER REVIEW QUEUE” UI was already switched to `data-p12-owner`.
  - `vxsk_p12_submit_report()` now locks the published tournament row, permits reports only against published tournaments, and accepts score reports only while tournament status is announced/upcoming/live. It locks the match and rejects a second pending score report for that match.
  - The former partial UNIQUE index on one pending score report per match was replaced with a non-unique partial lookup index. The match-row lock plus pending-report check serializes submissions without the unique-index wait interacting badly with Owner approval's report/match locking.
  - `vxsk_p12_decide_report()` now checks the tournament is still announced/upcoming/live before approving a score; terminal tournaments cannot receive a late score approval.
- These edits changed the migration after the user's earlier successful ROLLBACK dry-run. Therefore the latest file version has **not** yet passed a dry-run. User must repeat the full-copy SQL Editor test with final `COMMIT;` changed to `ROLLBACK;` before any application decision.
- Verified latest source file contains Owner-only queue UI and the snapshot visibility/status guards. No Supabase SQL was applied. Production `main` and Cloudflare remain untouched.

### P12 rollback dry-run result (user-confirmed on 2026-11-03)
- User copied the complete draft migration into the Supabase SQL Editor, replaced the final `COMMIT;` with `ROLLBACK;`, and executed it. Supabase reported success with no result rows and no error.
- This is consistent with the DDL and function definitions executing successfully inside the transaction and then being rolled back. It is a useful syntax/DDL acceptance check, not a runtime authorization test and not proof that objects remain installed.
- Next check before any real application: verify all seven `public.vxsk_p12_*` tables and all 13 expected P12 RPCs are absent after rollback. Then perform final SQL review; only after review should the user explicitly authorize applying the unchanged (or reviewed amended) migration to staging.
- Do not instruct the user to run the migration with COMMIT until they explicitly approve the real staging deployment. The production `main` branch and Cloudflare Worker remain unchanged.

### P12 draft review — Owner-only report queue hardening (2026-11-03)
- Cross-checked the draft RPC contracts against the actual P12 frontend forms in `staff.html` and `vxsk-p12-game-hub.js`; function names, argument names and expected snapshot collection keys align.
- Found that the first draft returned all report notes (including incident reports) to every Referee/Reviewer through `vxsk_p12_staff_snapshot()`, even though the HTML section is titled “OWNER REVIEW QUEUE”. This exceeded the intended least-privilege audience.
- Corrected the draft migration: `vxsk_p12_staff_snapshot()` now initializes reports as an empty JSON array and fetches them only when `public.vxsk_hub_owner()` confirms Owner + AAL2.
- Corrected staging `staff.html`: the “OWNER REVIEW QUEUE” section now has `data-p12-owner` instead of `data-p12-referee`, matching the existing client visibility logic. Referees/Reviewers retain report submission access but do not receive or see the sensitive decision queue.
- Re-fetched and verified the migration file and HTML after updates. Migration remains a review-only draft and has not been applied to Supabase. No legacy table or production branch was changed.
- Next validation should be a non-persistent transaction dry-run in the exact staging project: execute a copy of the migration with its final `COMMIT;` replaced by `ROLLBACK;`, after verifying the editor is connected to project ref `opzqnmahfgehaewgciwg`. This checks DDL/function-definition acceptance without retaining the created objects. It does not test runtime authorization or RPC behavior. If the dry-run succeeds, capture the result and review any errors before a separate explicit approval to apply the unchanged migration.

### P12 migration draft created on staging (2026-11-03 — NOT APPLIED)
- Supabase migration-history metadata check returned only Auth, Realtime and Storage subsystem histories. A follow-up lookup found no `supabase_migrations` schema or `schema_migrations` relation. This does not prove that no SQL changes were ever applied manually; it means no application migration history is currently available through the expected Supabase CLI tracking schema.
- Inspected the full P12 staff form and public Arena section. Exact contract includes tournament create, entrant/team create, stage create, fixture create, owner announcements/status, tournament publish/unpublish, match live toggle, referee reports of kind score/update/incident, and Owner report decision. Public status filter uses announced/upcoming/live/completed; tournament status schema also supports cancelled.
- Important UI/data nuances preserved in the draft: entrants are named teams/players; score reports require match + two bounded scores; general updates/incidents can omit match and cannot carry scores; incident content remains private in the report queue and is not copied to the public update feed; only Owner may publish an approved score, and an Owner may not decide their own report.
- Created review-only SQL draft at `supabase/migrations/20261103000100_vxsk_p12_core.sql` on `staging/vxsk-cloudflare-preview`.
- Draft proposes seven isolated tables (`vxsk_p12_tournaments`, `vxsk_p12_teams`, `vxsk_p12_stages`, `vxsk_p12_matches`, `vxsk_p12_updates`, `vxsk_p12_reports`, `vxsk_p12_audit`), RLS enabled with no direct client table grants, indexes/constraints, a P12 score guard trigger, 13 RPCs matching the current frontend names and argument contracts, AAL2 helper reuse, and explicit function EXECUTE grants.
- The draft intentionally does not alter any legacy `vxsk_hub_*` table, policy, trigger or RPC. It starts a versioned migration file in Git, but no SQL has been run in Supabase, and the missing CLI history schema has not been created manually.
- This is a first review draft, not yet validated against a live PostgreSQL parser or a disposable staging database. Before any application: review for correctness, verify Supabase SQL Editor role/ownership behavior, run a syntax check in a disposable database or equivalent test environment, then review the post-apply grant/RLS checks and exercise anon, ordinary authenticated, Referee AAL2 and Owner AAL2 cases. The user must explicitly approve applying it to the staging project.
- Draft link: `https://github.com/vxskofficial/vxskofficial.github.io/blob/staging/vxsk-cloudflare-preview/supabase/migrations/20261103000100_vxsk_p12_core.sql`.

## Recommended implementation order
### Phase 0 — database truth (must happen before DDL)
- Obtain a **schema-only** export from the staging Supabase project: tables/columns/constraints, views, functions/RPC signatures, triggers, RLS policies, grants, storage buckets/policies and enabled extensions. Do not export user records, passwords, auth tokens, payment data or secrets.
- Confirm the staging project identifier matches `supabase-config.js` without publishing its keys.
- Compare all referenced frontend RPC/table names against that export; identify missing/duplicate/outdated objects.
- Add a versioned `supabase/migrations/` directory to this repo, with each migration reviewed and applied to staging first.

### Phase 1 — verified identity, results and ranking
- Define canonical player/team/staff profile entities and their public/private fields.
- Define approved match result and tournament participation sources.
- Create verified player/team leaderboards from approved results; staff contribution board should use audited work/recognition criteria, not arbitrary popularity.
- Add ranking snapshots or views with tie-break rules, season filters and transparent rules.

### Phase 2 — VXSK Points ledger
- Design `vxsk_points_ledger` with immutable entries, source type/id, unique idempotency key, user/team recipient, amount, status, actor, timestamp and reversal link.
- Awards must be triggered server-side only after a verified event: paid order webhook, accepted/approved application (not every duplicate submission), completed/approved showmatch or tournament, or completed/approved coaching/booster service.
- Add point caps, duplicate prevention, refunds/reversals, abuse review and an owner audit history.
- Keep VXSK Points separate from cash and never imply they are withdrawable money unless a properly reviewed rewards programme says so.

### Phase 3 — payments and notifications
- Adult/legal business operator obtains merchant onboarding and credentials.
- Implement server-created hosted checkout, webhook signature verification, transaction idempotency, payment status transitions, refunds/reconciliation and owner reports.
- Send payment confirmation to buyer and an owner notification to `vxskevents@gmail.com` from a server-side email provider. Do not send notifications from browser-only code.

### Phase 4 — owner command center
- Move Team Manager entry into the owner-only Staff Command area; remove the public Team Manager header/menu links.
- Build an audited Records centre with per-section list, archive/delete, retention and dependency-aware confirmations. Do not enable a generic delete until each section's backend function is implemented and tested.
- Add owner-only reports for applications, orders, points ledger, rankings, matches, feedback, crew and team changes.

### Phase 5 — AI and presentation
- Replace mock AI RPC with provider-backed server function, quotas and owner-configurable pilot controls.
- Consolidate homepage Featured Teams + Teams directory around the one canonical team source.
- Replace decorative header SVGs with licensed/local PNG or SVG brand icons; revise the app promo animation and test desktop/mobile performance.
- Confirm the official public WhatsApp contact line before adding a WhatsApp deep link.

## Next-session starter
Start by inspecting the function bodies and EXECUTE grants for the critical RPCs using the schema export already supplied. Then inspect constraints, indexes, Storage policies and Edge Function list. Only after that create versioned SQL migrations on `staging/vxsk-cloudflare-preview`, apply and test on the staging Supabase project, and update this handoff after each substantial chat. Never touch `main` without explicit approval.
