/* VXSK P14 public marketplace navigation. No modifications to payments, requests or backend logic. */
'use strict';
(()=>{
  if(document.body?.dataset.vxskPage!=='merch')return;
  function init(){
    const root=document.getElementById('vxsk-marketplace'),inside=root?.querySelector('.vxsk-mkt-inner');if(!inside||inside.querySelector('.vxsk-p14-merch-top'))return;
    const elements={services:inside.querySelector('.vxsk-mkt-cards'),coaches:document.getElementById('vxsk-coach-directory'),boosters:document.getElementById('vxsk-boosters'),reviews:document.getElementById('vxsk-my-verified-reviews')};
    const bar=document.createElement('div');bar.className='vxsk-p14-merch-top';
    const head=document.createElement('div');head.className='vxsk-p14-merch-head';
    const glyph=document.createElement('span');glyph.textContent='✦';glyph.setAttribute('aria-hidden','true');
    const heading=document.createElement('div'),title=document.createElement('strong'),small=document.createElement('small');title.textContent='VXSK MARKETPLACE';small.textContent='Pick one category. Simple, fast and clear.';heading.append(title,small);head.append(glyph,heading);bar.append(head);
    const nav=document.createElement('nav');nav.className='vxsk-p14-merch-tabs';nav.setAttribute('aria-label','Choose marketplace category');
    const names={services:'🛍 Gear & Services',coaches:'🎓 Coaches',boosters:'⚡ Boosters',reviews:'☆ My Reviews'};
    const tabs={};for(const [k,name] of Object.entries(names)){const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.p14Tab=k;b.setAttribute('aria-pressed','false');nav.append(b);tabs[k]=b;}bar.append(nav);
    const cards=inside.querySelector('.vxsk-mkt-cards');inside.insertBefore(bar,cards||inside.firstChild);
    let active='services';
    function activate(k,scroll=false){if(!elements[k])k='services';active=k;
      for(const [key,node] of Object.entries(elements)){if(!node)continue;node.classList.add('vxsk-p14-merch-pane');node.classList.toggle('vxsk-p14-pane-hidden',key!==k);}
      for(const [key,b] of Object.entries(tabs)){const on=key===k;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));}
      if(scroll){bar.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
    }
    for(const [k,b] of Object.entries(tabs))b.addEventListener('click',()=>activate(k));
    const linkTargets={'#vxsk-coach-directory':'coaches','#vxsk-boosters':'boosters','#vxsk-my-verified-reviews':'reviews','#vxsk-marketplace':'services'};
    function hashSelect(){const found=linkTargets[location.hash];if(found)activate(found);}
    window.addEventListener('hashchange',hashSelect);
    document.querySelectorAll('a[href^="#vxsk-"]').forEach(link=>link.addEventListener('click',()=>{const k=linkTargets[link.getAttribute('href')];if(k)activate(k);}));
    activate(linkTargets[location.hash]||'services');
    // Existing service cards open the coaches section by scrollIntoView; make it visible first.
    for(const c of (cards?.querySelectorAll('.vxsk-mkt-card')||[])){
      c.addEventListener('click',()=>{if(c.textContent.toLowerCase().includes('coach'))activate('coaches');},true);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
