/* VXSK P12 Registration UI v2 — STAGING ONLY.
 * Uses V3 RPCs, never direct table writes. Gracefully fails closed if backend
 * is uninstalled. All authorization, capacity, dates, ranks and roles must be
 * enforced by Supabase functions; UI checks are informational only.
 */
'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const isArena=Boolean($('vxsk-registration'));
 const isStaff=Boolean($('vxsk-owner-registration'));
 if(!isArena&&!isStaff)return;
 const state={api:null,user:null,ready:false,events:[],mine:[],owner:false,busy:false};
 const ui=(tag,value='',cls='')=>{const n=document.createElement(tag);n.textContent=String(value??'');if(cls)n.className=cls;return n;};
 const btn=(label,handler,cls='')=>{const b=ui('button',label,cls);b.type='button';b.addEventListener('click',()=>void handler(b));return b;};
 const notice=(id,message,error=false)=>{const n=$(id);if(n){n.textContent=message;n.dataset.error=String(error);}};
 const dateText=v=>{if(!v)return 'Date TBA';const d=new Date(v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Tunis',dateStyle:'medium',timeStyle:'short'}).format(d)+' Tunis':'Date TBA';};
 const lostBackend=e=>['42883','PGRST202','PGRST205','42P01'].includes(e?.code)||/function .* not found|schema cache|does not exist/i.test(e?.message||'');
 async function rpc(name,args={}){
  if(!state.api)throw Error('Not connected. Refresh the page.');
  const {data,error}=await state.api.rpc(name,args);
  if(error){console.warn('VXSK registration',name,error.code||'error');throw error;}
  return data;
 }
 async function busyAction(button,action,noticeId){
  if(state.busy)return;state.busy=true;button.disabled=true;
  try{await action();}
  catch(e){notice(noticeId,lostBackend(e)?'Registration backend is not installed yet. No request was submitted.':(e?.message||'Action could not be completed.'),true);}
  finally{state.busy=false;button.disabled=false;}
 }
 async function session(){
  const result=await state.api.auth.getUser();state.user=result.error?null:result.data?.user||null;return state.user;
 }
 function statusOf(t){
  if(!t.registration_open)return 'Registration not open';
  if(t.rank_verification==='manual')return 'Rank verification coming soon';
  return t.has_capacity?'Open for registration':'Waitlist available';
 }
 function renderCatalog(){
  const root=$('vxsk-join-catalog');if(!root)return;root.replaceChildren();
  if(!state.ready){root.append(ui('p','Registration is not available yet. Official brackets remain visible below.','vxsk-muted'));return;}
  if(!state.events.length){root.append(ui('p','No tournaments accepting applications have been published.','vxsk-muted'));return;}
  for(const t of state.events){
   const card=ui('article','','vxsk-join-card');
   const line=ui('div','','vxsk-join-meta');line.append(ui('span',t.game||'Event'),ui('span',t.participation_type==='solo'?'SOLO':'TEAM'));
   card.append(line,ui('h4',t.title||'Tournament'),ui('p',`${t.mode||'Competition'} · ${statusOf(t)}`,'vxsk-join-status'));
   const times=ui('dl','','vxsk-join-dates');
   for(const [name,val] of [['Registration closes',t.registration_closes_at],['Tournament starts',t.starts_at]]){
    const row=ui('div');row.append(ui('dt',name),ui('dd',dateText(val)));times.append(row);
   }
   card.append(times);
   const n=Number(t.reserved_entries)||0;
   card.append(ui('p',t.max_entries?`${n} / ${t.max_entries} places reserved`:'Registration capacity not configured','vxsk-muted'));
   if(t.rules_text){const details=ui('details');details.append(ui('summary','RULES & ELIGIBILITY'),ui('p',t.rules_text,'vxsk-rules'));card.append(details);}
   if(t.rank_requirement)card.append(ui('p','Rank: '+t.rank_requirement,'vxsk-muted'));
   const action=ui('div','','vxsk-join-actions');
   if(!state.user){const a=ui('a','SIGN IN TO JOIN','vxsk-join-button');a.href='index.html#members';action.append(a);}
   else if(!t.registration_open){action.append(ui('span','JOIN OPENS WHEN REGISTRATION IS ACTIVE','vxsk-muted'));}
   else if(t.rank_verification==='manual'){action.append(ui('span','JOIN NOT YET AVAILABLE FOR RANK-VERIFIED EVENTS','vxsk-muted'));}
   else if(t.participation_type==='solo'){
    const join=btn(t.has_capacity?'JOIN SOLO':'JOIN WAITLIST',async b=>{
      if(!confirm('Submit your registration for '+(t.title||'this tournament')+'?'))return;
      await busyAction(b,async()=>{
       await rpc('vxsk_p12_register_solo_v3',{p_tournament:t.id});
       notice('vxsk-join-notice','Registration submitted. Check My Registrations below.');
       await refreshPlayer();
      },'vxsk-join-notice');
    },'vxsk-join-button');action.append(join);
   }else{
    const toggle=btn(t.has_capacity?'CREATE TEAM & JOIN':'JOIN TEAM WAITLIST',async()=>{
      if(card.querySelector('.vxsk-team-form')){card.querySelector('.vxsk-team-form').remove();return;}
      await teamForm(card,t);
    },'vxsk-join-button');action.append(toggle);
   }
   card.append(action);root.append(card);
  }
 }
 async function teamForm(card,t){
  const form=ui('form','','vxsk-team-form');
  const title=ui('label','TEAM NAME');const name=document.createElement('input');name.required=true;name.minLength=2;name.maxLength=80;name.placeholder='Your team name';title.append(name);form.append(title);
  const players=ui('div','','vxsk-selected-players');const selected=new Map();
  const hint=ui('p',`Invite ${Math.max(0,(Number(t.min_team_size)||1)-1)} to ${Math.max(0,(Number(t.max_team_size)||10)-1)} teammates (captain included automatically).`,'vxsk-muted');form.append(hint);
  const searchLabel=ui('label','FIND VXSK PLAYERS BY NICKNAME');const search=document.createElement('input');search.type='search';search.maxLength=40;search.minLength=2;search.placeholder='Type at least 2 characters';searchLabel.append(search);form.append(searchLabel);
  const results=ui('div','','vxsk-player-results');form.append(results,players);
  const renderSelected=()=>{players.replaceChildren();if(!selected.size)players.append(ui('p','No teammates selected.','vxsk-muted'));
   for(const [id,nick] of selected){const remove=btn('× '+nick,()=>{selected.delete(id);renderSelected();},'vxsk-player-chip');remove.setAttribute('aria-label','Remove '+nick);players.append(remove);}};
  renderSelected();
  const look=btn('SEARCH PLAYERS',async b=>busyAction(b,async()=>{
    if(search.value.trim().length<2){results.replaceChildren(ui('p','Enter at least 2 characters.'));return;}
    const matches=await rpc('vxsk_p12_search_players_v3',{p_query:search.value.trim()});results.replaceChildren();
    if(!Array.isArray(matches)||!matches.length)results.append(ui('p','No discoverable players found.','vxsk-muted'));
    for(const p of matches){const add=btn('+ '+p.nickname,()=>{
       if(selected.has(p.user_id))return;
       if(selected.size>=Math.max(0,(Number(t.max_team_size)||10)-1)){notice('vxsk-join-notice','Team size limit reached.',true);return;}
       selected.set(p.user_id,p.nickname);renderSelected();
      },'vxsk-join-small');results.append(add);}
   },'vxsk-join-notice'),'vxsk-join-small');form.append(look);
  const submit=ui('button','SUBMIT TEAM REGISTRATION','vxsk-join-button');submit.type='submit';form.append(submit);
  form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;
    if(selected.size+1<Number(t.min_team_size||1)){notice('vxsk-join-notice','Invite enough teammates to meet the minimum team size.',true);return;}
    void busyAction(submit,async()=>{
     if(!confirm('Submit '+name.value.trim()+' for '+t.title+'?'))return;
     await rpc('vxsk_p12_create_team_entry_v3',{p_tournament:t.id,p_team_name:name.value.trim(),p_invited_users:[...selected.keys()]});
     notice('vxsk-join-notice','Team application sent. Invited teammates can respond from My Registrations.');await refreshPlayer();
    },'vxsk-join-notice');
  });
  card.append(form);
 }
 function renderMine(){
  const root=$('vxsk-my-entries-list');if(!root)return;root.replaceChildren();
  if(!state.user){root.append(ui('p','Sign in to see applications and invitations.'));return;}
  if(!state.ready){root.append(ui('p','Registration backend not installed yet.'));return;}
  if(!state.mine.length){root.append(ui('p','No registrations or invitations yet.'));return;}
  for(const e of state.mine){const row=ui('article','','vxsk-join-entry');
   row.append(ui('strong',e.tournament_title||'Tournament'),ui('span',e.entry_status||'pending','vxsk-entry-state'),ui('p',e.entry_name||'Solo player'));
   const members=Array.isArray(e.members)?e.members:[];
   if(members.length)row.append(ui('p','Roster: '+members.map(x=>(x.nickname||'Player')+' ('+(x.invitation_status||'?')+')').join(', '),'vxsk-muted'));
   const actions=ui('div','','vxsk-join-actions');
   if(e.my_membership_status==='invited'&&e.entry_status!=='rejected'&&e.entry_status!=='withdrawn'){
    for(const [text,fn] of [['ACCEPT INVITE','vxsk_p12_accept_invitation_v3'],['DECLINE','vxsk_p12_decline_invitation_v3']]){
      const b=btn(text,async b=>busyAction(b,async()=>{
        if(!confirm((text==='DECLINE'?'Decline':'Accept')+' invitation to '+e.tournament_title+'?'))return;
        await rpc(fn,{p_entry:e.entry_id});await refreshPlayer();notice('vxsk-join-notice','Invitation updated.');
      },'vxsk-join-notice'),'vxsk-join-small');
      // Manual rank invitations are not yet supported by V3.
      const tour=state.events.find(x=>x.id===e.tournament_id);
      if(fn==='vxsk_p12_accept_invitation_v3'&&tour?.rank_verification==='manual')b.disabled=true;
      actions.append(b);
    }
   }
   if(e.my_role==='captain'&&['pending','waitlisted'].includes(e.entry_status)){
    actions.append(btn('WITHDRAW',async b=>busyAction(b,async()=>{
      if(!confirm('Withdraw this registration?'))return;
      await rpc('vxsk_p12_withdraw_entry_v3',{p_entry:e.entry_id});await refreshPlayer();notice('vxsk-join-notice','Registration withdrawn.');
    },'vxsk-join-notice'),'vxsk-join-small'));
   }
   row.append(actions);root.append(row);
  }
 }
 async function refreshPlayer(){
  if(!isArena||!state.api)return;
  const node=$('vxsk-join-refresh');if(node)node.disabled=true;
  try{
   await session();
   const catalog=await rpc('vxsk_p12_registration_catalog_v3');
   state.ready=true;state.events=Array.isArray(catalog)?catalog:[];
   state.mine=state.user?(await rpc('vxsk_p12_my_entries_v3'))||[]:[];
   notice('vxsk-join-notice',state.user?'Tournament applications connected.':'Browse tournaments. Sign in to join.');
  }catch(e){state.ready=false;state.events=[];state.mine=[];
    notice('vxsk-join-notice',lostBackend(e)?'Registration is being prepared. You can still view brackets and results below.':'Could not load registrations. Try refresh.',true);
  }finally{renderCatalog();renderMine();if(node)node.disabled=false;}
 }
 async function refreshOwner(){
  if(!isStaff||!state.api)return;
  const panel=$('vxsk-owner-registration');
  const root=$('vxsk-owner-join-list');
  const refresh=$('vxsk-owner-join-refresh');if(refresh)refresh.disabled=true;
  try{
    const [a,owner]=await Promise.all([state.api.auth.mfa.getAuthenticatorAssuranceLevel(),state.api.rpc('vxsk_p12_owner_ok')]);
    if(a.error||a.data?.currentLevel!=='aal2'||owner.error||owner.data!==true){panel.hidden=true;return;}
    state.owner=true;panel.hidden=false;
    const q=await rpc('vxsk_p12_owner_registration_queue_v3');
    root.replaceChildren();const entries=Array.isArray(q)?q:[];
    notice('vxsk-owner-join-notice',entries.length+' applications awaiting review.');
    if(!entries.length)root.append(ui('p','No pending registration requests.','vxsk-muted'));
    for(const e of entries){const row=ui('article','','vxsk-join-entry');row.append(ui('strong',e.tournament_title||'Tournament'),ui('span',e.status||'pending','vxsk-entry-state'),ui('p',e.entry_name||'Solo entrant'));
      const memberNames=Array.isArray(e.members)?e.members.map(m=>`${m.nickname||'Player'} (${m.membership_status||'unknown'}, ${m.rank_status||'pending'})`):[];
      row.append(ui('p',memberNames.join(', '),'vxsk-muted'));
      const actions=ui('div','','vxsk-join-actions');
      for(const [label,decision] of [['APPROVE','approved'],['WAITLIST','waitlisted'],['REJECT','rejected']]){
       actions.append(btn(label,async b=>busyAction(b,async()=>{
         if(!confirm(label+' registration for '+e.tournament_title+'?'))return;
         await rpc('vxsk_p12_decide_entry_v3',{p_entry:e.entry_id,p_decision:decision,p_reason:null});
         notice('vxsk-owner-join-notice','Registration '+decision+'.');await refreshOwner();
       },'vxsk-owner-join-notice'),'vxsk-join-small'));
      }
      row.append(actions);root.append(row);
    }
  }catch(e){notice('vxsk-owner-join-notice',lostBackend(e)?'Owner registration backend not installed yet.':'Could not retrieve registration queue.',true);root.replaceChildren();}
  finally{if(refresh)refresh.disabled=false;}
 }
 if(isArena){
  $('vxsk-join-refresh')?.addEventListener('click',()=>void refreshPlayer());
  window.addEventListener('vxsk:arena-api-ready',()=>{state.api=window.VXSK_ARENA_API;void refreshPlayer();});
  if(window.VXSK_ARENA_API){state.api=window.VXSK_ARENA_API;void refreshPlayer();}
 }
 if(isStaff){
  $('vxsk-owner-join-refresh')?.addEventListener('click',()=>void refreshOwner());
  window.addEventListener('vxsk:staff-ready',()=>{
   // Existing staff auth flow already owns the Supabase client; we also
   // independently check Owner + aal2 below before showing the queue.
   state.api=window.VXSK_STAFF_API||null;
   if(state.api)void refreshOwner();
  });
 }
})();
