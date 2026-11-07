/* VXSK P12 Game Hub — public viewer + protected tournament control.
   Never writes tables directly. All writes require authenticated Owner/Referee + MFA in RPCs. */
'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const fmt={single:'Single Elimination',double:'Double Elimination',groups:'Group Stage',swiss:'Swiss Stage'};
 const games=['Rocket League','VALORANT','League of Legends'];
 const gameModes={'Rocket League':['1v1','2v2','3v3'],'VALORANT':['1v1','2v2','5v5'],'League of Legends':['1v1','2v2','5v5']};
 const teamSize=mode=>{const n=Number(String(mode||'').split('v')[0]);return Number.isInteger(n)&&n>=1&&n<=5?n:1;};
 const app={data:null,private:null,api:null,role:'',owner:false,referee:false,myEntries:[],user:null,entries:[],publicRoster:[]};
 const empty={tournaments:[],teams:[],stages:[],matches:[],updates:[],reports:[]};
 const text=(tag,value,cls='')=>{const n=document.createElement(tag);n.textContent=String(value??'');if(cls)n.className=cls;return n;};
 const option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;};
 const wrap=(tag,cls='')=>{const n=document.createElement(tag);n.className=cls;return n;};
 const label=t=>t||'—';
 function mergeDetails(data,details){
  if(!data||!Array.isArray(details))return data;
  const map=new Map(details.map(x=>[x.id,x]));
  return {...data,tournaments:(data.tournaments||[]).map(t=>({...t,...(map.get(t.id)||{})}))};
 }
 function publicPoster(path){
  if(!path || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|png|jpg)$/.test(path))return '';
  const response=app.api?.storage.from('vxsk-tournament-covers').getPublicUrl(path);
  return response?.data?.publicUrl||'';
 }
 async function uploadPoster(tournament,file){
  if(!file||!file.size)return '';
  const kinds={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  const ext=kinds[file.type];
  if(!ext||file.size>3145728)throw Error('Poster must be JPG/PNG/WEBP, maximum 3 MB.');
  if(!app.staffUser)throw Error('Owner session required for poster upload.');
  const path=`${app.staffUser}/${tournament}/${crypto.randomUUID()}.${ext}`;
  const {error}=await app.api.storage.from('vxsk-tournament-covers')
   .upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
  if(error)throw Error('Poster upload failed: '+error.message);
  return path;
 }

 const safeStream=t=>{
  const found=String(t.stream_url||'').trim() || (String(t.description||'').match(/https:\/\/(?:www\.)?(?:kick\.com|youtube\.com|youtu\.be|twitch\.tv)\/[^\s<>()]+/i)||[])[0] || '';
  try{const u=new URL(found);if(u.protocol!=='https:')return '';
    if(!['kick.com','www.kick.com','youtube.com','www.youtube.com','youtu.be','twitch.tv','www.twitch.tv'].includes(u.hostname))return '';
    return u.href;
  }catch{return ''}
 };
 const streamEmbed=url=>{
  if(!url)return '';
  try{const u=new URL(url);if(['kick.com','www.kick.com'].includes(u.hostname)){
    const channel=u.pathname.split('/').filter(Boolean)[0];
    if(channel&&/^[a-z0-9_-]{2,32}$/i.test(channel))return 'https://player.kick.com/'+channel+'?autoplay=false';
  }
  if(['youtube.com','www.youtube.com'].includes(u.hostname)){
    const v=u.searchParams.get('v');if(v&&/^[\w-]{11}$/.test(v))return 'https://www.youtube-nocookie.com/embed/'+v;
  }
  if(u.hostname==='youtu.be'){const v=u.pathname.slice(1);if(/^[\w-]{11}$/.test(v))return 'https://www.youtube-nocookie.com/embed/'+v;}
  }catch{}return '';
 };
 const countdown=(t,n)=>{
   const start=new Date(t.starts_at).getTime(),end=new Date(t.ends_at).getTime(),now=Date.now();
   if(!Number.isFinite(start)||!Number.isFinite(end)){n.textContent='SCHEDULE TO BE ANNOUNCED';return;}
   if(now>=end){n.textContent='TOURNAMENT ENDED';return;}
   const future=now<start,remaining=(future?start:end)-now;
   const days=Math.floor(remaining/86400000),hours=Math.floor(remaining%86400000/3600000),mins=Math.floor(remaining%3600000/60000),secs=Math.floor(remaining%60000/1000);
   n.textContent=(future?'STARTS IN ':'ENDS IN ')+`${days}d ${String(hours).padStart(2,'0')}h ${String(mins).padStart(2,'0')}m ${String(secs).padStart(2,'0')}s`;
 };
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
 const flagEmoji=code=>/^[A-Z]{2}$/.test(code||'')?String.fromCodePoint(...[...code].map(ch=>127397+ch.charCodeAt(0))):'🏁';
 const teamCountry=id=>app.publicRoster.find(x=>x.team_id===id)?.country_code||'';
 const visibleBadge=id=>{const code=teamCountry(id);return code?flagEmoji(code):'⚔';};
 const sizeForTournament=t=>{const first=(app.data?.matches||[]).filter(m=>m.tournament_id===t.id&&m.round_no===1).length;return Math.max(2,first*2);};
 function countrySelect(){
  const sel=wrap('select','p12-country-select');sel.required=true;sel.name='country_code';sel.setAttribute('aria-label','Select your country');
  sel.append(option('','🌍 Select your country'));
  for(const pair of (window.VXSK_COUNTRIES||[]))sel.append(option(pair[0],`${flagEmoji(pair[0])} ${pair[1]}`));
  return sel;
 }

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
        await rpc('vxsk_p12_record_score',{p_match:m.id,p_score_a:scoreA,p_score_b:scoreB});
        await loadStaff();await loadPublic();
        setNotice('vxsk-p12-staff-notice','Score saved. Winner advances when the paired result is confirmed.');
      }catch(err){setNotice('vxsk-p12-staff-notice',err.message||'Could not save score.',true);save.disabled=false;}
    });
    n.append(controls);
  }
  if(admin&&app.owner&&m.state==='completed'){
    const actions=wrap('div','vxsk-result-correct');
    const edit=text('button','EDIT SCORE');edit.type='button';
    const reset=text('button','RESET SCORE');reset.type='button';
    for(const [button,mode] of [[edit,'edit'],[reset,'reset']])button.addEventListener('click',async()=>{
      const reason=prompt('Owner correction reason (at least 8 characters):');
      if(reason===null)return;
      if(reason.trim().length<8){setNotice('vxsk-p12-staff-notice','Please give a correction reason of at least 8 characters.',true);return;}
      let a=null,b=null;
      if(mode==='edit'){
        const input=prompt('Correct score: Team A,Team B (example: 3,1)',`${m.score_a},${m.score_b}`);
        if(input===null)return;
        const parsed=input.split(',').map(v=>v.trim());if(parsed.length!==2||parsed.some(v=>!/^\d{1,2}$/.test(v))){setNotice('vxsk-p12-staff-notice','Use scores like 3,1',true);return;}
        [a,b]=parsed.map(Number);if(a===b){setNotice('vxsk-p12-staff-notice','Elimination scores cannot be tied.',true);return;}
      }
      if(!confirm(`Owner ${mode.toUpperCase()} for ${teamName(d,m.team_a)} vs ${teamName(d,m.team_b)}? Later rounds already active will block this correction.`))return;
      edit.disabled=true;reset.disabled=true;
      try{await rpc('vxsk_p12_owner_correct_score',{p_match:m.id,p_new_a:a,p_new_b:b,p_action:mode,p_reason:reason.trim()});
        await loadStaff();await loadPublic();setNotice('vxsk-p12-staff-notice','Correction saved and audited.');
      }catch(e){setNotice('vxsk-p12-staff-notice',e.message,true);edit.disabled=false;reset.disabled=false;}
    });
    actions.append(edit,reset);n.append(actions);
  }
  return n;
 }
 function tournamentTree(stage,d){
  const matches=ofTournament('matches',stage.tournament_id,d).filter(m=>m.stage_id===stage.id&&m.bracket==='main');
  const first=matches.filter(m=>m.round_no===1);
  if(!first.length)return text('p','The official bracket is waiting for player approvals.','p12-muted');
  const slots=first.length;const totalRounds=Math.ceil(Math.log2(slots*2));
  const W=245,G=78,H=118,cardH=86,offset=40;
  const contentW=totalRounds*(W+G)-G+20, contentH=Math.max(156,slots*H+35);
  const viewport=wrap('div','vxsk-bracket-scroll');viewport.tabIndex=0;viewport.setAttribute('aria-label','Tournament bracket, scroll horizontally for rounds');
  const board=wrap('div','vxsk-bracket-board');board.style.width=contentW+'px';board.style.height=contentH+'px';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('vxsk-bracket-lines');
  svg.setAttribute('viewBox',`0 0 ${contentW} ${contentH}`);svg.setAttribute('aria-hidden','true');
  const lines=[];
  for(let r=1;r<=totalRounds;r++){
    const no=slots/2**(r-1);const x=(r-1)*(W+G);
    const labelNode=text('h5',roundTitle(r,totalRounds),'vxsk-bracket-round-label');labelNode.style.left=x+'px';board.append(labelNode);
    for(let slot=1;slot<=no;slot++){
      const center=offset+(slot-.5)*H*(2**(r-1));
      const record=matches.find(m=>m.round_no===r&&m.slot===slot);
      const card=wrap('article','vxsk-bracket-match');card.style.left=x+'px';card.style.top=(center-cardH/2)+'px';
      card.setAttribute('aria-label',`${roundTitle(r,totalRounds)} match ${slot}`);
      const top=wrap('span','vxsk-bracket-match-id');top.textContent='MATCH '+slot;card.append(top);
      for(let side=0;side<2;side++){
        const teamId=record?.[side===0?'team_a':'team_b'];
        const line=wrap('div','vxsk-bracket-team');
        const avatar=text('span',teamId?visibleBadge(teamId):'•','vxsk-bracket-team-avatar');avatar.setAttribute('aria-hidden','true');
        const name=text('span',teamId?teamName(d,teamId):'TBD','vxsk-bracket-team-name');
        const val=text('b',record?.[side===0?'score_a':'score_b']??'–','vxsk-bracket-team-score');
        if(record?.state==='completed' && record.score_a!==record.score_b && (side===0?record.score_a>record.score_b:record.score_b>record.score_a))line.classList.add('is-winner');
        line.append(avatar,name,val);card.append(line);
      }
      board.append(card);
    }
    if(r<totalRounds){
      for(let pair=1;pair<=no/2;pair++){
        const c1=offset+((2*pair-1)-.5)*H*2**(r-1);
        const c2=offset+((2*pair)-.5)*H*2**(r-1);
        const next=(c1+c2)/2;
        const x1=x+W,xmid=x1+G/2,x2=x1+G;
        lines.push(`M${x1},${c1} H${xmid} V${c2} M${x1},${c2} H${xmid} M${xmid},${next} H${x2}`);
      }
    }
  }
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',lines.join(' '));
  path.setAttribute('fill','none');path.setAttribute('stroke','#8367c9');path.setAttribute('stroke-width','2');svg.append(path);
  board.insertBefore(svg,board.firstChild);viewport.append(board);
  const region=wrap('div','vxsk-bracket-section');region.append(text('p','← Swipe / scroll horizontally to see every round →','vxsk-bracket-hint'),viewport);
  return region;
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
  if(stage.format==='single'&&!admin){
    out.append(tournamentTree(stage,d));
    const finalRound=Math.max(1,...matches.map(x=>x.round_no));
    const final=matches.find(x=>x.round_no===finalRound&&x.state==='completed'&&x.score_a!==x.score_b);
    if(final && finalRound>=Math.ceil(Math.log2(Math.max(2,matches.filter(x=>x.round_no===1).length*2)))){
      const winnerId=final.score_a>final.score_b?final.team_a:final.team_b;
      const champ=wrap('p','p12-champion');champ.textContent='🏆 CHAMPION: '+teamName(d,winnerId);out.append(champ);
    }
    return out;
  }
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
  if(stage.format==='single'&&matches.length){
    const finalRound=Math.max(...matches.map(m=>m.round_no));
    const finalMatch=matches.find(m=>m.round_no===finalRound&&m.state==='completed');
    if(finalMatch&&finalMatch.score_a!=null&&finalMatch.score_b!=null&&finalMatch.score_a!==finalMatch.score_b){
      const championId=finalMatch.score_a>finalMatch.score_b?finalMatch.team_a:finalMatch.team_b;
      const champion=wrap('div','p12-champion');
      champion.append(text('span','TOURNAMENT CHAMPION'),text('strong',teamName(d,championId)));
      out.append(champion);
    }
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
   const card=wrap('article','p12-event-card');card.dataset.tournamentId=t.id;
   const h=wrap('div','p12-event-head'),title=wrap('div');
   title.append(text('span',t.game+' / '+t.mode,'p12-game-kicker'),text('h3',t.title));
   const badge=text('span',t.status.toUpperCase(),'p12-status p12-'+t.status);
   h.append(title,badge);card.append(h);
   const url=publicPoster(t.cover_path);
   if(url){
     const poster=wrap('img','p12-event-poster');poster.src=url;poster.loading='lazy';
     poster.alt=t.title+' tournament poster';card.append(poster);
   }
   if(t.description){const desc=text('p',t.description.replace(/\*\*/g,''),'p12-event-description');card.append(desc);}
   if(t.prize){card.append(text('p','🏆 PRIZE: '+t.prize,'p12-event-prize'));}
   const schedule=wrap('div','p12-event-dates');
   schedule.append(text('span','START: '+formattedDate(t.starts_at)));
   if(t.ends_at)schedule.append(text('span','END: '+formattedDate(t.ends_at)));
   card.append(schedule);
   if(t.rules){
      const rules=wrap('details','p12-event-rules');rules.append(text('summary','RULES & ELIGIBILITY'));
      rules.append(text('p',t.rules));card.append(rules);
   }

   const own=app.myEntries.find(e=>e.tournament_id===t.id);
   const open=['announced','upcoming'].includes(t.status) && !!t.starts_at && new Date(t.starts_at).getTime()>Date.now();
   if(own){
     const status=text('p',`YOUR APPLICATION: ${String(own.status).toUpperCase()}`,'p12-join-state');
     card.append(status);
   }else if(open){
     if(!app.user){
       const sign=text('a','SIGN IN TO JOIN','p12-join-link');sign.href='index.html#members';card.append(sign);
     }else{
       const join=wrap('form','p12-join-form');
       const size=teamSize(t.mode);
       const entry=document.createElement('input');entry.name='player_name';entry.placeholder=size===1?'Your gaming nickname':'Your team name';
       entry.required=true;entry.minLength=2;entry.maxLength=60;entry.setAttribute('aria-label',size===1?'Your gaming nickname':'Team name');
       join.append(entry);
       const country=countrySelect();join.append(country);
       const idInput=document.createElement('input');idInput.required=true;idInput.minLength=3;idInput.maxLength=90;
       idInput.name='game_account_id';idInput.autocomplete='off';
       idInput.placeholder=t.game==='Rocket League'?'Epic / Platform Account ID': 'Riot ID (Name#Tag)';
       idInput.setAttribute('aria-label',idInput.placeholder);join.append(idInput);
       join.append(text('small','Country and game ID are for staff verification; your game ID is not shown publicly.','p12-muted'));
       const names=[];
       if(size>1){
         join.append(text('p',`CAPTAIN: You must list ${size} player nicknames (including yourself). Team members are not yet individually account-verified.`,'p12-muted'));
         for(let i=0;i<size;i++){
           const member=document.createElement('input');member.required=true;member.minLength=2;member.maxLength=40;
           member.placeholder=i===0?'Captain in-game nickname':`Teammate ${i+1} in-game nickname`;
           member.setAttribute('aria-label',member.placeholder);names.push(member);join.append(member);
         }
       }
       const submit=text('button','JOIN TOURNAMENT');submit.type='submit';join.append(submit);
       join.addEventListener('submit',async e=>{
         e.preventDefault();if(!join.reportValidity())return;
         submit.disabled=true;
         try{await rpc('vxsk_p12_join_roster_v2',{p_tournament:t.id,p_name:entry.value.trim(),p_roster:size===1?[entry.value.trim()]:names.map(x=>x.value.trim()),p_country:country.value,p_game_id:idInput.value.trim()});
           await loadPublic();setNotice('vxsk-p12-public-notice','Join request sent. Staff will review it.');
         }catch(error){setNotice('vxsk-p12-public-notice',error.message,true);submit.disabled=false;}
       });
       card.append(join);
     }
   }else{card.append(text('p','REGISTRATION CLOSED','p12-muted'));}

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
   // V14 presentation only: one responsive tournament template for every game/mode.
   const poster=card.querySelector('.p12-event-poster');
   const eventHead=card.querySelector('.p12-event-head');
   const hero=wrap('div','p12-pro-hero');
   if(poster){
     const heroBg=wrap('div','p12-pro-hero-bg');
     heroBg.style.backgroundImage=`url("${poster.src.replace(/"/g,'%22')}")`;
     hero.append(heroBg);
     const artwork=wrap('div','p12-pro-artwork');artwork.append(poster);hero.append(artwork);
   }else{
     hero.classList.add('p12-pro-no-poster');
     hero.append(text('span',t.game.toUpperCase(),'p12-pro-hero-game'));
   }
   // Artwork is always full-size. Never overlay text onto a supplied poster.
   const columns=wrap('div','p12-pro-columns');
   const body=wrap('div','p12-pro-body');
   const sidebar=wrap('aside','p12-pro-sidebar');
   const info=wrap('div','p12-pro-info');
   const infoData=[['GAME',t.game],['MODE',t.mode],['FORMAT','Single Elimination']];
   if(t.prize)infoData.push(['PRIZE',t.prize]);
   for(const [k,v] of infoData){
     const chip=wrap('div','p12-pro-chip');
     chip.append(text('span',k),text('strong',v));info.append(chip);
   }
   const datePanel=wrap('section','p12-pro-date-panel');
   datePanel.append(text('h4','TOURNAMENT SCHEDULE'));
   const dateRows=[['START',formattedDate(t.starts_at)],['END',formattedDate(t.ends_at)]];
   for(const [k,v] of dateRows){const r=wrap('div','p12-pro-date-row');r.append(text('span',k),text('strong',v));datePanel.append(r);}
   const cta=wrap('div','p12-pro-cta');
   const form=card.querySelector('.p12-join-form');
   const signLink=card.querySelector('.p12-join-link');
   const stateNote=card.querySelector('.p12-join-state');
   if(form)cta.append(form);
   else if(signLink)cta.append(signLink);
   else if(stateNote)cta.append(stateNote);
   else cta.append(text('p','Registration closed','p12-muted'));
   const bracketLink=text('button','VIEW BRACKET','p12-pro-bracket-link');
   bracketLink.type='button';
   bracketLink.addEventListener('click',()=>{
     // V18: the bracket lives INSIDE the Brackets tab. Open the tab before scrolling.
     // Scrolling an element inside [hidden] made the button appear broken.
     const tab=tabs.querySelector('[data-section="Brackets"]');
     if(tab)tab.click();
     const pane=sections.Brackets;
     const target=pane?.querySelector('.p12-details');
     if(target)target.open=true;
     if(pane){
       pane.setAttribute('tabindex','-1');
       pane.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
       pane.focus({preventScroll:true});
     }
     if(!target)setNotice('vxsk-p12-public-notice','No bracket generated yet. Once staff approve players and generate matches, the bracket will appear in the Brackets tab.');
   });
   cta.append(bracketLink);
   const timer=wrap('div','p12-v15-timer');countdown(t,timer);sidebar.append(card.querySelector('.p12-status'),timer,datePanel,cta);
   body.append(eventHead,info);
   const desc=card.querySelector('.p12-event-description');if(desc)body.append(desc);
   const rules=card.querySelector('.p12-event-rules');if(rules)body.append(rules);
   const prize=card.querySelector('.p12-event-prize');if(prize)prize.remove();
   const oldDates=card.querySelector('.p12-event-dates');if(oldDates)oldDates.remove();
   const bracket=card.querySelector('.p12-details');if(bracket)body.append(bracket);
   const feed=card.querySelector('.p12-updates');if(feed)body.append(feed);
   // Semantic tabbed sections. Content is reused, not duplicated.
   const tabs=wrap('nav','p12-v15-tabs');tabs.setAttribute('aria-label','Tournament sections');
   const panes=wrap('div','p12-v15-tab-content');
   const sections={};
   for(const name of ['Overview','Rules','Prizes','Participants','Brackets','Matches','Live Streaming']){
     const pane=wrap('section','p12-v15-pane');pane.dataset.section=name;pane.hidden=name!=='Overview';
     sections[name]=pane;panes.append(pane);
     const b=text('button',name,'p12-v15-tab');b.type='button';b.dataset.section=name;
     b.classList.toggle('is-active',name==='Overview');b.setAttribute('aria-pressed',String(name==='Overview'));
     b.addEventListener('click',()=>{
       for(const tab of tabs.children){const active=tab.dataset.section===name;tab.classList.toggle('is-active',active);tab.setAttribute('aria-pressed',String(active));}
       for(const pane of panes.children)pane.hidden=pane.dataset.section!==name;
       // Lazy load embeds only after someone chooses the streaming tab.
       if(name==='Live Streaming'&&sections[name].dataset.player&&!sections[name].querySelector('iframe')){
         const iframe=wrap('iframe','p12-v15-player');iframe.src=sections[name].dataset.player;iframe.title=t.title+' live player';
         iframe.loading='lazy';iframe.allow='fullscreen; autoplay; encrypted-media; picture-in-picture';iframe.allowFullscreen=true;
         sections[name].prepend(iframe);
       }
     });tabs.append(b);
   }
   const approved=ofTournament('teams',t.id,d).slice().sort((a,b)=>a.name.localeCompare(b.name));
   const stat=wrap('div','p12-v15-stats');
   for(const [k,v] of [['PARTICIPANTS',`${approved.length} approved / 64 max`],['GAME MODE',`${t.game} · ${t.mode}`],['PRIZE',t.prize||'To be announced']]){
     const item=wrap('div','p12-v15-stat');item.append(text('small',k),text('strong',v));stat.append(item);
   }
   const gameFeature=wrap('div','vxsk-v17-game-feature');
   const emblem=wrap('div','vxsk-v17-game-emblem');
   const gameLogo=document.createElement('img');
   gameLogo.src=({'Rocket League':'assets/rl-logo.webp','VALORANT':'assets/valorant-logo.webp','League of Legends':'assets/lol-logo.webp'})[t.game]||'assets/vxsk-logo.png';
   gameLogo.alt=t.game+' logo';gameLogo.loading='lazy';gameLogo.decoding='async';
   emblem.append(gameLogo);
   const details=wrap('div');details.append(text('small','OFFICIAL GAME'),text('strong',t.game),text('span',`${t.mode} • ${fmt.single}`));
   gameFeature.append(emblem,details);sections.Overview.append(gameFeature,info);
   if(desc)sections.Overview.append(desc);
   sections.Overview.append(text('h4','About this tournament'));
   sections.Overview.append(text('p','Join the competition, follow official announcements, and check the bracket once approved participants are ready.','p12-muted'));
   if(rules){rules.open=true;sections.Rules.append(rules);}else sections.Rules.append(text('p','Rules will be published by the organizer.','p12-muted'));
   sections.Prizes.append(text('h4','Tournament prizes'));
   sections.Prizes.append(text('p',t.prize||'Prize details will be announced by VXSK.'));
   sections.Participants.append(text('h4','Approved participants'));
   const prog=wrap('div','p12-v15-progress');
   const bar=wrap('div','p12-v15-progress-fill');bar.style.width=Math.min(100,approved.length/64*100)+'%';prog.append(bar);
   sections.Participants.append(text('p',`${approved.length} approved participants · Maximum bracket size: 64`),prog);
   if(approved.length){
     const roster=wrap('div','p12-v15-roster');
     approved.forEach((tm,i)=>{const item=wrap('div','p12-v15-person');
       const avatar=text('span',teamCountry(tm.id)?visibleBadge(tm.id):(tm.name||'?').slice(0,1).toUpperCase(),'p12-v15-avatar');
       item.append(avatar,text('strong',tm.name),text('small','APPROVED'));roster.append(item);
     });sections.Participants.append(roster);
   }else sections.Participants.append(text('p','No approved participants yet. Pending applications are private.','p12-muted'));
   if(bracket){bracket.open=true;sections.Brackets.append(bracket);}
   else sections.Brackets.append(text('p','The bracket will appear after registration approval and generation.','p12-muted'));
   sections.Matches.append(text('h4','Official matches'));
   const matchList=ofTournament('matches',t.id,d).sort((a,b)=>a.round_no-b.round_no||a.slot-b.slot);
   if(matchList.length){const matchWrap=wrap('div','p12-v15-matches');matchList.forEach(m=>matchWrap.append(matchCard(m,d)));sections.Matches.append(matchWrap);}
   else sections.Matches.append(text('p','Match fixtures have not been generated.','p12-muted'));
   const link=safeStream(t),embed=streamEmbed(link);
   sections['Live Streaming'].append(text('h4','Live streaming'));
   if(link){
      if(embed)sections['Live Streaming'].dataset.player=embed;
      const go=text('a','WATCH ON '+new URL(link).hostname.replace('www.','').toUpperCase(),'p12-v15-watch');
      go.href=link;go.target='_blank';go.rel='noopener noreferrer';sections['Live Streaming'].append(go);
      sections['Live Streaming'].append(text('p','If the player is offline or blocked, use the direct stream link above.','p12-muted'));
   }else sections['Live Streaming'].append(text('p','Live stream link will be added by the organizer.','p12-muted'));
   if(feed)sections.Overview.append(feed);
   // One helpful link in the sidebar: no floating bubble conflicts with VXSK AI or Feedback.
   const help=wrap('div','p12-v15-help');help.append(text('strong','Need help with your match?'));
   help.append(text('small','Ask VXSK staff on our Discord server.'));
   const discord=text('a','JOIN VXSK DISCORD ↗','p12-v15-discord');
   discord.href='https://discord.gg/ptWT895A55';discord.target='_blank';discord.rel='noopener noreferrer';help.append(discord);
   sidebar.append(help);
   columns.append(body,sidebar);
   card.prepend(hero,stat,tabs,panes,columns);
   // Use grid's existing body only as an accessibility-friendly hidden container; show tabs on the main panel.
   body.hidden=true;
   node.append(card);
  }
 }
 async function loadPublic(){
   try{
     const d=await rpc('vxsk_p12_public_snapshot');
     const extra=await rpc('vxsk_p12_event_details');
     app.data=mergeDetails({...empty,...d},extra);
     try{const streams=await rpc('vxsk_p12_public_streams');app.data=mergeDetails(app.data,streams);}catch{}
     try{const roster=await rpc('vxsk_p12_public_roster');app.publicRoster=Array.isArray(roster)?roster:[];}
     catch{app.publicRoster=[];}
     const userInfo=await app.api.auth.getUser();
     app.user=userInfo.error?null:userInfo.data?.user||null;
     app.myEntries=[];
     if(app.user){
       const own=await app.api.from('vxsk_p12_entries').select('tournament_id,status,player_name').eq('user_id',app.user.id);
       if(!own.error)app.myEntries=own.data||[];
     }
     renderPublic();setNotice('vxsk-p12-public-notice','Tournament data updated.');
   }catch(err){app.data=null;renderPublic();setNotice('vxsk-p12-public-notice','Game Hub is waiting for its secure P12 backend.',true);}
 }
 async function loadStaff(){
   if(!app.referee)return;
   try{const base=await rpc('vxsk_p12_staff_snapshot');
     const extra=await rpc('vxsk_p12_staff_event_details');
     app.private=mergeDetails({...empty,...base},extra);
     const q=await rpc('vxsk_p12_staff_entries');app.entries=Array.isArray(q)?q:[];
     renderStaff();
     setNotice('vxsk-p12-staff-notice','Tournament Control ready. Staff MFA required for approvals and scores.');
   }catch(e){setNotice('vxsk-p12-staff-notice','Tournament Control backend unavailable: '+e.message,true);}
 }
 function renderAdminBracket(){
  const node=$('p12-admin-bracket'),select=$('p12-bracket-event');
  if(!node||!select)return;
  node.replaceChildren();
  const d=app.private,t=d?.tournaments.find(x=>x.id===select.value);
  const publishButton=$('p12-publish-toggle');
  if(publishButton){
    publishButton.disabled=!t;
    publishButton.textContent=t?(t.published?'UNPUBLISH TOURNAMENT':'PUBLISH TOURNAMENT'):'PUBLISH TOURNAMENT';
    publishButton.dataset.publishNext=t?(t.published?'false':'true'):'';
  }
  if(publishButton)publishButton.hidden=!app.owner;
  if(!t){node.append(text('p','Select a tournament to view its bracket.','p12-muted'));return;}
  const stages=ofTournament('stages',t.id,d).filter(s=>s.format==='single').sort((a,b)=>a.stage_order-b.stage_order);
  if(!stages.length){node.append(text('p','No bracket yet. Add the teams and generate the bracket in the Create tab.','p12-muted'));return;}
  stages.forEach(s=>node.append(stageView(s,d,true)));
 }
 function renderStaff(){
  const d=app.private;if(!d)return;
  const queue=$('p12-entry-queue');
  if(queue){
    queue.replaceChildren();
    const pending=(app.entries||[]).filter(e=>e.status==='pending');
    if(!pending.length)queue.append(text('p','No pending players.','p12-muted'));
    for(const e of pending){
      const t=d.tournaments.find(t=>t.id===e.tournament_id);
      const item=wrap('article','p12-entry-row');
      item.append(text('strong',e.player_name),text('small',(t?.title||'Tournament')+' · '+(e.roster||[]).join(' / ')));
      if(e.country_code)item.append(text('small',flagEmoji(e.country_code)+' Country: '+e.country_code));
      if(e.game_account_id)item.append(text('small','Game Account ID (staff-only): '+e.game_account_id));
      const actions=wrap('div','p12-entry-actions');
      for(const [label,decision] of [['APPROVE','approved'],['REJECT','rejected']]){
        const b=text('button',label);b.type='button';
        b.addEventListener('click',async()=>{
          if(!confirm(`${label} ${e.player_name}?`))return;
          b.disabled=true;
          try{await rpc('vxsk_p12_review_entry',{p_entry:e.id,p_decision:decision});
            await loadStaff();await loadPublic();
            setNotice('vxsk-p12-staff-notice','Application '+decision+'.');
          }catch(error){setNotice('vxsk-p12-staff-notice',error.message,true);b.disabled=false;}
        });actions.append(b);
      }
      item.append(actions);queue.append(item);
    }
  }
  const allT=d.tournaments.slice().sort((a,b)=>a.title.localeCompare(b.title));
  const buildSelect=$('p12-bracket-build-event'),bracketSelect=$('p12-bracket-event');
  freshSelect(buildSelect,allT,x=>x.id,x=>x.title+' · '+x.game,'SELECT TOURNAMENT');
  freshSelect(bracketSelect,allT,x=>x.id,x=>x.title+' · '+x.game,'SELECT TOURNAMENT');
  freshSelect($('p12-stream-event'),allT,x=>x.id,x=>x.title+' · '+x.game,'SELECT TOURNAMENT');
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
  const notice=node.querySelector('[data-form-feedback]');
  const report=(message,isError=false)=>{
   if(notice){notice.textContent=message;notice.hidden=false;notice.dataset.error=isError?'1':'0';}
   setNotice('vxsk-p12-staff-notice',message,isError);
  };
  node.addEventListener('invalid',e=>{
    const label=e.target.closest('label');
    const name=label?.firstChild?.textContent?.trim()||e.target.name||'Field';
    report('Check '+name+': '+e.target.validationMessage,true);
  },true);
  node.addEventListener('submit',async e=>{
   e.preventDefault();
   if(!node.reportValidity())return;
   const btn=node.querySelector('[type=submit]');if(btn)btn.disabled=true;
   report('Saving tournament...');
   try{
    await handler(new FormData(node));
    report('Saved successfully. Check Tournament Control to continue.');
    node.reset();await loadStaff();await loadPublic();
   }catch(err){report(err.message||'Request failed. Please try again.',true);}
   finally{if(btn)btn.disabled=false;}
  });
 }
 // datetime-local means wall-clock Tunis time, NOT the browser's timezone.
 function tunisDate(v){
  if(!v)return null;
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if(!m)return null;
  const [year,month,day,hour,minute]=m.slice(1).map(Number);
  const dt=new Date(Date.UTC(year,month-1,day,hour-1,minute));
  const isSame=new Date(dt.getTime()+3600000).toISOString().slice(0,16)===v;
  return isSame?dt:null;
 }
 const localDate=v=>{const d=tunisDate(v);return d?d.toISOString():null;};
 function setDefaultEndDate(){
   const f=$('p12-create');if(!f)return;
   const start=f.elements.namedItem('start'),end=f.elements.namedItem('end');
   if(!start||!end)return;
   const parsed=tunisDate(start.value);if(!parsed)return;
   if(!end.value||!tunisDate(end.value)||tunisDate(end.value)<=parsed){
     const until=new Date(parsed.getTime()+4*3600000+3600000);
     end.value=`${until.getUTCFullYear()}-${String(until.getUTCMonth()+1).padStart(2,'0')}-${String(until.getUTCDate()).padStart(2,'0')}T${String(until.getUTCHours()).padStart(2,'0')}:${String(until.getUTCMinutes()).padStart(2,'0')}`;
   }
 }
 function refreshModes(){
   const form=$('p12-create');if(!form)return;
   const game=form.elements.namedItem('game'),mode=form.elements.namedItem('mode');
   const current=mode.value;mode.replaceChildren();
   for(const m of gameModes[game.value]||['1v1'])mode.append(option(m,m+(m==='1v1'?' (Solo)':' (Team)')));
   if([...mode.options].some(o=>o.value===current))mode.value=current;
 }
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
   const create=$('p12-create');
   create?.elements.namedItem('game')?.addEventListener('change',refreshModes);
   create?.elements.namedItem('start')?.addEventListener('change',setDefaultEndDate);
   refreshModes();
   document.querySelectorAll('[data-p12-tab]').forEach(b=>b.addEventListener('click',()=>showControlTab(b.dataset.p12Tab)));
   form('p12-create',async f=>{
     const start=localDate(value(f,'start')),end=localDate(value(f,'end'));
     const poster=f.get('poster');
     if(poster instanceof File && poster.size &&
       (!['image/jpeg','image/png','image/webp'].includes(poster.type)||poster.size>3145728))
       throw Error('Poster must be JPG/PNG/WEBP and under 3 MB.');
     if(!start)throw Error('START DATE missing/invalid. Enter date and time in Tunis timezone.');
     if(new Date(start).getTime()<=Date.now())throw Error('START DATE must be after today (Tunis time).');
     if(!end)throw Error('END DATE missing/invalid. Choose a date and time after START DATE.');
     if(new Date(end)<=new Date(start))throw Error('END DATE must be later than START DATE.');
     if(new Date(end).getTime()-new Date(start).getTime()>30*86400000)
       throw Error('Tournament can last no more than 30 days.');
     if(!(gameModes[value(f,'game')]||[]).includes(value(f,'mode')))
       throw Error('Select a valid mode for the selected game.');
     const id=await rpc('vxsk_p12_create_tournament',{
       p_title:value(f,'title'),p_game:value(f,'game'),p_mode:value(f,'mode'),
       p_start:start,p_publish:false
     });
     await rpc('vxsk_p12_schedule_times',{p_tournament:id,p_start:start,p_end:end});
     let cover='';
     try {cover=await uploadPoster(id,poster);}
     catch(error){throw Error('Tournament saved as private draft, but '+error.message+' Upload a valid poster in a new draft or continue without poster.');}
     const streamUrl=value(f,'stream_url');
     if(streamUrl){
       const validated=safeStream({stream_url:streamUrl});
       if(!validated)throw Error('Enter a valid HTTPS Kick, YouTube, or Twitch stream URL.');
       await rpc('vxsk_p12_set_stream',{p_tournament:id,p_url:validated});
     }
     const description=value(f,'description')+(streamUrl?'\nLive stream: '+streamUrl:'');
     if(description.length>1500)throw Error('Description too long. Shorten it to include the stream URL.');
     const saved=await rpc('vxsk_p12_save_details',{
      p_tournament:id,p_description:description,p_rules:value(f,'rules'),
      p_prize:value(f,'prize'),p_cover_path:cover
     });
     if(saved!==true)throw Error('Tournament draft created but its details could not be saved.');
     app.focusTournamentId=id;
     setNotice('vxsk-p12-staff-notice','Tournament created. Publish it to open JOIN, then approve players and generate the bracket.');
   });
   form('p12-update-stream',async f=>{
      const id=value(f,'event'),url=value(f,'stream_url');
      if(!safeStream({stream_url:url}))throw Error('Only valid HTTPS Kick, YouTube or Twitch links are accepted.');
      const t=app.private?.tournaments?.find(x=>x.id===id);
      if(!t)throw Error('Select a tournament.');
      const base=String(t.description||'').replace(/\nLive stream: https:\/\/[^\s]+/ig,'');
      const description=base+'\nLive stream: '+url;
      if(description.length>1500)throw Error('Description limit reached.');
      await rpc('vxsk_p12_set_stream',{p_tournament:id,p_url:url});
      const ok=await rpc('vxsk_p12_save_details',{p_tournament:id,p_description:description,
        p_rules:t.rules||'',p_prize:t.prize||'',p_cover_path:t.cover_path||''});
      if(ok!==true)throw Error('Stream saved but public description could not be updated.');
   });
   form('p12-build-bracket',async f=>{
     const tournament=value(f,'event');
     const count=await rpc('vxsk_p12_generate_approved_bracket',{
       p_tournament:tournament,p_publish:f.has('publish')
     });
     app.focusTournamentId=tournament;
     setNotice('vxsk-p12-staff-notice',`Bracket generated for ${count} approved players.`);
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
   $('p12-publish-toggle')?.addEventListener('click',async()=>{
     const select=$('p12-bracket-event'),button=$('p12-publish-toggle');
     const tournament=app.private?.tournaments.find(t=>t.id===select?.value);
     if(!tournament||!button.dataset.publishNext)return;
     const publish=button.dataset.publishNext==='true';
     if(!confirm(`${publish?'Publish':'Unpublish'} ${tournament.title}? ${publish?'The event and bracket become visible on the public Arena.':'The event and bracket become hidden from public view.'}`))return;
     button.disabled=true;
     try{
       await rpc('vxsk_p12_publish',{p_tournament:tournament.id,p_publish:publish});
       await loadStaff();await loadPublic();
       setNotice('vxsk-p12-staff-notice',publish?'Tournament published on the public Arena.':'Tournament is now private.');
     }catch(err){
       setNotice('vxsk-p12-staff-notice',err.message||'Could not update tournament visibility.',true);
       button.disabled=false;
     }
   });
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
  window.setInterval(()=>{document.querySelectorAll('.p12-v15-timer').forEach(el=>{const card=el.closest('.p12-event-card');const id=card?.dataset.tournamentId;const t=app.data?.tournaments?.find(t=>t.id===id);if(t)countdown(t,el);});},1000);
  window.setInterval(()=>{
    const panel=document.querySelector('[data-arena-panel="p12"]');
    if(!document.hidden && panel && !panel.hidden && !document.querySelector('#vxsk-p12-public form:focus-within'))void loadPublic();
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
