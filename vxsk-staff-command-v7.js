/* VXSK Staff Command V7 — role-aware labels and safe presentation only.
   No auth, permission, RPC, database or mutation logic is implemented here. */
'use strict';
(() => {
  const init = () => {
    const dash = document.getElementById('dashboard');
    const nav = document.getElementById('staff-command-nav');
    const more = document.getElementById('vxsk-simple-more');
    if (!dash || !nav) return;
    // Only simplify the launcher if the original More Tools navigation is present.
    if (more && nav.contains(more)) document.body.classList.add('vxsk-staff-v7-ready');
    const label = document.getElementById('v7-role-label');
    const context = document.getElementById('v7-role-context');
    if (!label || !context) return;
    window.addEventListener('vxsk:staff-ready', (event) => {
      const role = event.detail && event.detail.role;
      if (role === 'owner') {
        label.textContent = 'OWNER / FULL OPERATIONS';
        context.textContent = 'Owner desk — manage tournaments and publishing, review proposed scores, and assign reviewer access where server permissions allow.';
      } else if (role === 'reviewer') {
        label.textContent = 'REVIEWER / EVENT OPERATIONS';
        context.textContent = 'Reviewer desk — review player applications and submit match reports where authorized. Owner-only approvals and role assignments stay restricted.';
      } else {
        label.textContent = 'LIMITED STAFF ACCESS';
        context.textContent = 'Only tools authorized for your current staff account are available. Tournament and owner actions require their own server-side permissions.';
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
