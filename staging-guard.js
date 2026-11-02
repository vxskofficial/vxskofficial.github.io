/* Hard stop if a preview deployment (GitHub Pages, Netlify, or Cloudflare) is pointed at a non-staging Supabase project. */
'use strict';
(() => {
  const cfg=window.VXSK_SUPABASE||{};
  const host=location.hostname.toLowerCase();
  const isNetlifyPreview=host.endsWith('.netlify.app')&&host!=='vxsk-events.netlify.app';
  const isCloudflarePreview=host.endsWith('.workers.dev')||host.endsWith('.pages.dev');
  const isPreview=isNetlifyPreview||host.endsWith('.github.io')||isCloudflarePreview;
  const expectedStaging='https://opzqnmahfgehaewgciwg.supabase.co';
  const blocked=isPreview&&String(cfg.url||'').toLowerCase()!==expectedStaging;
  Object.defineProperty(window,'VXSK_STAGING_BLOCKED',{value:blocked,writable:false,configurable:false});
  if(!blocked)return;
  const banner=document.createElement('div');banner.className='vxsk-staging-guard';
  banner.setAttribute('role','alert');
  banner.textContent='STAGING SAFETY LOCK: Test website is NOT pointed at the approved staging Supabase project. Authentication and data requests are blocked until you configure a separate staging database.';
  document.body.prepend(banner);
})();
