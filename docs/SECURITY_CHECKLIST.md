# VXSK — realistic security protection checklist

Security reduces risk; no protection guarantees zero breaches, zero malware or immunity from legal claims. Consult a qualified security engineer for production review and appropriate Tunisian data/privacy legal advice.

## Cloudflare
- Route the **actual production hostname** through the intended Cloudflare setup, enable available DDoS protection and managed WAF, bot management/challenges as suited to account flows, rate limits for public write endpoints. Review false-positive analytics.
- Protect staging preview from public misuse, ideally with Access when suitable. Workers preview and production may have different settings.
- A website Cloudflare zone alone does not secure direct `*.supabase.co` API calls; secure Supabase separately.

## Supabase
- Enforce email confirmation, domain/redirect allowlists, strong passwords and suitable Auth rate limits.
- Turnstile: create approved-hostname widget; SITEKEY in frontend, SECRET **only** in staging Supabase Auth dashboard. Enable only after deployed frontend widget is verified. Supabase Auth validates password signup, signin and password reset tokens; custom join RPCs still require transactional duplicate/capacity limits and abuse checks.
- RLS + no direct sensitive table access. Audit *every* SECURITY DEFINER function: pin search_path; validate authenticated user, Owner/reviewer role, AAL2 and membership inside function; revoke default PUBLIC/anon grants except intentionally public read RPCs.
- Review Storage: private rank proof and user assets, safe MIME and file-signature validation, size quotas, random filenames, malware scanning/containment of arbitrary uploads. Never trust uploaded extension. Avoid executing user-supplied files.
- Use atomic database transactions and constraints for join, team invitations, roster freezing and bracket/score progression. Owner or authorized reviewer operations logged with who/when/old/new status.

## App/ops
- Never expose service_role or Turnstile secret in client/repo. Rotate leaked secrets immediately.
- Configure CSP/HSTS/X-Content-Type-Options/Referrer-Policy/Permissions-Policy appropriate to Cloudflare Workers. If CSP is enabled, permit challenges.cloudflare.com in script-src, frame-src, connect-src for Turnstile.
- Verify dependencies, enable automated dependency/security scanning, keep frameworks and library pinning updated. Apply server-side input validation and output encoding; do not use innerHTML with user data.
- Set audit retention, minimal data collection, delete/export policy, report abuse contacts, incident response procedure, scheduled backups and restore tests.

## Security gates to check manually
- Anonymous cannot view private registrations or review notes.
- Player cannot set own approval, score, bracket, staff roles or access another user's private uploads.
- Reviewer cannot modify owner-only roles/publishing and cannot bypass AAL2.
- Flooding join calls, challenge abuse, expired JWT, concurrent writes and replayed score requests fail safely.
- No legal guarantee; incident response and data management matter as much as anti-DDoS tools.

References:
- https://supabase.com/docs/guides/auth/auth-captcha
- https://supabase.com/docs/guides/auth/rate-limits
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/cron
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/
