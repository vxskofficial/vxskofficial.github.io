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
 const teamName=(d,id)=>id ? (d.teams.find(x=>x.id===id)?.name||'Unknown team') : 'TBD';
 function roundTitle(round,total){
  if(round===total)return 'FINAL';
  if(round===total-1)return 'SEMIFINAL';
  if(round===total-2)return 'QUARTERFINAL';
  return 'ROUND OF '+(2 ** (total-round+1));
 }
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
 function matchCard(m,d,admin=false){
  const n=wrap('article','p12-match');
  const a=wrap('div','p12-match-side'),b=wrap('div','p12-match-side');
  const scoreSet=m.score_a!=null&&m.score_b!=null;
  a.append(text('strong',teamName(d,m.team_a)),text('b',scoreSet?m.score_a:'—'));
  b.append(text('strong',teamName(d,m.team_b)),text('b',scoreSet?m.score_b:'—'));
  const winner=m.state==='bye'?(m.team_a||m.team_b):
    (scoreSet&&m.state==='completed'?(m.score_a>m.score_b?m.team_a:(m.score_b>m.score_a?m.team_b:null)):null);
  if(winner&&winner===m.team_a)a.classList.add('p12-winner');
  if(winner&&winner===m.team_b)b.classList.add('p12-winner');
  const cap=wrap('small','p12-match-caption');
  const status=m.state==='bye'?'BYE · AUTO ADVANCED':
    m.state==='waiting'?'WAITING FOR PREVIOUS WINNERS':m.state.toUpperCase();
  cap.textContent=`${status} · ${formattedDate(m.starts_at)}`;
  n.append(a,b,cap);

  if(admin&&app.owner&&['scheduled','live'].includes(m.state)){
    const controls=wrap('form','p12-score-entry');
    const aLabel=wrap('label');aLabel.append(text('span','TEAM A SCORE'));
    const aInput=document.createElement('input');aInput.type='number';aInput.min='0';aInput.max='99';aInput.step='1';aInput.required=true;aInput.setAttribute('aria-label','Team A score');
    aLabel.append(aInput);
    const bLabel=wrap('label');bLabel.append(text('span','TEAM B SCORE'));
    const bInput=document.createElement('input');bInput.type='number';bInput.min='0';bInput.max='99';bInput.step='1';bInput.required=true;bInput.setAttribute('aria-label','Team B score');
    bLabel.append(bInput);
    const save=text('button','SAVE SCORE & ADVANCE');save.type='submit';
    controls.append(aLabel,bLabel,save);
    controls.addEventListener('submit',async e=>{
      e.preventDefault();
      if(aInput.value===''||bInput.value===''){
        setNotice('vxsk-p12-staff-notice','Enter both team scores.',true);return;
      }
      const scoreA=Number(aInput.value),scoreB=Number(bInput.value);
      if(!Number.isInteger(scoreA)||!Number.isInteger(scoreB)||scoreA<0||scoreB<0||scoreA>99||scoreB>99){
        setNotice('vxsk-p12-staff-notice','Enter both scores from 0 to 99.',true);return;
      }
      if(scoreA===scoreB){
        setNotice('vxsk-p12-staff-notice','Single-elimination matches need a winner. Scores cannot be tied.',true);return;
      }
      if(!confirm(`Save ${teamName(d,m.team_a)} ${scoreA} - ${scoreB} ${teamName(d,m.team_b)}? The winner advances and this result is locked.`))return;
      save.disabled=true;
      try{
        await rpc('vxsk_p12_owner_record_score',{p_match:m.id,p_score_a:scoreA,p_score_b:scoreB});
        await loadStaff();await loadPublic();
        setNotice('vxsk-p12-staff-notice','Score saved. Winner advanced to the next round.');
      }catch(err){setNotice('vxsk-p12-staff-notice',err.message||'Could not save score.',true);save.disabled=false;}
    });
    n.append(controls);
  }
  return n;
 }
 function stageView(stage,d,admin=false){
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
    col.append(text('h6',roundTitle(round,roundNos.length)));
    list.filter(x=>x.round_no===round).sort((a,b)=>a.slot-b.slot).forEach(x=>col.append(matchCard(x,d,admin)));
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
 function renderAdminBracket(){
  const node=$('p12-admin-bracket'),select=$('p12-bracket-event');
  if(!node||!select)return;
  node.replaceChildren();
  const d=app.private,t=d?.tournaments.find(x=>x.id===select.value);
  if(!t){node.append(text('p','Select a tournament to view its bracket.','p12-muted'));return;}
  const stages=ofTournament('stages',t.id,d).filter(s=>s.format==='single').sort((a,b)=>a.stage_order-b.stage_order);
  if(!stages.length){node.append(text('p','No bracket yet. Add the teams and generate the bracket in the Create tab.','p12-muted'));return;}
  stages.forEach(s=>node.append(stageView(s,d,true)));
 }
 function renderStaff(){
  const d=app.private;if(!d)return;
  const allT=d.tournaments.slice().sort((a,b)=>a.title.localeCompare(b.title));
  const buildSelect=$('p12-bracket-build-event'),bracketSelect=$('p12-bracket-event');
  freshSelect(buildSelect,allT,x=>x.id,x=>x.title+' · '+x.game,'SELECT TOURNAMENT');
  freshSelect(bracketSelect,allT,x=>x.id,x=>x.title+' · '+x.game,'SELECT TOURNAMENT');
  if(app.focusTournamentId&&allT.some(t=>t.id===app.focusTournamentId)){
    if(buildSelect)buildSelect.value=app.focusTournamentId;
    if(bracketSelect)bracketSelect.value=app.focusTournamentId;
    app.focusTournamentId=null;
  }
  const currentEvent=$('p12-report-event')?.value;
  freshSelect($('p12-report-event'),allT,x=>x.id,x=>x.title+' · '+x.game,'SELECT TOURNAMENT');
  const selectedReportEvent=$('p12-report-event')?.value||currentEvent;
  const matches=ofTournament('matches',selectedReportEvent,d)
    .filter(m=>['scheduled','live'].includes(m.state)&&m.team_a&&m.team_b);
  freshSelect($('p12-report-match'),matches,x=>x.id,
    x=>teamName(d,x.team_a)+' vs '+teamName(d,x.team_b)+' · '+roundTitle(x.round_no,
      Math.max(1,...ofTournament('matches',x.tournament_id,d).map(m=>m.round_no))),
    'SELECT READY MATCH');
  const reports=$('p12-reports');
  if(reports){
    reports.replaceChildren();
    const pending=d.reports.filter(x=>x.state==='pending');
    for(const r of pending){
      const row=wrap('article','p12-report');
      const tournament=d.tournaments.find(t=>t.id===r.tournament_id);
      const match=d.matches.find(m=>m.id===r.match_id);
      row.append(text('strong',`${r.kind.toUpperCase()} · ${tournament?.title||'Event'}`),
        text('small',match?`Match: ${teamName(d,match.team_a)} vs ${teamName(d,match.team_b)}`:'General event report'));
      if(r.kind==='score')row.append(text('p',`PROPOSED SCORE: ${r.score_a} : ${r.score_b}`));
      row.append(text('p',r.notes));
      if(app.owner){
        const actions=wrap('div','p12-report-actions');
        for(const [actionLabel,approve] of [['APPROVE',true],['REJECT',false]]){
          const button=text('button',actionLabel);button.type='button';
          button.disabled=r.submitted_by===(app.staffUser||'');
          button.title=button.disabled?'The report author cannot decide their own report':'Owner moderation';
          button.addEventListener('click',async()=>{
            if(!confirm(`${approve?'Approve':'Reject'} this report?${approve?' The winner will advance to the next round.':''}`))return;
            button.disabled=true;
            try{
              await rpc('vxsk_p12_decide_report',{p_report:r.id,p_approve:approve});
              await loadStaff();await loadPublic();
              setNotice('vxsk-p12-staff-notice',approve?'Report approved. Winner advanced.':'Report rejected.');
            }catch(e){setNotice('vxsk-p12-staff-notice',e.message,true);button.disabled=false;}
          });
          actions.append(button);
        }
        row.append(actions);
      }
      reports.append(row);
    }
    if(!pending.length)reports.append(text('p','No pending reports.','p12-muted'));
  }
  renderAdminBracket();
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
   form('p12-create',async f=>{
     const id=await rpc('vxsk_p12_create_tournament',{
       p_title:value(f,'title'),p_game:value(f,'game'),p_mode:value(f,'mode'),
       p_start:localDate(value(f,'start')),p_publish:false
     });
     app.focusTournamentId=id;
     setNotice('vxsk-p12-staff-notice','Tournament created. Add the team names below to generate its bracket.');
   });
   form('p12-build-bracket',async f=>{
     const tournament=value(f,'event');
     const names=value(f,'teams').split(/\r?\n/).map(n=>n.trim()).filter(Boolean);
     if(names.length<2||names.length>64)throw Error('Add between 2 and 64 teams, one team per line.');
     await rpc('vxsk_p12_generate_single_bracket',{
       p_tournament:tournament,
       p_team_names:names,
       p_shuffle:value(f,'shuffle')==='on',
       p_publish:value(f,'publish')==='on'
     });
     app.focusTournamentId=tournament;
     setNotice('vxsk-p12-staff-notice','Bracket generated successfully. You can now enter scores in Bracket & Scores.');
   });
   form('p12-report',async f=>{
     const scoreA=Number(value(f,'score_a')),scoreB=Number(value(f,'score_b'));
     if(scoreA===scoreB)throw Error('Single-elimination scores cannot be tied.');
     await rpc('vxsk_p12_submit_report',{
       p_tournament:value(f,'event'),p_match:value(f,'match'),
       p_kind:'score',p_a:scoreA,p_b:scoreB,p_notes:value(f,'notes')
     });
   });
   $('p12-refresh')?.addEventListener('click',loadStaff);
   $('p12-bracket-event')?.addEventListener('change',renderAdminBracket);
   $('p12-report-event')?.addEventListener('change',renderStaff);
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
    document.querySelectorAll('[data-p12-referee]').forEach(n=>n.hidden=app.owner);
    document.querySelectorAll('[data-p12-owner]').forEach(n=>n.hidden=!app.owner);
    showControlTab(app.owner?'setup':'referee');
    await loadStaff();
  });
 }
 if($('vxsk-p12-public'))startPublic();
 if($('vxsk-p12-staff'))startStaff();
})();
