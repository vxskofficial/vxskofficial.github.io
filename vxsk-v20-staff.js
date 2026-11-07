/* VXSK V20 owner command: full audit-backed record management, payment verification,
 * private notification inbox. Permissions never rely on CSS or these buttons. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const make=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined&&txt!==null)e.textContent=String(txt);if(cls)e.className=cls;return e;};
 let api=null,owner=false,busy=false,cache={};
 const groups=[
  ['tournaments','TOURNAMENTS','tournament','archive'],
  ['fixtures','LEGACY FIXTURES','legacy_fixture','archive'],
  ['posts','SHOWMATCH POSTS','showmatch_post','archive'],
  ['registrations','SHOWMATCH APPLICATIONS','registration','remove'],
  ['challenges','SHOWMATCH CHALLENGES','challenge','remove'],
  ['orders','MARKETPLACE ORDERS','order','remove'],
  ['booster_apps','BOOSTER APPLICATIONS','booster_app','remove'],
  ['feedback','CUSTOMER FEEDBACK','feedback','remove'],
  ['opponents','NO OPPONENT REQUESTS','opponent','remove'],
  ['score_reports','REFEREE SCORE REPORTS','score_report','remove']
 ];
 async function rpc(name,params={}){const {data,error}=await api.rpc(name,params);if(error)throw Error(error.message);return data;}
 function notify(node,msg,error=false){if(node){node.textContent=msg;node.dataset.error=error?'1':'0';}}
 async function verify(){const [u,m,r]=await Promise.all([api.auth.getUser(),api.auth.mfa.getAuthenticatorAssuranceLevel(),rpc('vxsk_hub_owner')]);return !u.error&&!!u.data?.user&&!m.error&&m.data?.currentLevel==='aal2'&&r===true;}
 function actionModal(title,description,kind,id,mode,refresh){
  const dlg=make('dialog',null,'v20-confirm-dialog');
  const form=make('form',null,'v20-confirm-form');form.method='dialog';
  form.append(make('h3',title),make('p',description));
  const lbl=make('label','REASON · 8–300 characters');const reason=make('textarea');reason.required=true;reason.minLength=8;reason.maxLength=300;reason.rows=3;reason.placeholder='Explain why this record should be removed or hidden';lbl.append(reason);form.append(lbl);
  const phrase=mode==='remove'?make('label','TYPE DELETE TO CONFIRM'):null;
  const confirmText=mode==='remove'?make('input'):null;
  if(phrase){confirmText.placeholder='DELETE';confirmText.required=true;phrase.append(confirmText);form.append(phrase);}
  const row=make('div',null,'v20-confirm-actions');const cancel=make('button','CANCEL');cancel.type='button';cancel.addEventListener('click',()=>dlg.close());const submit=make('button',mode==='remove'?'DELETE RECORD':'ARCHIVE RECORD','v20-danger-button');submit.type='submit';row.append(cancel,submit);form.append(row);
  const state=make('p',null,'v20-feedback');state.setAttribute('role','status');form.append(state);
  form.addEventListener('submit',async ev=>{ev.preventDefault();if(busy)return;if(reason.value.trim().length<8)return notify(state,'Please explain the change (8+ characters).',true);
   if(mode==='remove'&&confirmText.value!=='DELETE')return notify(state,'Enter DELETE in uppercase to confirm.',true);
   busy=true;submit.disabled=true;
   try{if(!await verify())throw Error('Owner + 2FA verification required');
    if(mode==='archive')await rpc('vxsk_v19_owner_archive',{p_kind:kind,p_id:id,p_reason:reason.value.trim()});
    else await rpc('vxsk_v20_owner_remove_queue_record',{p_kind:kind,p_id:id,p_reason:reason.value.trim(),p_confirmation:'DELETE'});
    dlg.close();await refresh();
   }catch(e){notify(state,e.message,true);}finally{busy=false;submit.disabled=false;}
  });dlg.append(form);document.body.append(dlg);dlg.addEventListener('close',()=>dlg.remove(),{once:true});dlg.showModal();reason.focus();
 }
 async function loadRecords(){const root=$('v20-record-rows'),state=$('v20-record-status'),sel=$('v20-record-category');if(!root||!api)return;
  notify(state,'Loading private records…');root.replaceChildren();
  try{const [legacy,misc]=await Promise.all([rpc('vxsk_v19_owner_records'),rpc('vxsk_v20_owner_inventory')]);cache={...legacy,...misc};
   const values=Object.fromEntries(groups.map(([key,label])=>[key,Array.isArray(cache[key])?cache[key].length:0]));
   sel.replaceChildren();for(const [key,label] of groups){const opt=make('option',`${label} · ${values[key]}`);opt.value=key;sel.append(opt);}
   sel.value=sel.dataset.current||'tournaments';if(!sel.value)sel.value='tournaments';showRecords();
   notify(state,'Owner-only records loaded. Deletion removes eligible records from the active queue, but retains a secure audit snapshot.');
  }catch(e){notify(state,'Cannot load private records: '+e.message,true);}
 }
 function showRecords(){const sel=$('v20-record-category'),root=$('v20-record-rows');if(!sel||!root)return;
  sel.dataset.current=sel.value;root.replaceChildren();const [key,label,kind,mode]=groups.find(g=>g[0]===sel.value)||groups[0];const rows=(cache[key]||[]);
  if(!rows.length){root.append(make('p','No records in this section.','v20-muted'));return;}
  for(const record of rows){const card=make('article',null,'v20-record-card');const info=make('div');
   const name=make('strong',record.name||'VXSK record');const meta=make('small',`${String(record.status||'—').toUpperCase()} · ${record.created_at?new Date(record.created_at).toLocaleDateString('en-GB'):'No date'}`);
   info.append(name,meta);const can=mode==='archive'?record.published===true:record.can_delete===true;
   const btn=make('button',can?(mode==='archive'?'ARCHIVE / HIDE':'DELETE · AUDIT'):'PROTECTED','v20-record-action');btn.type='button';btn.disabled=!can;
   btn.title=can?'Owner approval, reason and confirmation required':'Live, approved or history-linked records are protected';
   btn.addEventListener('click',()=>actionModal(mode==='archive'?'ARCHIVE RECORD':'DELETE QUEUE RECORD',
    mode==='archive'?'Hide the public record. A snapshot and audit event will remain in Supabase.':'Only closed/rejected records may be removed. An audit snapshot stays protected in Supabase.',kind,record.id,mode,loadRecords));
   card.append(info,btn);root.append(card);
  }
 }
 async function loadInbox(){const host=$('v20-inbox-items'),status=$('v20-inbox-status');if(!host)return;
  host.replaceChildren();notify(status,'Loading latest owner events…');try{
   const events=await rpc('vxsk_v20_owner_inbox');let unread=0;
   for(const e of events||[]){if(!e.read_at)unread++;
    const row=make('article',null,'v20-notice'+(e.read_at?'':' is-new'));
    const text=make('div');text.append(make('strong',e.title),make('small',`${e.category} · ${new Date(e.created_at).toLocaleString()}`));
    const read=make('button',e.read_at?'READ':'MARK READ');read.type='button';read.disabled=!!e.read_at;
    read.addEventListener('click',async()=>{read.disabled=true;try{await rpc('vxsk_v20_read_notice',{p_notice:e.id});await loadInbox();}catch(x){notify(status,x.message,true);read.disabled=false;}});
    row.append(text,read);host.append(row);
   }if(!events?.length)host.append(make('p','No owner events yet.','v20-muted'));
   notify(status,`${unread} unread. Events are stored privately in Supabase; external Gmail/Discord delivery needs a separately configured server integration.`);
  }catch(e){notify(status,'Unable to read owner inbox: '+e.message,true);}
 }
 async function loadPayments(){const host=$('v20-payment-items'),status=$('v20-payment-status');if(!host)return;
  host.replaceChildren();notify(status,'Loading payment verification requests…');
  try{const orders=await rpc('vxsk_v20_owner_payment_queue');
   for(const o of orders||[]){const card=make('article',null,'v20-payment-card');
    const header=make('div');header.append(make('strong',`${o.service||'Order'} · ${o.total_tnd||0} DT`),
      make('small',`${o.payment_method||'Unknown'} · ${String(o.state).replaceAll('_',' ')} · ${new Date(o.submitted_at).toLocaleDateString()}`));card.append(header);
    const photos=make('div',null,'v20-payment-links');
    for(const path of o.photos||[]){const b=make('button','VIEW PRIVATE RECEIPT');b.type='button';b.addEventListener('click',async()=>{
      b.disabled=true;try{const {data,error}=await api.storage.from('vxsk-payment-proofs').createSignedUrl(path,90);
       if(error||!data?.signedUrl)throw Error(error?.message||'Could not open receipt');window.open(data.signedUrl,'_blank','noopener,noreferrer');
      }catch(e){notify(status,e.message,true);}finally{b.disabled=false;}
    });photos.append(b);}card.append(photos);
    if(o.state==='awaiting_review'){
     const buttons=make('div',null,'v20-confirm-actions');
     for(const [approved,label] of [[true,'VERIFY PAYMENT'],[false,'REJECT PROOF']]){
      const btn=make('button',label);btn.type='button';btn.addEventListener('click',async()=>{
       const reason=window.prompt('Owner verification note (8+ characters). Confirm the money arrived before verifying:');
       if(!reason||reason.trim().length<8)return;
       if(!window.confirm(approved?'Did you independently confirm receipt of this payment in the actual provider account?':'Reject this evidence?'))return;
       btn.disabled=true;try{await rpc('vxsk_v20_owner_review_payment',{p_request:o.request_id,p_approve:approved,p_note:reason.trim()});await loadPayments();}
       catch(e){notify(status,e.message,true);}finally{btn.disabled=false;}
      });buttons.append(btn);}card.append(buttons);
    }host.append(card);
   }if(!orders?.length)host.append(make('p','No receipt submissions yet.','v20-muted'));
   notify(status,'Never verify based only on a screenshot. Check actual D17 / operator account balance first.');
  }catch(e){notify(status,'Payment queue unavailable: '+e.message,true);}
 }
 function mount(){
  const view=$('staff-view-cleanup');if(view&&!$('v20-record-management')){
   view.querySelectorAll('.vxsk-cleanup-panel').forEach(e=>e.hidden=true);
   const box=make('section',null,'v20-command-card');box.id='v20-record-management';
   box.innerHTML='<div class="v20-card-title"><span class="v20-card-icon">▤</span><div><h3>RECORD MANAGEMENT</h3><p>Audit-backed controls. Live tournaments, approved results and paid orders stay protected.</p></div></div><div class="v20-filter"><label for="v20-record-category">SELECT RECORD CATEGORY</label><select id="v20-record-category"></select><button id="v20-record-reload" type="button">↻ REFRESH</button></div><p id="v20-record-status" role="status" class="v20-feedback"></p><div id="v20-record-rows" class="v20-record-list"></div>';
   view.append(box);$('v20-record-reload').addEventListener('click',loadRecords);$('v20-record-category').addEventListener('change',showRecords);
  }
  const home=$('staff-view-overview');if(home&&!$('v20-owner-inbox')){
   const box=make('section',null,'v20-command-card');box.id='v20-owner-inbox';
   box.innerHTML='<div class="v20-card-title"><span class="v20-card-icon">♧</span><div><h3>OWNER NOTIFICATIONS</h3><p>Recent changes in applications, tournaments, marketplace and score reports.</p></div></div><div class="v20-actions"><button id="v20-inbox-refresh" type="button">↻ REFRESH INBOX</button></div><p id="v20-inbox-status" class="v20-feedback" role="status"></p><div id="v20-inbox-items" class="v20-inbox-list"></div>';
   home.append(box);$('v20-inbox-refresh').addEventListener('click',loadInbox);
  }
  const market=$('staff-view-boosters');if(market&&!$('v20-owner-payments')){
   const box=make('section',null,'v20-command-card');box.id='v20-owner-payments';
   box.innerHTML='<div class="v20-card-title"><span class="v20-card-icon">▣</span><div><h3>PAYMENT VERIFICATION</h3><p>Private proof photos, D17 and operator transfer submissions. Owner decision required.</p></div></div><div class="v20-actions"><button id="v20-payments-refresh" type="button">↻ REFRESH PAYMENTS</button></div><p id="v20-payment-status" class="v20-feedback" role="status"></p><div id="v20-payment-items" class="v20-payments-list"></div>';
   market.append(box);$('v20-payments-refresh').addEventListener('click',loadPayments);
  }
  const nav=$('staff-command-nav');if(nav&&!$('v20-staff-signout')){
   const out=make('button','↪ SIGN OUT','v20-staff-signout');out.type='button';out.id='v20-staff-signout';
   out.addEventListener('click',async()=>{out.disabled=true;try{const {error}=await api.auth.signOut();if(error)throw error;location.href='index.html';}catch(e){out.disabled=false;window.alert('Sign out failed: '+e.message);}});
   nav.append(out);
  }
 }
 window.addEventListener('vxsk:staff-ready',async e=>{
  api=window.VXSK_STAFF_API;
  if(!api)return;
  const nav=$('staff-command-nav');if(nav&&!$('v20-staff-signout')){
   const out=make('button','↪ SIGN OUT','v20-staff-signout');out.type='button';out.id='v20-staff-signout';
   out.addEventListener('click',async()=>{out.disabled=true;try{const {error}=await api.auth.signOut();if(error)throw error;location.href='index.html';}catch(x){out.disabled=false;window.alert(x.message);}});
   nav.append(out);
  }
  if(e.detail?.role!=='owner')return;
  try{owner=await verify();}catch(_){owner=false;}
  if(!owner)return;
  const tab=$('vxsk-owner-cleanup-tab');if(tab){tab.hidden=false;tab.removeAttribute('data-vxsk-legacy-archive');}
  document.querySelectorAll('[data-p13-go="cleanup"]').forEach(x=>x.hidden=false);
  mount();void Promise.allSettled([loadRecords(),loadInbox(),loadPayments()]);
  if(location.hash==='#cleanup')tab?.click();
 });
 window.addEventListener('hashchange',()=>{if(owner&&location.hash==='#cleanup')$('vxsk-owner-cleanup-tab')?.click();});
})();
