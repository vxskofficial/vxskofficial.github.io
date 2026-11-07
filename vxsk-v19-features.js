/* VXSK V19. The existing tournament registry remains the only event source.
 * Stage fixtures and approvals come exclusively from owner/referee MFA-checked RPCs.
 * Read-only public bracket; mobile scroll stays inside bracket container. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const node=(tag,t,cls)=>{const n=document.createElement(tag);if(t!==undefined&&t!==null)n.textContent=String(t);if(cls)n.className=cls;return n;};
 const options=(select,items,placeholder)=>{select.replaceChildren();if(placeholder){const o=node('option',placeholder);o.value='';select.append(o)}for(const [v,label] of items){const o=node('option',label);o.value=String(v);select.append(o)}};
 const names={single:'Single Elimination',double:'Double Elimination',groups:'Group Stage',swiss:'Swiss Stage',groups_knockout:'Groups → Knockout',swiss_knockout:'Swiss → Knockout',playin_groups_knockout:'Play-In → Groups → Knockout',playin_swiss_knockout:'Play-In → Swiss → Knockout'};
 let api,staff=false,owner=false,staffData=null,stageData=null,teams=[],publicData=null,mutating=false;
 function client(){if(api)return api;
  if(window.VXSKAuth?.client){api=window.VXSKAuth.client;return api;}
  const cfg=window.VXSK_SUPABASE;
  if(!window.supabase?.createClient||!cfg?.url||!cfg?.publishableKey)throw Error('VXSK Supabase unavailable');
  api=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});return api;
 }
 async function rpc(name,params={}){const {data,error}=await client().rpc(name,params);if(error)throw Error(error.message||'Request failed');return data;}
 function notice(msg,error=false){const el=$('v19-staff-status');if(el){el.textContent=msg;el.dataset.error=error?'1':'0'}else console.info('VXSK',msg)}
 const teamName=id=>teams.find(t=>t.id===id)?.name||'TBD';
 const phaseMatches=(d,p)=>d.fixtures.filter(f=>f.phase_id===p.id);
 function matchCard(m){
  const card=node('div',null,'v19-match');const cap=node('small',`${String(m.lane).toUpperCase()} · MATCH ${m.slot} · ${m.state.toUpperCase()}`);card.append(cap);
  const winner=m.state==='completed'?(m.score_a>m.score_b?m.team_a:m.team_b):m.state==='bye'?m.team_a:null;
  for(let side=0;side<2;side++){
   const id=side?m.team_b:m.team_a;const line=node('div',null,'v19-match-line');if(id&&id===winner)line.classList.add('is-winner');
   line.append(node('span',teamName(id).charAt(0)||'•','logo'),node('span',id?teamName(id):m.state==='bye'?'BYE':'TBD','name'),node('b',m.state==='completed'?side?m.score_b:m.score_a:m.state==='bye'?'—':'–','score'));card.append(line);
  }return card;
 }
 function bracket(phases,fixtures){const scroll=node('div',null,'v19-bracket-scroller');scroll.tabIndex=0;
  scroll.setAttribute('aria-label','Tournament bracket: swipe horizontally to view all rounds');
  const board=node('div',null,'v19-bracket');const rounds=[...new Set(fixtures.map(f=>f.round_no))].sort((a,b)=>a-b);
  for(const round of rounds){const col=node('section',null,'v19-bracket-col');col.append(node('h5',`ROUND ${round}`));
   fixtures.filter(f=>f.round_no===round).sort((a,b)=>a.slot-b.slot).forEach(f=>col.append(matchCard(f)));board.append(col);
  }scroll.append(board);return scroll;
 }
 function standingsView(fixtures){const holder=node('div',null,'v19-mini-scroll');
  const map=new Map();for(const m of fixtures){for(const side of [0,1]){const id=side?m.team_b:m.team_a;if(!id)continue;
    const x=map.get(id)||{id,group:m.group_no||0,wins:0,losses:0,played:0,diff:0};
    if(m.state==='completed'){const a=side?m.score_b:m.score_a,b=side?m.score_a:m.score_b;x.played++;x.wins+=a>b?1:0;x.losses+=a<b?1:0;x.diff+=a-b;}
    if(m.state==='bye'&&!side)x.wins++;map.set(id,x);
  }}
  const t=node('table',null,'v19-standings');const thead=node('thead');const tr=node('tr');['#','TEAM','W','L','DIFF'].forEach(k=>tr.append(node('th',k)));thead.append(tr);t.append(thead);
  const groups=[...new Set([...map.values()].map(x=>x.group))].sort((a,b)=>a-b);
  for(const group of groups){const rows=[...map.values()].filter(x=>x.group===group).sort((a,b)=>b.wins-a.wins||b.diff-a.diff||teamName(a.id).localeCompare(teamName(b.id)));
   const head=node('tr');const td=node('th',group?'GROUP '+String.fromCharCode(64+group):'SWISS STANDINGS');td.colSpan=5;head.append(td);t.append(head);
   rows.forEach((x,i)=>{const row=node('tr');[i+1,teamName(x.id),x.wins,x.losses,x.diff].forEach(v=>row.append(node('td',v)));t.append(row)});
  }holder.append(t);return holder;
 }
 function phaseUI(data,id){const panel=node('div',null,'v19-format-content');const stages=data.phases.filter(x=>x.tournament_id===id).sort((a,b)=>a.seq-b.seq);
  const conf=data.formats.find(x=>x.tournament_id===id);
  if(!stages.length)return panel;
  panel.append(node('h4',names[conf?.format]||'Tournament stages'));
  const flow=node('div',null,'v19-flow');stages.forEach(s=>flow.append(node('span',`${s.seq}. ${s.kind.toUpperCase()} · ${s.state}`)));panel.append(flow);
  stages.forEach(stage=>{const section=node('section',null,'v19-stage');section.append(node('h4',`${stage.seq}. ${stage.kind.toUpperCase()} · ${stage.state.toUpperCase()}`));
    const fixtures=phaseMatches(data,stage);
    if(!fixtures.length)section.append(node('p','Awaiting qualification from previous stage.','v19-muted'));
    else {if(['groups','swiss'].includes(stage.kind))section.append(standingsView(fixtures));
     section.append(bracket(stages,fixtures));}
    panel.append(section);
  });return panel;
 }
 async function loadPublic(){if(!$('vxsk-p12-list'))return;
   try{const [data,existing]=await Promise.all([rpc('vxsk_v19_public_fixtures'),rpc('vxsk_p12_public_snapshot')]);
    publicData=data;teams=existing?.teams||[];renderPublic();
   }catch(e){console.warn('VXSK V19 tournament stages',e.message);}
 }
 function renderPublic(){if(!publicData)return;
   for(const card of document.querySelectorAll('.p12-event-card[data-tournament-id]')){
     const id=card.dataset.tournamentId,pane=card.querySelector('.p12-v15-pane[data-section="Brackets"]');if(!pane)continue;
     const phases=publicData.phases.filter(x=>x.tournament_id===id);if(!phases.length)continue;
     if(pane.querySelector('.v19-format-content'))continue;
     pane.append(phaseUI(publicData,id));
     const matchTab=card.querySelector('.p12-v15-pane[data-section="Matches"]');
     if(matchTab){if(matchTab.querySelector('.v19-format-matches'))continue;
       const section=node('div',null,'v19-format-matches');section.append(node('h4','ALL STAGE MATCHES'));
       for(const ph of phases){section.append(node('h5',ph.kind.toUpperCase()));
         const matches=phaseMatches(publicData,ph);if(matches.length)section.append(bracket(phases,matches));}
       matchTab.append(section);
     }
   }
 }
 function formMarkup(){const box=node('details',null,'v19-panel');box.id='v19-format-staff';
  box.innerHTML=`<summary class="v19-summary">ADVANCED FORMATS, SCORES & TEAM REQUESTS <span>⌄</span></summary><h3>TOURNAMENT FORMATS · 16–64</h3>
   <p>Uses the existing tournament and approved entrants. Owner + MFA only. Stage changes are permanent once matches begin.</p>
   <div class="v19-controls"><label>TOURNAMENT<select id="v19-tournament"></select></label>
   <label>FORMAT<select id="v19-format"></select></label>
   <label>MAX SLOTS<select id="v19-capacity"></select></label>
   <label>KNOCKOUT QUALIFIERS<select id="v19-qualifiers"><option value="8">Top 8</option><option value="16">Top 16</option><option value="32">Top 32</option></select></label></div>
   <div class="v19-controls"><button type="button" id="v19-save-format">SAVE FORMAT</button><button type="button" id="v19-start-format">GENERATE VERIFIED STAGES</button></div>
   <p class="v19-muted">Minimum 16 approved players/teams to generate. Existing Single Elimination bracket cannot be converted after generation.</p>
   <p class="v19-status" id="v19-staff-status" role="status"></p>
   <div id="v19-staff-fixtures"></div>
   <h3>REFEREE SCORE REPORTS</h3><div class="v19-controls">
   <label>MATCH<select id="v19-score-fixture"></select></label><label>SCORE A<input id="v19-score-a" type="number" min="0" max="99" required></label>
   <label>SCORE B<input id="v19-score-b" type="number" min="0" max="99" required></label>
   <label>NOTES<input id="v19-score-notes" type="text" maxlength="800" placeholder="Evidence / verified result"></label></div>
   <button class="v19-action" id="v19-submit-score" type="button">SUBMIT FOR OWNER APPROVAL</button>
   <button class="v19-action" id="v19-owner-direct-score" type="button" hidden>OWNER · RECORD VERIFIED SCORE DIRECTLY</button>
   <div id="v19-score-queue"></div>
   <div id="v19-owner-correction" hidden>
    <h3>OWNER · EDIT / RESET VERIFIED RESULT</h3>
    <div class="v19-controls"><label>COMPLETED MATCH<select id="v19-correct-fixture"></select></label>
    <label>NEW SCORE A<input id="v19-correct-a" type="number" min="0" max="99"></label>
    <label>NEW SCORE B<input id="v19-correct-b" type="number" min="0" max="99"></label>
    <label>REASON (8+ characters)<input id="v19-correct-reason" maxlength="300" placeholder="Document the error"></label></div>
    <div class="v19-report-actions"><button type="button" id="v19-edit-result">EDIT RESULT</button>
    <button type="button" id="v19-reset-result">RESET RESULT</button></div>
    <p class="v19-muted">If the next round started, corrections are blocked rather than damaging verified bracket results.</p>
   </div>
   <div id="v19-team-review"></div>`;
  options(box.querySelector('#v19-format'),Object.entries(names));
  options(box.querySelector('#v19-capacity'),Array.from({length:49},(_,i)=>[i+16,String(i+16)]));
  return box;
 }
 async function loadStaff(){
  if(!$('v19-format-staff')||!staff)return;
  const previous=$('v19-tournament')?.value;
  try{const [d,existing,requests]=await Promise.all([rpc('vxsk_v19_staff_snapshot'),rpc('vxsk_p12_staff_snapshot'),rpc('vxsk_v19_staff_team_requests')]);
   stageData=d;staffData=existing;teams=existing?.teams||[];
   options($('v19-tournament'),existing.tournaments.map(x=>[x.id,x.title+' · '+x.game]),'SELECT TOURNAMENT');
   const current=(existing.tournaments.some(x=>x.id===previous)?previous:null)||existing.tournaments[0]?.id;
   if(current)$('v19-tournament').value=current;
   showStageStaff(current); renderTeamRequests(requests);
   if(owner)renderScoreQueue(await rpc('vxsk_v19_pending_scores'));
   notice('Advanced tournament backend connected. Only confirmed scores affect rankings.');
  }catch(e){notice('Could not refresh format controls: '+e.message,true)}
 }
 function showStageStaff(eventId){const root=$('v19-staff-fixtures');if(!root||!stageData)return;root.replaceChildren();
  const conf=stageData.formats.find(x=>x.tournament_id===eventId);
  if(conf)root.append(node('p',`Saved configuration: ${names[conf.format]} · max ${conf.slots} slots`));
  root.append(phaseUI(stageData,eventId));
  const available=stageData.fixtures.filter(f=>{
   const p=stageData.phases.find(x=>x.id===f.phase_id);return p?.tournament_id===eventId&&f.state==='scheduled';
  });
  options($('v19-score-fixture'),available.map(x=>[x.id,`${teamName(x.team_a)} vs ${teamName(x.team_b)} — R${x.round_no}`]),'SELECT MATCH');
  const completed=stageData.fixtures.filter(f=>{const p=stageData.phases.find(x=>x.id===f.phase_id);return p?.tournament_id===eventId&&f.state==='completed';});
  options($('v19-correct-fixture'),completed.map(x=>[x.id,`${teamName(x.team_a)} ${x.score_a} : ${x.score_b} ${teamName(x.team_b)}`]),'SELECT COMPLETED MATCH');
 }
 function renderTeamRequests(rows){const root=$('v19-team-review');if(!root)return;root.replaceChildren(node('h3','TEAM JOIN REQUESTS'));
  if(!rows?.length)return root.append(node('p','No pending team requests.','v19-muted'));
  for(const r of rows){const item=node('div',null,'v19-report-row');item.append(node('strong',`${r.player_name} → ${r.team_name}`));
   const actions=node('div',null,'v19-report-actions');for(const [answer,title] of [[true,'APPROVE'],[false,'REJECT']]){
    const b=node('button',title);b.type='button';b.addEventListener('click',async()=>{b.disabled=true;
     try{await rpc('vxsk_v19_review_team_join',{p_user:r.user_id,p_accept:answer});await loadStaff();}
     catch(e){notice(e.message,true);b.disabled=false;}});actions.append(b);}
   item.append(actions);root.append(item);
  }
 }
 function renderScoreQueue(rows){const root=$('v19-score-queue');if(!root)return;root.replaceChildren(node('h3','OWNER SCORE APPROVALS'));
  if(!rows?.length)return root.append(node('p','No pending reports.','v19-muted'));
  for(const r of rows){const item=node('div',null,'v19-report-row');item.append(node('strong',`${teamName(r.team_a)} ${r.score_a} — ${r.score_b} ${teamName(r.team_b)}`),node('small',r.notes));
   const buttons=node('div',null,'v19-report-actions');for(const [decision,title] of [[true,'CONFIRM'],[false,'REJECT']]){
    const b=node('button',title);b.type='button';b.addEventListener('click',async()=>{b.disabled=true;
      try{await rpc('vxsk_v19_review_score',{p_report:r.id,p_approve:decision});await loadStaff();}
      catch(e){notice(e.message,true);b.disabled=false;}});buttons.append(b);}
   item.append(buttons);root.append(item);
  }
 }
 function attachControls(){const target=$('vxsk-p12-staff');if(!target||$('v19-format-staff'))return;
  const box=formMarkup();target.append(box);
  $('v19-tournament').addEventListener('change',e=>showStageStaff(e.target.value));
  $('v19-owner-correction').hidden=!owner;
  $('v19-owner-direct-score').hidden=!owner;
  async function correction(action){
    if(!owner)return notice('Owner MFA required.',true);
    const p_fixture=$('v19-correct-fixture').value,p_reason=$('v19-correct-reason').value.trim();
    const rawA=$('v19-correct-a').value,rawB=$('v19-correct-b').value;
    if(!p_fixture||p_reason.length<8|| (action==='edit'&&(!rawA||!rawB)))
       return notice('Choose a result, reason (8+ chars), and corrected scores for EDIT.',true);
    if(!confirm(action==='reset'?'Reset this verified result?':'Replace the verified score?'))return;
    try{await rpc('vxsk_v19_correct_result',{p_fixture,p_action:action,p_a:action==='edit'?Number(rawA):null,p_b:action==='edit'?Number(rawB):null,p_reason});
       await loadStaff();notice('Owner '+action+' saved with audit.');}
    catch(e){notice(e.message,true);}
  }
  $('v19-edit-result').addEventListener('click',()=>void correction('edit'));
  $('v19-reset-result').addEventListener('click',()=>void correction('reset'));
  $('v19-save-format').addEventListener('click',async()=>{
   const id=$('v19-tournament').value,format=$('v19-format').value,slots=Number($('v19-capacity').value),qual=Number($('v19-qualifiers').value);
   if(!id)return notice('Select a tournament first.',true);if(!owner)return notice('Owner MFA required.',true);
   try{await rpc('vxsk_v19_set_format',{p_tournament:id,p_format:format,p_slots:slots,p_knockout_slots:qual});await loadStaff();notice('Format saved for tournament.');}
   catch(e){notice(e.message,true);}
  });
  $('v19-start-format').addEventListener('click',async()=>{
   const id=$('v19-tournament').value;
   if(!id||!owner)return notice('Owner MFA and tournament selection required.',true);
   if(!confirm('Generate this format from approved participants? This locks its stages.'))return;
   try{const total=await rpc('vxsk_v19_start_format',{p_tournament:id});await loadStaff();notice('Generated with '+total+' approved participants.');}
   catch(e){notice(e.message,true);}
  });
  $('v19-owner-direct-score').addEventListener('click',async()=>{
   if(!owner)return notice('Owner MFA required.',true);
   const p_fixture=$('v19-score-fixture').value,rawA=$('v19-score-a').value,rawB=$('v19-score-b').value;
   const p_reason=$('v19-score-notes').value.trim();
   if(!p_fixture||rawA===''||rawB===''||p_reason.length<8)return notice('Choose match, scores and evidence notes.',true);
   if(!confirm('Record this official result and advance winners?'))return;
   try{await rpc('vxsk_v19_owner_score',{p_fixture,p_a:Number(rawA),p_b:Number(rawB),p_reason});
      await loadStaff();notice('Official score saved and bracket updated.');}
   catch(e){notice(e.message,true);}
  });
  $('v19-submit-score').addEventListener('click',async()=>{
   const fixture=$('v19-score-fixture').value,rawA=$('v19-score-a').value,rawB=$('v19-score-b').value,a=Number(rawA),b=Number(rawB),notes=$('v19-score-notes').value.trim();
   if(!fixture||rawA===''||rawB===''||!Number.isInteger(a)||!Number.isInteger(b)||a===b||notes.length<8)return notice('Choose a match, decisive scores and evidence notes (8+ chars).',true);
   try{await rpc('vxsk_v19_submit_score',{p_fixture:fixture,p_a:a,p_b:b,p_note:notes});await loadStaff();notice('Result submitted to Owner review.');}
   catch(e){notice(e.message,true);}
  });
 }
 async function startStaff(e){const detail=e?.detail||{};if(!detail.role||!['owner','reviewer'].includes(detail.role))return;
  api=window.VXSK_STAFF_API||client();staff=true;owner=detail.role==='owner';
  attachControls();if($('v19-format-staff')){
   if(!owner){$('v19-save-format').disabled=true;$('v19-start-format').disabled=true;}
   await loadStaff();
  }
 }
 function startPublic(){let queued=false;const root=$('vxsk-p12-list');if(!root)return;
  const obs=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;renderPublic();});});
  obs.observe(root,{childList:true,subtree:true});
  void loadPublic();
  $('vxsk-p12-refresh')?.addEventListener('click',()=>setTimeout(loadPublic,400));
 }
 function start(){if($('vxsk-p12-list'))startPublic();
  if($('vxsk-p12-staff'))window.addEventListener('vxsk:staff-ready',e=>void startStaff(e));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
