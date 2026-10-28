/* VXSK P4: public Featured Teams JSON + visual header previews.
   Public reads only. The editor downloads a draft JSON; publishing requires normal GitHub write access.
   The owner button is gated by existing Owner+MFA but is NOT an authorization mechanism for data writes. */
'use strict';
(() => {
  const grid = document.querySelector('#vxsk-teams .vxsk-partner-grid');
  const preview = document.getElementById('nav-hover-panel');
  const ownerButton = document.getElementById('vxsk-featured-manage');
  const staff = [
    ['SHARK','CO-FOUNDER & ANALYST','assets/vxsk-team-shark-2026.webp','#vxsk-staff-shark'],
    ['DRAGON','ORGANIZER & CHAT MODERATOR','assets/vxsk-team-dragon-2026.webp','#vxsk-staff-dragon'],
    ['CABAKA','LEAGUE OF LEGENDS MANAGER','assets/vxsk-team-cabaka-2026.webp','#vxsk-staff-cabaka'],
    ['SELYM','VALORANT MANAGER','assets/vxsk-team-selym-2026.webp','#vxsk-staff-selym'],
    ['DYFE','SOCIAL MEDIA & DESIGN','assets/vxsk-team-dyfe-2026.webp','#vxsk-staff-dyfe'],
    ['MEDO','CO-CASTER & ANALYST','assets/vxsk-team-medo-2026.webp','#vxsk-staff-medo'],
    ['AYOUB','CHAT MODERATOR & REFEREE','assets/vxsk-team-ayoub-2026.webp','#vxsk-staff-ayoub']
  ];
  let currentTeams = null;
  const node=(tag, cls, value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!=null)el.textContent=String(value);return el;};
  const safeImage=(url)=>{
    if(typeof url!=='string')return '';
    if(/^assets\/[a-z0-9_./-]+\.(?:png|jpg|jpeg|webp|gif)$/i.test(url) && !url.includes('..'))return url;
    if(/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(url) && url.length<2_600_000)return url;
    return '';
  };
  const safeLink=(url)=>typeof url==='string' && (url.startsWith('https://') || /^mailto:[^\s<>"']+@[^\s<>"']+$/i.test(url)) && url.length<=500 ? url : '';
  function image(visual, src, name) {
    const fallback=node('span','vxsk-image-fallback',name);
    fallback.setAttribute('aria-hidden','true');visual.append(fallback);
    const img=node('img');img.src=safeImage(src)||'';img.alt=name+' team artwork';img.loading='lazy';img.decoding='async';
    img.addEventListener('error',()=>{visual.classList.add('vxsk-p4-image-error');img.removeAttribute('src');},{once:true});
    if(!img.getAttribute('src'))visual.classList.add('vxsk-p4-image-error');
    visual.append(img);return img;
  }
  function normalize(value){
    if(!value || !Array.isArray(value.teams))return null;
    return value.teams.slice(0,30).filter(t=>t && t.featured!==false && typeof t.name==='string' && t.name.trim()).map(t=>({
      id:String(t.id||'').slice(0,70),name:t.name.trim().slice(0,90),
      label:String(t.label||'COMMUNITY TEAM').slice(0,100),
      description:String(t.description||'').slice(0,650),image:safeImage(t.image),
      games:Array.isArray(t.games)?t.games.slice(0,8).map(x=>String(x).slice(0,40)):[],
      links:Array.isArray(t.links)?t.links.slice(0,8).map(l=>({label:String(l.label||'LINK').slice(0,25),url:safeLink(l.url)})).filter(l=>l.url):[]
    }));
  }
  function teamCard(t){
    const card=node('article','vxsk-partner-card vxsk-partner-'+(t.id==='drax'?'drax':t.id==='vortex'?'vortex':t.id==='n2xt'?'n2xt':'custom'));
    const visual=node('div','vxsk-partner-visual');image(visual,t.image,t.name);
    const body=node('div','vxsk-partner-copy');body.append(node('span','vxsk-team-label',t.label),node('h3','',t.name),node('p','',t.description));
    const games=node('div','vxsk-team-chips');t.games.forEach(g=>games.append(node('span','',g)));body.append(games);
    const links=node('div','vxsk-team-links');for(const l of t.links){const a=node('a','',l.label+' ↗');a.href=l.url;if(l.url.startsWith('https://')){a.target='_blank';a.rel='noopener noreferrer';}links.append(a);}body.append(links);
    card.append(visual,body);return card;
  }
  function fixLegacyErrors(){
    for(const visual of document.querySelectorAll('#vxsk-teams .vxsk-partner-visual')){
      const img=visual.querySelector('img');if(!img)continue;
      img.addEventListener('error',()=>visual.classList.add('vxsk-p4-image-error'),{once:true});
      if(img.complete && img.naturalWidth===0)visual.classList.add('vxsk-p4-image-error');
    }
  }
  function updateTeams(){if(!grid || !currentTeams)return;grid.replaceChildren(...currentTeams.map(teamCard));}
  // Leave static HTML usable when JSON isn't available (e.g. cache, disabled fetch).
  fixLegacyErrors();
  fetch('featured-teams.json?v=12.9.4-p4-featured1',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Data file unavailable');return r.json();}).then(json=>{const valid=normalize(json);if(valid){currentTeams=valid;updateTeams();}}).catch(()=>{});
  function previewCard({name,small,desc,src,href}){
    const a=node('a','nav-preview-card');a.href=href;
    const img=node('img');img.src=safeImage(src);img.alt='';img.loading='lazy';img.addEventListener('error',()=>{img.remove();},{once:true});
    const copy=node('span','nav-preview-copy');copy.append(node('small','',small),node('strong','',name),node('span','',desc));
    a.append(img,copy);return a;
  }
  function enhance(href){
    if(!preview || preview.hidden || !window.matchMedia('(min-width:1271px) and (hover:hover)').matches)return;
    if(href!=='#staff' && href!=='#sponsor')return;
    const inner=node('div','nav-preview-grid shell '+(href==='#staff'?'vxsk-p4-staff-preview':'vxsk-p4-featured-preview'));
    if(href==='#staff'){
      for(const [name,desc,src,link] of staff)inner.append(previewCard({name,desc,src,href:link,small:'VXSK CREW'}));
    }else{
      const source=currentTeams||[
        {name:'N2XT ESPORTS',label:'OFFICIAL PARTNER',description:'Tunisian gaming community',image:'assets/n2xt-official-logo.png'},
        {name:'VORTEX TN',label:'COMMUNITY TEAM',description:'Rocket League and Minecraft',image:'assets/vxsk-vortex-tn.webp'},
        {name:'DRAX ESPORTS',label:'ROCKET LEAGUE',description:'Competitive community',image:'assets/vxsk-drax-dragon.webp'}];
      for(const t of source.slice(0,6))inner.append(previewCard({name:t.name,small:t.label,desc:t.description,src:t.image,href:'#vxsk-teams'}));
    }
    preview.replaceChildren(inner);
  }
  // Existing vxsk-experience.js creates its preview first; this replaces only Staff/Featured previews.
  for(const link of document.querySelectorAll('#nav-links a[href="#staff"],#nav-links a[href="#sponsor"]')){
    const href=link.getAttribute('href');
    link.addEventListener('mouseenter',()=>enhance(href));
    link.addEventListener('focus',()=>enhance(href));
  }
  async function checkOwner(){
    if(!ownerButton)return;
    ownerButton.hidden=true;
    const api=window.VXSKAuth?.client;
    if(!api?.auth?.getUser || !api.auth?.mfa?.getAuthenticatorAssuranceLevel || !api.rpc)return;
    try{
      const [u,level,owner]=await Promise.all([api.auth.getUser(),api.auth.mfa.getAuthenticatorAssuranceLevel(),api.rpc('vxsk_hub_owner')]);
      if(!u.error && u.data?.user && !level.error && level.data?.currentLevel==='aal2' && !owner.error && owner.data===true){ownerButton.hidden=false;}
    }catch(_){ownerButton.hidden=true;}
  }
  window.addEventListener('vxsk:auth-change',()=>void checkOwner());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkOwner();});
  window.setTimeout(()=>void checkOwner(),900);
})();
