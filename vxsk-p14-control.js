/* VXSK P14 UI — no database writes; original RPC/button handlers remain untouched. */
'use strict';
(()=>{
  const $=id=>document.getElementById(id);
  const BOARDS={
    'vxsk-boost-refresh':'applications',
    'vxsk-boost-orders-refresh':'requests',
    'vxsk-coaching-owner-board':'applications',
    'vxsk-coach-booking-board':'requests',
    'vxsk-staff-review-board':'reviews',
    'vxsk-staff-feedback-board':'feedback'
  };
  const refs={
    registrations:['count-pending','vxsk-p14-pending',/^\d+$/],
    coach:['vxsk-coaching-owner-status','vxsk-p14-coaches',/(\d+) coach application/],
    bookings:['vxsk-coach-bookings-status','vxsk-p14-bookings',/(\d+) booking request/],
    reviews:['vxsk-review-staff-status','vxsk-p14-reviews',/(\d+) pending/]
  };
  function updateStats(){
    for(const [name,[source,target,re]] of Object.entries(refs)){
      const node=$(source),out=$(target);if(!node||!out)continue;
      const value=node.textContent.trim();const match=value.match(re);
      if(match)out.textContent=name==='registrations'?value:match[1];
    }
  }
  function bindMetrics(){
    Object.values(refs).forEach(([source])=>{
      const node=$(source);if(node)new MutationObserver(updateStats).observe(node,{childList:true,subtree:true,characterData:true});
    });updateStats();
  }
  function market(){
    const root=$('staff-view-boosters');if(!root)return;
    const tabs=[...root.querySelectorAll('[data-p14-market]')];
    const search=$('vxsk-p14-record-search'),status=$('vxsk-p14-record-status');
    const hint=$('vxsk-p14-market-hint');
    let active='applications';
    function classify(){
      const first=$('vxsk-boost-refresh')?.closest('.staff-arena-card');
      const second=$('vxsk-boost-orders-refresh')?.closest('.staff-arena-card');
      if(first)first.dataset.p14Group='applications';
      if(second)second.dataset.p14Group='requests';
      for(const [id,group] of Object.entries(BOARDS)){
        const b=$(id);if(b && b.classList.contains('staff-arena-card'))b.dataset.p14Group=group;
      }
    }
    function update(){
      classify();
      tabs.forEach(b=>{const selected=b.dataset.p14Market===active;b.classList.toggle('is-active',selected);b.setAttribute('aria-pressed',String(selected));});
      let matching=0;
      const term=(search?.value||'').trim().toLowerCase(),choice=status?.value||'all';
      for(const board of root.querySelectorAll('[data-p14-group]')){
        board.classList.toggle('vxsk-p14-filtered',board.dataset.p14Group!==active);
        for(const row of board.querySelectorAll('.vxsk-boost-staff-row,.vxsk-staff-feedback-entry')){
          const content=(row.textContent||'').toLowerCase();
          const s=(content.match(/status\s*:\s*(pending|approved|rejected|cancelled|completed)/)||[])[1]||'';
          const found=(!term||content.includes(term))&&(choice==='all'||s===choice);
          row.classList.toggle('vxsk-p14-row-hidden',!found);
          if(board.dataset.p14Group===active&&found)matching++;
        }
      }
      const visible=[...root.querySelectorAll('[data-p14-group]')].filter(b=>b.dataset.p14Group===active&&!b.hidden&&getComputedStyle(b).display!=='none');
      hint.textContent=visible.length===0?'No panels available for your verified role in this category.':(matching?`${matching} matching visible record(s).`:'Choose Refresh to load records, or adjust your filters.');
    }
    tabs.forEach(b=>b.addEventListener('click',()=>{active=b.dataset.p14Market;search.value='';status.value='all';update();}));
    search?.addEventListener('input',update);status?.addEventListener('change',update);
    $('vxsk-p14-record-refresh')?.addEventListener('click',()=>{
      classify();
      const lookup={applications:['vxsk-boost-refresh','vxsk-coaching-owner-board'],requests:['vxsk-boost-orders-refresh','vxsk-coach-booking-board'],reviews:['vxsk-staff-review-board'],feedback:['vxsk-staff-feedback-board']};
      for(const id of lookup[active]||[]){
        const n=$(id);const board=n?.classList.contains('staff-arena-card')?n:n?.closest('.staff-arena-card');
        if(!n||board?.hidden||!board||getComputedStyle(board).display==='none')continue;
        const button=n.matches('button')?n:n.querySelector('button');button?.click();
      }
    });
    const watch=new MutationObserver(()=>{update();});
    // Only watch direct child changes: async boards are inserted later; avoid feedback loops from row class updates.
    watch.observe(root,{childList:true});
    window.addEventListener('vxsk:staff-ready',()=>{setTimeout(update,0);});
    document.querySelector('[data-staff-tab="boosters"]')?.addEventListener('click',()=>{setTimeout(update,0);});
    update();
  }
  function init(){bindMetrics();market();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
