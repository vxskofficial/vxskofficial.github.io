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
