# VXSK V20 — Cloudflare TEST release notes

Release date: 2026-11-06. Deploy only to the VXSK Cloudflare TEST site; do not merge into VXSK OFFICIAL.

## What's new

- **Owner Record Management** restored in Staff Command. Supports ten categories. V19 archive/hide for tournaments, legacy fixtures and showmatch posts; V20 irreversible removal from the active queue for eligible rejected/closed applications, challenges, marketplace orders, booster applications, feedback, opponent requests, and rejected referee reports. Every removal requires Owner+MFA, an 8–300-character reason and typing DELETE. A restricted database audit snapshot remains; no destructive deletion of approved or live match results.
- **Showmatch Requests** replaced the confusing generic Staff Applications label; existing application data and permissions remain unchanged.
- **Format planner** green guidance-only badge replaced with neutral guidance language; non-implemented or experimental tournament formats must still be tested before real use.
- **Marketplace Buyer Experience** shows ordered steps and payment-method choices (D17, Poste, Orange, Ooredoo, TT). Receipts are stored privately as up to five images per existing order; only Owner+MFA can verify a transfer after checking the real provider account. Amounts/prices remain managed by existing server-side marketplace functions. A user-supplied transfer/contact number 56661169 is displayed with verification guidance. No automated provider checkout, card processor, genuine merchant QR, or unverified paid state.
- **My Account** displays server-derived XP/level/player points/staff contribution, selectable favorite game card, private tournament and showmatch history, visible Sign Out, and a conditional navigation Sign Out for authenticated users.
- **VXSK News** is a small, curated Nov 2026 roundup with dates and links to official VALORANT, League of Legends and Rocket League publisher sources. News is NOT automatically refreshed. A dedicated news.html page is included.
- **Owner Notifications** shown privately inside Staff Command for incoming request and status changes. Automatic Gmail and Discord delivery are NOT configured. These would require approved credentials and a secure server-side worker.
- Light-weight mobile CSS, hover/focus cards, reduced-motion behavior, and bumped service worker cache version.

## Supabase backend already installed

New V20 functions: `vxsk_v20_reserve_proof`, `vxsk_v20_cancel_proof_reservation`, `vxsk_v20_submit_payment`, `vxsk_v20_my_orders`, `vxsk_v20_owner_payment_queue`, `vxsk_v20_owner_review_payment`, `vxsk_v20_set_favorite_game`, `vxsk_v20_my_dashboard`, `vxsk_v20_owner_inbox`, `vxsk_v20_read_notice`, `vxsk_v20_owner_inventory`, `vxsk_v20_owner_remove_queue_record`.

New V20 tables: `vxsk_v20_payment_proofs`, `vxsk_v20_payment_submissions`, `vxsk_v20_profile_prefs`, `vxsk_v20_owner_notices`. Private Supabase Storage bucket `vxsk-payment-proofs`. All new tables have RLS enabled and no blanket direct client writes. Existing V19 audited archive is reused. Existing owner check validates owner role AND JWT `aal2`.

## QA results and limitations

- New scripts and existing marketplace JS passed Node syntax checks; new page links/assets verified.
- Owner Record Management tab visible in isolated UI test with mocked Owner+MFA event.
- Isolated buyer checkout and news mobile snapshots tested with local CSS. Full real authenticated website E2E browser testing was blocked by test environment and has NOT been certified.
- Supabase test check: 1 existing tournament and 2 entries remained; no live test records or payment evidence were created. Storage payment-proof bucket is private; anonymous actors cannot invoke the sensitive V20 payment submission/deletion functions.
- Supabase security adviser has pre-existing warnings for some SECURITY DEFINER function exposure and disabled leaked-password protection; project-wide remediation remains required before broad production use.
- V19 advanced Swiss, Double and multi-stage tournament flows remain EXPERIMENTAL; this V20 UI release does not claim full 16–64 team E2E validation.
- Real payment network/provider API and automatic email/Discord delivery are out of scope of this package and have NOT been enabled.

## Recommended test order

1. Deploy `VXSK_V20_CLOUDFLARE_TEST.zip` only to Cloudflare TEST.
2. Log in as Owner with working 2FA → Staff Command → **Record Management**; confirm categories and protected buttons. **Do not click Delete on real records for testing.**
3. Staff → Showmatch Requests → verify existing applications visible.
4. Marketplace → Buyer Experience/My Orders and review how payments remain unverified until Owner approves.
5. My Account → favorite game, XP, history, Sign Out; check mobile screens.
6. Staff → Marketplace → Payment Verification; Staff Overview → Owner Notifications.
7. Verify VXSK News source links and top navigation. No changes to the VXSK OFFICIAL GitHub repository.
