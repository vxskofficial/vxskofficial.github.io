/* VXSK SIMPLE PRO v1: clean staff navigation only. Never changes authorization. */
'use strict';
(() => {
  function start(){
    const nav=document.getElementById('staff-command-nav');
    if(!nav||document.getElementById('vxsk-simple-more'))return;
    const secondary=new Set(['bulletin','boosters','crew','team','cleanup']);
    const more=document.createElement('button');
    more.type='button';more.id='vxsk-simple-more';more.textContent='MORE TOOLS  +';
    more.setAttribute('aria-expanded','false');
    more.setAttribute('aria-label','Show more staff tools');
    nav.append(more);
    const expand=(open)=>{
      nav.classList.toggle('vxsk-simple-expanded',Boolean(open));
      more.setAttribute('aria-expanded',String(Boolean(open)));
      more.textContent=open?'FEWER TOOLS  −':'MORE TOOLS  +';
    };
    more.addEventListener('click',()=>expand(!nav.classList.contains('vxsk-simple-expanded')));
    const checkActive=()=>{
      const active=nav.querySelector('[data-staff-tab].is-active');
      if(active&&secondary.has(active.dataset.staffTab))expand(true);
    };
    nav.addEventListener('click',event=>{
      if(event.target.closest('[data-staff-tab]'))queueMicrotask(checkActive);
    });
    window.addEventListener('vxsk:staff-ready',()=>queueMicrotask(checkActive));
    window.addEventListener('hashchange',()=>queueMicrotask(checkActive));
    document.body.classList.add('vxsk-simple-pro-ready');
    checkActive();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
