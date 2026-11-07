/* VXSK V19: trustworthy, privacy-respecting, read-only rankings + approved team joins.
   No invented results; calculations live in guarded Supabase functions. */
'use strict';
(()=>{
  const $=id=>document.getElementById(id);
  const el=(tag,content,cls)=>{const n=document.createElement(tag);if(content!=null)n.textContent=String(content);if(cls)n.className=cls;return n;};
  const cfg=window.VXSK_SUPABASE_CONFIG||window.VXSK_SUPABASE||window.VXSK_CONFIG||null;
  let db=null;
  const status=(message,error)=>{const n=$('v19-rank-status');if(n){n.textContent=message;n.dataset.error=error?'1':'0';}};
  function client(){
   if(db)return db;
   if(window.VXSKAuth?.client){db=window.VXSKAuth.client;return db;}
   const c=window.VXSK_SUPABASE_CONFIG||window.VXSK_SUPABASE||window.VXSK_CONFIG||window.VXSKSupabaseConfig||null;
   const url=c?.url||window.VXSK_SUPABASE_URL, key=c?.publishableKey||c?.anonKey||window.VXSK_SUPABASE_ANON_KEY;
   if(!window.supabase?.createClient||!url||!key)throw Error('VXSK account connection unavailable');
   db=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
   return db;
  }
  async function call(name,args){const {data,error}=await client().rpc(name,args||{});if(error)throw Error(error.message);return data;}
  function listCard(title,rows,kind){
   const card=el('section',null,'v19-rank-panel');card.append(el('h3',title));
   if(!Array.isArray(rows)||!rows.length){card.append(el('small','No verified results yet.'));return card;}
   rows.slice(0,10).forEach((x,i)=>{
    const row=el('div',null,'v19-rank-row');row.append(el('span',String(x.rank||i+1).padStart(2,'0'),'rank'));
    row.append(el('span',x.name||'Team','name'));
    const val=kind==='teams'?`${Number(x.members)||0} members`: `${Number(x.points)||0} pts`;
    row.append(el('strong',val,'score'));card.append(row);
   });return card;
  }
  function showProgress(data){
   let host=$('vxsk-ah-page-activity')||$('vxsk-account-hub');
   if(!host)return;
   let box=$('v19-my-progress');if(!box){box=el('section',null,'v19-my-progress');box.id='v19-my-progress';host.append(box);}
   box.replaceChildren(el('h3','MY VXSK PROGRESS'));
   const cards=el('div',null,'v19-progress-cards');
   const fields=[['Player points',data?.player?.points],['Approved tournaments',data?.player?.tournament_joins],['Tournament wins',data?.player?.tournament_wins],['Showmatches played',data?.player?.showmatches]];
   if(data?.staff?.points)fields.push(['Staff contribution',data.staff.points]);
   fields.forEach(([name,value])=>{const item=el('div');item.append(el('b',Number(value)||0),el('small',name));cards.append(item);});box.append(cards);
   const team=data?.membership;box.append(el('p',team?.team?`Team: ${team.team} · ${team.status}`:'No team membership yet.'));
  }
  async function load(){
   const section=$('v19-rankings');if(!section)return;
   status('Loading verified VXSK rankings…');
   try{
    const data=await call('vxsk_v19_leaderboards');
    const grid=$('v19-rank-grid');grid.replaceChildren(
      listCard('TOP PLAYERS',data?.players,'players'),
      listCard('TOP TEAMS',data?.teams,'teams'),
      listCard('TOP STAFF',data?.staff,'staff'));
    const menu=$('v19-join-team');menu.replaceChildren();menu.add(el('option','Choose a team to join'));
    menu.lastChild.value='';
    for(const team of data?.teams||[]){if(!team.id)continue;const o=el('option',team.name);o.value=team.id;menu.append(o);}
    status('Live rankings from verified VXSK activity. Teams ranked by accepted members, then member points.');
    const {data:{session}}=await client().auth.getSession();
    if(session){try{showProgress(await call('vxsk_v19_my_progress'));}catch{}}
   }catch(e){status('Rankings could not load: '+e.message,true);}
  }
  async function loadOwn(){
   try{const {data}=await client().auth.getSession();if(!data?.session)return;
      const progress=await call('vxsk_v19_my_progress');
      const host=$('vxsk-ah-page-activity')||$('vxsk-account-hub');
      if(host)showProgress(progress);
      else {const obs=new MutationObserver(()=>{if($('vxsk-ah-page-activity')){obs.disconnect();showProgress(progress);}});
        obs.observe(document.body,{childList:true,subtree:true});}
   }catch(e){console.warn('VXSK progress unavailable',e?.message||'');}
  }
  function setup(){
   if(!$('v19-rankings'))return;
   setTimeout(loadOwn,1200);
   $('v19-join-action')?.addEventListener('click',async()=>{
    const id=$('v19-join-team')?.value;if(!id)return status('Choose a team first.',true);
    const b=$('v19-join-action');b.disabled=true;
    try{await call('vxsk_v19_join_team',{p_team:id});status('Team join request sent. Staff approval required.');}
    catch(e){status(e.message,true);}finally{b.disabled=false;}
   });
   $('v19-leave-action')?.addEventListener('click',async()=>{
    if(!confirm('Leave your current team or cancel your request?'))return;
    const b=$('v19-leave-action');b.disabled=true;
    try{await call('vxsk_v19_leave_team');status('Membership/request cleared.');await load();}
    catch(e){status(e.message,true);}finally{b.disabled=false;}
   });
   $('v19-rank-refresh')?.addEventListener('click',load);
   if('IntersectionObserver' in window){
    let once=false;const io=new IntersectionObserver(es=>{if(!once&&es.some(e=>e.isIntersecting)){once=true;io.disconnect();void load();}},{rootMargin:'360px'});
    io.observe($('v19-rankings'));
   }else void load();
   window.addEventListener('vxsk:account-signed-in',()=>void load());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
