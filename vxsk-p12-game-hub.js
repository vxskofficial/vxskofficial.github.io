/* VXSK P12 Game Hub — public viewer + protected tournament control.
   Never writes tables directly. All writes require authenticated Owner/Referee + MFA in RPCs. */
'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const fmt={single:'Single Elimination',double:'Double Elimination',groups:'Group Stage',swiss:'Swiss Stage'};
 const games=['Rocket League','VALORANT','League of Legends'];
 const app={data:null,private:null,api:null,role:'',owner:false,referee:false};
 const empty={tournaments:[],teams:[],stages:[],matches:[],updates:[],reports:[]};
 const text=(tag,value,cls='')=>{const n=document.createElement(tag);n.textContent=String(value??'');if(cls)n.className=cls;return n;};
 const option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
 const wrap=(tag,cls='')=>{const n=document.createElement(tag);n.className=cls;return n;};
 const label=t=>t||'—';
 const formattedDate=v=>{if(!v)return 'Date TBA';const d=new Date(v);return isNaN(d.getTime())?'Date TBA':new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Tunis'}).format(d)+' Tunis';};
 const setNotice=(id,message,err=false)=>{const n=$(id);if(n){n.textContent=message;n.dataset.error=err?'1':'0';}};
 async function rpc(name,args={},privateSide=false){
   if(!app.api)throw Error('Not connected to Supabase');
   const {data,error}=await app.api.rpc(name,args);
   if(error){console.warn('VXSK P12',name,error.code||error.message);throw Error(error.message||'Request failed');}
   return data;
 }
 function freshSelect(node,arr,getId,getTitle,placeholder){
   if(!node)return;
   const current=node.value;node.replaceChildren();
   if(placeholder)node.append(option('',placeholder));
   for(const item of arr)node.append(option(getId(item),getTitle(item)));
   if([...node.options].some(o=>o.value===current))node.value=current;
 }
 const ofTournament=(key,id,d)=> (d?.[key]||[]).filter(x=>x.tournament_id===id);
 const teamName=(d,id)=>d.teams.find(x=>x.id===id)?.name||'Team TBA';
 function standings(teams,matches){
  const scores=new Map(teams.map(x=>[x.id,{team:x,played:0,wins:0,draws:0,losses:0,for:0,against:0,points:0}]));
  for(const m of matches){
   if(m.state!=='completed' || m.score_a==null || m.score_b==null)continue;
   const a=scores.get(m.team_a),b=scores.get(m.team_b);if(!a||!b)continue;
   a.played++;b.played++;a.for+=m.score_a;a.against+=m.score_b;b.for+=m.score_b;b.against+=m.score_a;
   if(m.score_a>m.score_b){a.wins++;b.losses++;a.points+=3;}
   else if(m.score_b>m.score_a){b.wins++;a.losses++;b.points+=3;}
   else{a.draws++;b.draws++;a.points++;b.points++;}
  }
  return [...scores.values()].sort((a,b)=>b.points-a.points || (b.for-b.against)-(a.for-a.against) || b.for-a.for || a.team.name.localeCompare(b.team.name));
 }
 function standingsTable(members,fixtures){
   const root=wrap('div','p12-standings');const head=wrap('div','p12-standing p12-standing-head');
   ['#','Team','P','W','D','L','PTS'].forEach(v=>head.append(text('span',v)));root.append(head);
   standings(members,fixtures).forEach((r,i)=>{const line=wrap('div','p12-standing');[i+1,r.team.name,r.played,r.wins,r.draws,r.losses,r.points].forEach(v=>line.append(text('span',v)));root.append(line);});
   return root;
 }
 function matchCard(m,d){
  const n=wrap('article','p12-match');const a=wrap('div','p12-match-side'),b=wrap('div','p12-match-side');
  const scoreSet=m.score_a!=null&&m.score_b!=null;
  a.append(text('strong',teamName(d,m.team_a)),text('b',scoreSet?m.score_a:'—'));
  b.append(text('strong',teamName(d,m.team_b)),text('b',scoreSet?m.score_b:'—'));
  const winner=scoreSet&&m.state==='completed'?(m.score_a>m.score_b?m.team_a:(m.score_b>m.score_a?m.team_b:null)):null;
  if(winner===m.team_a)a.classList.add('p12-winner');
  if(winner===m.team_b)b.classList.add('p12-winner');
  const cap=wrap('small','p12-match-caption');
  cap.textContent=`R${m.round_no} · #${m.slot} · ${label(m.group_name||m.bracket)} · ${m.state.toUpperCase()} · ${formattedDate(m.starts_at)}`;
  n.append(a,b,cap);return n;
 }
 function stageView(stage,d){
  const out=wrap('section','p12-stage');
  const header=wrap('div','p12-stage-title');header.append(text('h4',stage.name),text('span',fmt[stage.format]||stage.format));out.append(header);
  const matches=ofTournament('matches',stage.tournament_id,d).filter(x=>x.stage_id===stage.id);
  if(stage.format==='groups'||stage.format==='swiss'){
    const groups=stage.format==='groups'?[...new Set(matches.map(x=>x.group_name||'GROUP A'))]:['SWISS STANDINGS'];
    for(const group of groups){
      const matchesInGroup=stage.format==='groups'?matches.filter(x=>(x.group_name||'GROUP A')===group):matches;
      const ids=new Set(matchesInGroup.flatMap(x=>[x.team_a,x.team_b]));
      const members=ofTournament('teams',stage.tournament_id,d).filter(x=>ids.has(x.id));
      out.append(text('h5',group));
      if(members.length)out.append(standingsTable(members,matchesInGroup));
    }
  }
  const lanes=stage.format==='double'?['winners','losers','grand_final']:['main'];
  if(!matches.length){out.append(text('p','No fixtures scheduled yet.','p12-muted'));return out;}
  for(const lane of lanes){
   const list=matches.filter(x=>x.bracket===lane);
   if(!list.length)continue;
   if(stage.format==='double')out.append(text('h5',lane.replace('_',' ').toUpperCase()));
   const roundNos=[...new Set(list.map(x=>x.round_no))].sort((a,b)=>a-b);
   const rounds=wrap('div','p12-round-scroll');
   for(const round of roundNos){
    const col=wrap('div','p12-round');
    col.append(text('h6','ROUND '+round));
    list.filter(x=>x.round_no===round).sort((a,b)=>a.slot-b.slot).forEach(x=>col.append(matchCard(x,d)));
    rounds.append(col);
   }
   out.append(rounds);
  }
  return out;
 }
 function renderPublic(){
  const node=$('vxsk-p12-list'),nav=$('vxsk-p12-count');
  if(!node)return;node.replaceChildren();
  if(!app.data){node.append(text('p','Game Hub unavailable until P12 migration is installed.','p12-muted'));return;}
  const d=app.data,filter=$('vxsk-p12-game')?.value||'all',status=$('vxsk-p12-status-filter')?.value||'all';
  const tournaments=d.tournaments.filter(x=>(filter==='all'||x.game===filter)&&(status==='all'||x.status===status));
  if(nav)nav.textContent=`${tournaments.length} EVENTS`;
  if(!tournaments.length){node.append(text('p','No published events for this filter.','p12-muted'));return;}
  for(const t of tournaments){
   const card=wrap('article','p12-event-card');
   const h=wrap('div','p12-event-head'),title=wrap('div');
   title.append(text('span',t.game+' / '+t.mode,'p12-game-kicker'),text('h3',t.title));
   const badge=text('span',t.status.toUpperCase(),'p12-status p12-'+t.status);
   h.append(title,badge);card.append(h);
   card.append(text('small',formattedDate(t.starts_at),'p12-muted'));
   const stages=ofTournament('stages',t.id,d).sort((a,b)=>a.stage_order-b.stage_order);
   if(stages.length){
     const details=wrap('details','p12-details'),sum=text('summary',`BRACKET & RESULTS · ${stages.length} STAGE${stages.length===1?'':'S'}`);
     details.append(sum);stages.forEach(s=>details.append(stageView(s,d)));card.append(details);
   }
   const updates=ofTournament('updates',t.id,d).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
   if(updates.length){
    const feed=wrap('div','p12-updates');feed.append(text('h4','LATEST UPDATES'));
    for(const u of updates){
     const row=wrap('div','p12-update');
     row.append(text('span',u.kind.toUpperCase(),'p12-kind'),text('strong',u.title),text('small',formattedDate(u.created_at)));
     if(u.body)row.append(text('p',u.body));feed.append(row);
    }
    card.append(feed);
   }
   node.append(card);
  }
 }
 async function loadPublic(){
   try{
     const d=await rpc('vxsk_p12_public_snapshot');
     app.data={...empty,...d};renderPublic();setNotice('vxsk-p12-public-notice','Game Hub synced with verified tournament data.');
   }catch(err){app.data=null;renderPublic();setNotice('vxsk-p12-public-notice','Game Hub is waiting for its secure P12 backend.',true);}
 }
 async function loadStaff(){
   if(!app.referee)return;
   try{app.private={...empty,...await rpc('vxsk_p12_staff_snapshot')};renderStaff();
      setNotice('vxsk-p12-staff-notice','Tournament Control ready. Scores require referee report + Owner approval.');
   }catch(e){setNotice('vxsk-p12-staff-notice','Tournament Control backend unavailable: '+e.message,true);}
 }
 function renderStaff(){
  const d=app.private;if(!d)return;
  const teamSelect=$('p12-team-event'),stageEvent=$('p12-stage-event'),matchStage=$('p12-match-stage');
  const allT=d.tournaments.sort((a,b)=>a.title.localeCompare(b.title));
  for(const id of ['p12-team-event','p12-stage-event','p12-announcement-event','p12-report-event','p12-publish-event']){
   freshSelect($(id),allT,x=>x.id,x=>x.title+' · '+x.game,'SELECT TOURNAMENT');
  }
  freshSelect(matchStage,d.stages,x=>x.id,x=>`${d.tournaments.find(t=>t.id===x.tournament_id)?.title||'Event'} — ${x.name} (${fmt[x.format]})`,'SELECT STAGE');
  const stage=d.stages.find(x=>x.id===matchStage.value);
  const lane=$('p12-bracket-lane');
  if(lane && stage){
    const valid=stage.format==='double'?['winners','losers','grand_final']:['main'];
    for(const opt of lane.options){opt.disabled=!valid.includes(opt.value);opt.hidden=opt.disabled;}
    if(!valid.includes(lane.value))lane.value=valid[0];
  }
  const teams=stage?ofTournament('teams',stage.tournament_id,d):[];
  for(const id of ['p12-match-a','p12-match-b']){
   freshSelect($(id),teams,x=>x.id,x=>x.name,'SELECT TEAM');
  }
  const currentEvent=$('p12-report-event')?.value;
  const matches=ofTournament('matches',currentEvent,d);
  freshSelect($('p12-report-match'),matches,x=>x.id,x=>teamName(d,x.team_a)+' vs '+teamName(d,x.team_b)+' · R'+x.round_no,'SELECT MATCH (FOR SCORE)');
  freshSelect($('p12-live-match'),d.matches.filter(m=>['scheduled','live'].includes(m.state)),
    x=>x.id,x=>teamName(d,x.team_a)+' vs '+teamName(d,x.team_b)+' · '+x.state.toUpperCase(),'SELECT MATCH');
  const reports=$('p12-reports');if(!reports)return;
  reports.replaceChildren();
  const pending=d.reports.filter(x=>x.state==='pending');
  for(const r of pending){
   const row=wrap('article','p12-report');
   const tournament=d.tournaments.find(t=>t.id===r.tournament_id);
   row.append(text('strong',`${r.kind.toUpperCase()} · ${tournament?.title||'Event'}`),
     text('small',r.match_id?`Match: ${teamName(d,d.matches.find(m=>m.id===r.match_id)?.team_a)} vs ${teamName(d,d.matches.find(m=>m.id===r.match_id)?.team_b)}`:'General event report'));
   if(r.kind==='score')row.append(text('p',`PROPOSED SCORE: ${r.score_a} : ${r.score_b}`));
   row.append(text('p',r.notes));
   if(app.owner){
    const actions=wrap('div','p12-report-actions');
    for(const [label,approve] of [['APPROVE',true],['REJECT',false]]){
     const b=text('button',label);b.type='button';b.disabled=r.submitted_by===(app.staffUser||'');
     b.title=b.disabled?'Owner cannot approve their own report':'Owner moderation';
     b.addEventListener('click',async()=>{
      if(!confirm(`${approve?'Approve':'Reject'} this report? ${approve?'Approved scores become public.':''}`))return;
      b.disabled=true;
      try{await rpc('vxsk_p12_decide_report',{p_report:r.id,p_approve:approve});await loadStaff();await loadPublic();}
      catch(e){setNotice('vxsk-p12-staff-notice',e.message,true);b.disabled=false;}
     });actions.append(b);
    }
    row.append(actions);
   }
   reports.append(row);
  }
  if(!pending.length)reports.append(text('p','No pending referee reports.','p12-muted'));
  const activity=$('p12-staff-updates');
  if(activity){
    activity.replaceChildren();
    for(const update of (d.updates||[]).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,35)){
      const tournament=d.tournaments.find(t=>t.id===update.tournament_id);
      const line=wrap('article','p12-control-item');
      line.append(text('strong',`${update.kind.toUpperCase()} · ${update.title}`),
        text('small',`${tournament?.title||'Tournament'} · ${formattedDate(update.created_at)}`));
      if(update.body)line.append(text('p',update.body));
      activity.append(line);
    }
    if(!activity.children.length)activity.append(text('p','No announcements or live updates yet.','p12-muted'));
  }
  const listing=$('p12-staff-events');if(listing){
    listing.replaceChildren();
    for(const t of d.tournaments){
      const line=wrap('div','p12-control-item');
      line.append(text('strong',t.title),text('small',`${t.game} · ${t.status} · ${t.published?'PUBLIC':'DRAFT'} · ${ofTournament('teams',t.id,d).length} entrants`));
      listing.append(line);
    }
    if(!d.tournaments.length)listing.append(text('p','No tournaments yet.','p12-muted'));
  }
  if(!app.owner){
   document.querySelectorAll('[data-p12-owner]').forEach(n=>n.hidden=true);
  }
 }
 function form(id,handler){
  const node=$(id);if(!node)return;
  node.addEventListener('submit',async e=>{
   e.preventDefault();if(!node.reportValidity())return;
   const btn=node.querySelector('[type=submit]');if(btn)btn.disabled=true;
   try{await handler(new FormData(node));node.reset();await loadStaff();await loadPublic();}
   catch(err){setNotice('vxsk-p12-staff-notice',err.message,true);}
   finally{if(btn)btn.disabled=false;}
  });
 }
 const localDate=v=>v?new Date(v).toISOString():null;
 const value=(f,k)=>(f.get(k)||'').toString().trim();
 function showControlTab(tab){
   document.querySelectorAll('[data-p12-tab]').forEach(b=>{
     const active=b.dataset.p12Tab===tab;
     b.classList.toggle('is-active',active);
     b.setAttribute('aria-pressed',String(active));
   });
   document.querySelectorAll('[data-p12-view]').forEach(panel=>panel.hidden=panel.dataset.p12View!==tab);
 }
 function bindStaff(){
   document.querySelectorAll('[data-p12-tab]').forEach(b=>b.addEventListener('click',()=>showControlTab(b.dataset.p12Tab)));
   form('p12-create',async f=>{await rpc('vxsk_p12_create_tournament',{
     p_title:value(f,'title'),p_game:value(f,'game'),p_mode:value(f,'mode'),p_start:localDate(value(f,'start')),
     p_publish:value(f,'publish')==='on'});});
   form('p12-team-create',async f=>{await rpc('vxsk_p12_add_team',{p_tournament:value(f,'event'),p_name:value(f,'name')});});
   form('p12-stage-create',async f=>{await rpc('vxsk_p12_add_stage',{
     p_tournament:value(f,'event'),p_name:value(f,'name'),p_format:value(f,'format'),p_order:Number(value(f,'order'))});});
   form('p12-match-create',async f=>{await rpc('vxsk_p12_add_match',{
     p_stage:value(f,'stage'),p_a:value(f,'a'),p_b:value(f,'b'),p_round:Number(value(f,'round')),
     p_slot:Number(value(f,'slot')),p_bracket:value(f,'bracket'),p_group:value(f,'group'),p_start:localDate(value(f,'start'))});});
   form('p12-announce',async f=>{await rpc('vxsk_p12_announce',{
     p_tournament:value(f,'event'),p_kind:value(f,'kind'),p_title:value(f,'title'),
     p_message:value(f,'message'),p_status:value(f,'status')});});
   form('p12-publish',async f=>{await rpc('vxsk_p12_publish',{p_tournament:value(f,'event'),p_publish:value(f,'publish')==='yes'});});
   form('p12-mark-live',async f=>{await rpc('vxsk_p12_mark_match_live',{
     p_match:value(f,'match'),p_live:value(f,'live')==='yes'});});
   form('p12-report',async f=>{
    const kind=value(f,'kind');await rpc('vxsk_p12_submit_report',{
     p_tournament:value(f,'event'),p_match:value(f,'match')||null,p_kind:kind,
     p_a:kind==='score'?Number(value(f,'score_a')):null,p_b:kind==='score'?Number(value(f,'score_b')):null,
     p_notes:value(f,'notes')
    });
   });
   $('p12-refresh')?.addEventListener('click',loadStaff);
   $('p12-match-stage')?.addEventListener('change',renderStaff);
   $('p12-report-event')?.addEventListener('change',renderStaff);
   $('p12-report-kind')?.addEventListener('change',()=>{
     const score=$('p12-report-score-fields'),isScore=$('p12-report-kind').value==='score';
     if(score)score.hidden=!isScore;
     for(const id of ['p12-report-match','p12-report-a','p12-report-b']){
      const input=$(id);if(input)input.required=isScore;
     }
   });
   $('p12-report-kind')?.dispatchEvent(new Event('change'));
 }
 function startPublic(){
  if(!$('vxsk-p12-public'))return;
  for(const id of ['vxsk-p12-game','vxsk-p12-status-filter'])$(id)?.addEventListener('change',renderPublic);
  $('vxsk-p12-refresh')?.addEventListener('click',loadPublic);
  const cfg=window.VXSK_SUPABASE||{};
  if(window.VXSK_STAGING_BLOCKED||!window.supabase?.createClient||!cfg.url||!cfg.publishableKey){
   setNotice('vxsk-p12-public-notice','Game Hub configuration unavailable.',true);return;
  }
  app.api=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  loadPublic();
  window.setInterval(()=>{
    const panel=document.querySelector('[data-arena-panel="p12"]');
    if(!document.hidden && panel && !panel.hidden)void loadPublic();
  },60000);
 }
 function startStaff(){
  if(!$('vxsk-p12-staff'))return;
  bindStaff();
  window.addEventListener('vxsk:staff-ready',async({detail})=>{
    const api=window.VXSK_STAFF_API;
    if(!api||!['owner','reviewer','staff'].includes(detail?.role))return;
    const {data:a,error:err}=await api.auth.mfa.getAuthenticatorAssuranceLevel();
    if(err||a?.currentLevel!=='aal2')return setNotice('vxsk-p12-staff-notice','Sign in with 2FA to access tournament controls.',true);
    app.api=api;
    const [owner,referee,user]=await Promise.all([
     api.rpc('vxsk_p12_owner_ok'),api.rpc('vxsk_p12_referee_ok'),api.auth.getUser()
    ]);
    app.owner=!owner.error&&owner.data===true;
    app.referee=!referee.error&&referee.data===true;
    app.staffUser=user.data?.user?.id||'';
    if(!app.referee)return setNotice('vxsk-p12-staff-notice','No referee permission on this account.',true);
    document.querySelectorAll('[data-p12-referee]').forEach(n=>n.hidden=false);
    document.querySelectorAll('[data-p12-owner]').forEach(n=>n.hidden=!app.owner);
    showControlTab(app.owner?'setup':'referee');
    await loadStaff();
  });
 }
 if($('vxsk-p12-public'))startPublic();
 if($('vxsk-p12-staff'))startStaff();
})();
