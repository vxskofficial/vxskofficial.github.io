/* VXSK Turnstile Auth v8: opt-in per-form widget for Supabase Auth.
 * The sitekey is public; secret validation is handled only by Supabase Auth.
 * Fails closed for password auth if configured but widget verification is missing.
 */
'use strict';
(() => {
  const key=String(window.VXSK_TURNSTILE_SITEKEY||'').trim();
  const configured=/^[A-Za-z0-9_-]{6,}$/.test(key);
  const ids={signin:'signin-form',signup:'signup-form',forgot:'forgot-form'};
  const widgets=new Map();
  let scriptState='idle';
  function error(message){return {publicMessage:message};}
  function ensureHolder(id){
    const form=document.getElementById(id);
    if(!form)return null;
    let holder=form.querySelector('.vxsk-auth-captcha');
    if(holder)return holder;
    holder=document.createElement('div');holder.className='vxsk-auth-captcha';
    holder.setAttribute('aria-label','Human verification');
    holder.setAttribute('role','group');
    const submit=form.querySelector('button[type="submit"]');
    if(submit)form.insertBefore(holder,submit);else form.append(holder);
    return holder;
  }
  function draw(id){
    if(!configured||widgets.has(id)||typeof window.turnstile?.render!=='function')return;
    const holder=ensureHolder(id);
    if(!holder)return;
    const slot=document.createElement('div');holder.replaceChildren(slot);
    const entry={id:null,token:''};widgets.set(id,entry);
    try {
      entry.id=window.turnstile.render(slot,{
        sitekey:key,theme:'dark',size:'normal',
        callback: token=>{entry.token=String(token||'');},
        'expired-callback':()=>{entry.token='';},
        'error-callback':()=>{entry.token='';}
      });
    }catch(_){
      widgets.delete(id);
      holder.textContent='Verification could not load. Refresh or disable blocking extensions.';
    }
  }
  function showView(view){
    if(!configured||!Object.prototype.hasOwnProperty.call(ids,view))return;
    if(scriptState==='ready'){
      requestAnimationFrame(()=>draw(ids[view]));return;
    }
    if(scriptState!=='idle')return;
    scriptState='loading';
    // CSP must permit challenges.cloudflare.com in script-src/frame-src/connect-src.
    const script=document.createElement('script');
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;
    script.onload=()=>{
      scriptState='ready';
      // Render only the visible form. Hidden forms may not render reliably.
      requestAnimationFrame(()=>{
        for(const id of Object.values(ids)){
          const form=document.getElementById(id);
          if(form && !form.closest('[hidden]'))draw(id);
        }
      });
    };
    script.onerror=()=>{
      scriptState='error';
      for(const id of Object.values(ids)){
        const holder=ensureHolder(id);
        if(holder)holder.textContent='Human verification unavailable. Refresh to retry.';
      }
    };
    document.head.append(script);
  }
  function tokenFor(id){
    if(!configured)return null;
    const token=widgets.get(id)?.token;
    if(!token){showView(Object.keys(ids).find(x=>ids[x]===id));throw error('Complete the human verification and try again.');}
    return token;
  }
  function reset(id){
    if(!configured)return;
    const record=widgets.get(id);
    if(!record)return;
    record.token='';
    try{window.turnstile?.reset(record.id);}catch(_){}
  }
  window.VXSKTurnstile=Object.freeze({enabled:configured,showView,tokenFor,reset});
})();
