'use strict';
(async () => {
  const root=document.getElementById('th-profile'),hub=window.VXSKTeamsHub;
  const slug=new URLSearchParams(location.search).get('team')||'';
  const t=await hub.one(slug);
  if(!t){root.textContent='Team not found or not published.';return;}
  document.title=t.name+' — VXSK Teams';
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const main=el('article','vxsk-th-profile'),left=hub.logo(t.image,t.name),right=el('div');
  right.append(el('span','vxsk-th-eyebrow',t.featured_order?'★ FEATURED VXSK TEAM':'VXSK COMMUNITY TEAM'),el('h1','',t.name),el('p','',t.description||'This team is part of the VXSK community.'));
  const tags=el('div','vxsk-th-tags');t.games.forEach(g=>tags.append(el('span','',g)));right.append(tags);
  const links=el('div','vxsk-th-profile-links');t.links.forEach(link=>{const a=el('a','',link.label+' ↗');a.href=link.url;if(link.url.startsWith('https://')){a.rel='noopener noreferrer';a.target='_blank';}links.append(a);});right.append(links);
  main.append(left,right);root.replaceChildren(main);
})();
