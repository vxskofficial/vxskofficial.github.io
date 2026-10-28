/* VXSK V12.9.4-p3 — read-only Owner Cleanup UI.
   No .delete(), UPDATE or destructive RPC here. Requires verified Owner + AAL2 and RLS for reading.
   Existing application/opponent/post delete flows remain in their original scripts. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const ui = { tab: $('vxsk-owner-cleanup-tab'), list: $('vxsk-cleanup-items'), type: $('vxsk-cleanup-type'),
    refresh: $('vxsk-cleanup-refresh'), status: $('vxsk-cleanup-status') };
  if (!ui.tab || !ui.list || !ui.type || !ui.refresh || !ui.status) return;
  const sources = {
    events: {table:'vxsk_hub_events',columns:'id,title,game,created_at',label:r=>r.title||'Tournament event'},
    fixtures: {table:'vxsk_hub_matches',columns:'id,game,side_a,side_b,created_at',label:r=>[r.game,r.side_a,'vs',r.side_b].filter(Boolean).join(' ')},
    reports: {table:'vxsk_hub_match_reports',columns:'id,match_id,state,created_at',label:r=>'Referee report · '+(r.state||'unknown')},
    challenges: {rpc:'vxsk_showmatch_staff_queue',label:r=>'Showmatch challenge · '+(r.title||r.status||'')},
    boosters: {table:'vxsk_booster_applications',columns:'id,created_at',label:()=> 'Booster application'},
    orders: {table:'vxsk_marketplace_requests',columns:'id,created_at',label:()=> 'Marketplace request'},
    feedback: {table:'vxsk_server_feedback',columns:'id,created_at',label:()=> 'Server feedback'}
  };
  let api=null, ownerVerified=false;
  const el=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
  function status(text){ui.status.textContent=text;}
  async function verifyOwner(){
    if (!api) return false;
    const [user,aal,owner]=await Promise.all([
      api.auth.getUser(),api.auth.mfa.getAuthenticatorAssuranceLevel(),api.rpc('vxsk_hub_owner')
    ]);
    return !user.error && !!user.data?.user && !aal.error && aal.data?.currentLevel==='aal2' && !owner.error && owner.data===true;
  }
  async function refresh(){
    ui.list.replaceChildren();
    if (!ownerVerified || !api) { status('Owner + MFA verified session required.');return; }
    ui.refresh.disabled=true; status('Loading authorized records…');
    try {
      if(!await verifyOwner()) {ownerVerified=false;ui.tab.hidden=true;status('Owner verification expired. Sign in and complete MFA.');return;}
      const key=ui.type.value, spec=sources[key];
      if(!spec)return;
      let rows, error;
      if(spec.rpc){({data:rows,error}=await api.rpc(spec.rpc));}
      else {({data:rows,error}=await api.from(spec.table).select(spec.columns).order('created_at',{ascending:false}).limit(30));}
      if(error)throw error;
      const list=Array.isArray(rows)?rows:[];
      for(const r of list){
        const card=el('div','','vxsk-cleanup-item'); const info=el('div');
        const name=el('strong',String(spec.label(r)||'VXSK record').slice(0,130));
        const date=r.created_at?new Date(r.created_at).toLocaleDateString('en-GB'):'Date unavailable';
        const meta=el('small',date+' · '+String(r.id||'No ID').slice(0,42));info.append(name,meta);
        const del=el('button','DELETE · BACKEND PENDING','vxsk-cleanup-delete');del.type='button';del.disabled=true;
        del.title='Disabled until an audited Owner-only Supabase deletion RPC is installed and tested';
        card.append(info,del);ui.list.append(card);
      }
      if(!list.length)ui.list.append(el('p','No records available for this section.'));
      status(`${list.length} record(s) available for Owner review. Delete is intentionally disabled until a secured, backed-up server workflow exists.`);
    } catch(err){status('Unable to load this section. Check its database setup, Owner MFA and RLS. No records were modified.');}
    finally{ui.refresh.disabled=false;}
  }
  ui.refresh.addEventListener('click',()=>void refresh());
  window.addEventListener('vxsk:staff-ready',async e=>{
    if(e.detail?.role!=='owner')return;
    api=window.VXSK_STAFF_API;
    try{ownerVerified=await verifyOwner();}catch(_){ownerVerified=false;}
    ui.tab.hidden=!ownerVerified;
    status(ownerVerified?'Owner + MFA verified. Choose a section to review; Delete requires future server backend.':'Owner + MFA required.');
  });
})();
