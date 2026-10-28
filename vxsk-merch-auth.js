/* VXSK merch page: reuse existing public Supabase project and browser auth session.
   No service-role key, no secret, no credential collection. */
'use strict';
(() => {
  const config=window.VXSK_SUPABASE||{};
  const safe=!window.VXSK_STAGING_BLOCKED && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url||'') &&
    typeof config.publishableKey==='string' && (config.publishableKey.startsWith('sb_publishable_')||config.publishableKey.startsWith('eyJ')) &&
    window.supabase?.createClient;
  const client=safe?window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
  window.VXSKAuth=Object.freeze({client});
})();