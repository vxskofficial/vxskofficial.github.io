# VXSK — Tournament MVP acceptance contract (staging first)

**Source review:** `VXSK_BACKEND_HANDOFF.md` (2026-11-03), local P12 migration SQL, `vxsk-p12-game-hub.js`, `vxsk-registration-ui.js`, V6/V7 frontend patches.

## Player path
1. Visit `arena.html#vxsk-registration` and browse published tournaments.
2. Choose tournament, read rules, press Join. Authentication required.
3. Supabase accepts at most one active entry per tournament per user, honors caps/deadlines, and stores per-user/team status. Invitations require invitee acceptance.
4. Approved participants become authoritative entries in tournament roster. Rejected/waitlisted participants must never be inserted into an official bracket.
5. Once roster is frozen, Owner presses **Generate Bracket**; backend automatically seeds a single-elimination bracket (2–64 participants, BYEs handled correctly). No manual participant copy/paste or slot assignment in the final workflow.
6. Player sees bracket, legitimate score updates, progression and champion only after official final.

## Staff path
- `owner`: approve/reject registrations; set start/end; publish/unpublish; generate bracket from frozen **approved** entries; directly confirm official scores; approve reviewer submissions; assign roles; must pass MFA AAL2.
- `reviewer` (referee): see authorized matches, submit proposed score. Owner confirms before winner advances in first release. No owner-only score publication or staff access changes. Must pass MFA AAL2.
- Public crew titles (such as "referee") must not auto-grant Supabase staff roles.

## Dates / lifecycle (server time)
`draft -> registration_open -> registration_closed -> ready -> live -> ended_pending_results -> completed` (or cancelled). Maintain immutable audit events. Use timestamptz UTC in DB; render Africa/Tunis in UI. Server cron transitions at start/end; end time must stop LIVE independently of client/browser. Pending scores do not fabricate a champion. Cron must be idempotent, monitored, and retries safe. Green breathing LIVE badge only while authoritative state is live; respect reduced-motion setting.

## Verified gaps in reviewed source (not yet implemented)
- P12 core installed on staging according to prior user-supplied verification, but not live-tested here.
- P12 simple auto-bracket SQL extension remains a **draft**, not installed.
- Registration V3 migrations dry-run checked but not installed; frontend fails closed until RPCs exist.
- A secure server-side bridge converting approved V3 entries to bracket participants is needed. Current simple generator accepts manually typed names, not accepted entry IDs.
- Core tournament table has `starts_at` but no `ends_at` and does not implement the proposed lifecycle. Need migration and scheduled jobs, with permission auditing before rollout.
- Live cloud preview HTML retrieved on 2026-11-04 still showed old homepage content; the URL may be cached/stale. Publishing local files to Cloudflare is separate.

## Required staging test matrix
- Auth: signup/signin/reset and Turnstile valid/invalid/expired; Google/Discord OAuth separately.
- Roles: anon, player, reviewer without MFA, reviewer with MFA, Owner with MFA.
- Entries: concurrent joins, duplicate joins, closed deadline, max participants, team invites acceptance, rank proof private storage.
- Brackets: sizes 2/3/5/8/16/64, BYEs, no double advancement on duplicate score updates, final champion only after approved score, rollback on error.
- Time: UTC -> Africa/Tunis, before/at/after start/end, missing scores after end.
- Deploy/ops: staging Worker actual URL, CSP, accessibility, Cloudflare WAF logs, Supabase RPC grants, backup restore, user deletion and privacy.

**Do not deploy this workflow to production until all pass.**
