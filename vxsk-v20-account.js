/* VXSK V20 — private account progress, favorites and history. No client-authorized points. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const make=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined&&txt!==null)n.textContent=String(txt);if(cls)n.className=cls;return n;};
 const games=[['VALORANT','assets/game-valorant.webp'],['Rocket League','assets/game-rocket.webp'],['League of Legends','assets/game-league.webp']];
 let api=null,mounted=false,loading=false;
 function client(){api=api||window.VXSKAuth?.client;if(!api)throw Error('VXSK account unavailable');return api;}
 async function rpc(name,args={}){const {data,error}=await client().rpc(name,args);if(error)throw Error(error.message);return data;}
 function status(message,bad){const node=$('v20-account-status');if(node){node.textContent=message;node.dataset.error=bad?'1':'0';}}
 function number(v){return Number(v)||0;}
 function show(data){const xp=number(data.xp),lvl=number(data.level)||1,points=number(data.progress?.player?.points),staff=number(data.progress?.staff?.points);
  $('v20-level').textContent=String(lvl);$('v20-xp').textContent=xp.toLocaleString()+' XP';$('v20-points').textContent=points.toLocaleString();
  $('v20-staff-points').textContent=staff.toLocaleString();
  const low=100*(lvl-1)*(lvl-1),high=100*lvl*lvl;
  $('v20-xp-range').textContent=`${xp-low} / ${high-low} XP toward Level ${lvl+1}`;
  $('v20-xp-bar').style.width=`${Math.max(0,Math.min(100,Math.round(100*(xp-low)/(high-low))))}%`;
  const fav=$('v20-fav-value');fav.textContent=data.game||'Choose a favorite game';
  const cards=$('v20-fav-cards');cards.replaceChildren();
  for(const [name,image] of games){const button=make('button',null,'v20-game-card');button.type='button';button.setAttribute('aria-pressed',String(data.game===name));
   const img=make('img');img.src=image;img.alt='';img.loading='lazy';button.append(img,make('strong',name));
   button.addEventListener('click',async()=>{if(loading)return;loading=true;button.disabled=true;
    try{await rpc('vxsk_v20_set_favorite_game',{p_game:name});data.game=name;show(data);status(`${name} saved as your favorite.`);}
    catch(e){status(e.message,true);}finally{loading=false;button.disabled=false;}
   });cards.append(button);
  }
  const tournaments=$('v20-tournament-history'),showmatches=$('v20-showmatch-history');
  tournaments.replaceChildren();showmatches.replaceChildren();
  for(const r of data.tournaments||[]){const row=make('article',null,'v20-history-row');
   row.append(make('strong',r.title),make('small',`${r.game} · ${r.status.toUpperCase()} · ${new Date(r.joined_at).toLocaleDateString('en-GB')}`));tournaments.append(row);}
  for(const r of data.showmatches||[]){const row=make('article',null,'v20-history-row');
   row.append(make('strong',`${r.game} · ${r.mode}`),make('small',`${r.state.toUpperCase()} · ${r.side} · ${new Date(r.created_at).toLocaleDateString('en-GB')}`));showmatches.append(row);}
  if(!data.tournaments?.length)tournaments.append(make('p','No tournament history yet.','v20-muted'));
  if(!data.showmatches?.length)showmatches.append(make('p','No showmatch history yet.','v20-muted'));
  status('Progress and history are calculated from your saved VXSK records.');
 }
 async function refresh(){if(loading||!mounted)return;loading=true;
  try{const {data:{user}}=await client().auth.getUser();if(!user)return;
   const d=await rpc('vxsk_v20_my_dashboard');show(d);
  }catch(e){status('Private progress unavailable: '+e.message,true);}finally{loading=false;}
 }
 function mount(){if(mounted)return;const overview=$('vxsk-ah-page-overview'),activity=$('vxsk-ah-page-activity');if(!overview||!activity)return;
  mounted=true;
  const dashboard=make('section',null,'v20-account-card');dashboard.id='v20-player-card';
  dashboard.innerHTML='<div class="v20-account-heading"><span class="v20-kicker">MY VXSK IDENTITY</span><h3>MY PLAYER PROGRESS</h3><p>Level, XP, points and your gaming identity — all earned from verified activity.</p></div><div class="v20-level-row"><div class="v20-level-icon" id="v20-level">1</div><div><strong id="v20-xp">0 XP</strong><span id="v20-xp-range">0 / 100 XP toward Level 2</span></div></div><div class="v20-xp-track"><span id="v20-xp-bar"></span></div><div class="v20-account-metrics"><div><strong id="v20-points">0</strong><span>PLAYER POINTS</span></div><div><strong id="v20-staff-points">0</strong><span>STAFF CONTRIBUTION</span></div></div><h4>FAVORITE GAME · <span id="v20-fav-value">CHOOSE ONE</span></h4><div id="v20-fav-cards" class="v20-favorite-games"></div><div class="v20-account-actions"><button type="button" id="v20-account-refresh">↻ REFRESH PROGRESS</button><button type="button" id="v20-account-signout">↪ SIGN OUT</button></div><p id="v20-account-status" role="status" class="v20-account-state"></p>';
  overview.prepend(dashboard);$('v20-account-refresh').addEventListener('click',refresh);
  $('v20-account-signout').addEventListener('click',()=>{$('account-logout')?.click();});
  const history=make('section',null,'v20-account-card');history.id='v20-arena-history';
  history.innerHTML='<div class="v20-account-heading"><span class="v20-kicker">MY ARENA / PRIVATE HISTORY</span><h3>MY TOURNAMENTS & SHOWMATCHES</h3><p>Only your own requests and participations. Wins count after official score confirmation.</p></div><div class="v20-history-grid"><div><h4>TOURNAMENT HISTORY</h4><div id="v20-tournament-history"></div></div><div><h4>SHOWMATCH HISTORY</h4><div id="v20-showmatch-history"></div></div></div>';
  activity.prepend(history);
  const chip=$('nav-user-chip');if(chip&&!$('v20-nav-signout')){
   const out=make('button','SIGN OUT','v20-nav-signout');out.id='v20-nav-signout';out.type='button';
   out.addEventListener('click',()=>{$('account-logout')?.click();});chip.insertAdjacentElement('afterend',out);
   const updateNavSignout=()=>{out.hidden=chip.hidden;};
   updateNavSignout();new MutationObserver(updateNavSignout).observe(chip,{attributes:true,attributeFilter:['hidden']});
  }
  void refresh();
 }
 function start(){if($('vxsk-ah-page-overview'))return mount();const obs=new MutationObserver(()=>{if($('vxsk-ah-page-overview')){obs.disconnect();mount();}});obs.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>obs.disconnect(),20000);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.addEventListener('vxsk:account-signed-in',()=>void refresh());
})();
