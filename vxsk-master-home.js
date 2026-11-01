'use strict';
/* VXSK V12.9.4 master preview: additive UI only. No RPC, payments, role changes or user-data collection. */
(() => {
  const start = () => {
    const $ = id => document.getElementById(id);
    const make = (tag, cls, value) => { const n=document.createElement(tag); if(cls)n.className=cls; if(value!==undefined)n.textContent=value; return n; };
    const accountDialog=$('account-dialog');
    function showDms(){
      // Use the existing auth-controlled account opener, not a second account/login handler.
      // The real authenticated profile panel is #auth-panel-profile.
      // If signed out, open the existing authentication dialog and do not
      // navigate to private community tabs before authentication succeeds.
      const profilePanel=$('auth-panel-profile');
      if (!accountDialog?.open || profilePanel?.hidden) {
        document.querySelector('.account-nav.open-account')?.click();
      }
      if (!accountDialog?.open || !profilePanel || profilePanel.hidden) return;
      // My Account P2 puts the *original* live community nodes inside these tabs.
      const reveal = () => {
        const main=$('vxsk-ah-tab-community');
        const friends=$('vxsk-ah-community-tab-friends');
        if(!main || !friends)return;
        main.click();friends.click();
        const chat=$('community-chat');
        if(chat && !chat.hidden){chat.scrollIntoView({block:'nearest',behavior:'smooth'});return;}
        $('community-friends')?.scrollIntoView({block:'nearest',behavior:'smooth'});
      };
      reveal();setTimeout(reveal,80);
    }
    // Repair legacy header DM shortcuts only; never intercept compose/send/message actions.
    document.addEventListener('click',event=>{
      const b=event.target.closest?.('#nav-dm-toggle, #nav-dm, .nav-dm-toggle, .nav-dm-btn, [data-open-dms], a[href="#community-chat"], .vxsk-master-dms');
      const headerTarget=event.target.closest?.('.header button, .header a');
      const text=(headerTarget?.getAttribute('aria-label')||'')+' '+(headerTarget?.getAttribute('title')||'');
      if(!b && !(headerTarget && /\bdirect messages\b|\bDMs?\b/i.test(text)))return;
      event.preventDefault();event.stopPropagation();showDms();
    },true);
    const nav=document.querySelector('.header .vxsk-community-nav');
    if(nav && !$('vxsk-master-dm-shortcut') && !document.querySelector('#nav-dm-toggle, #nav-dm, .nav-dm-toggle, .nav-dm-btn, [data-open-dms], .header [aria-label*="direct message" i], .header [title*="direct message" i]')){
      const b=make('button','vxsk-master-dms','✉ DMs'); b.type='button';b.id='vxsk-master-dm-shortcut';
      b.title='Open your direct messages in My Account';b.setAttribute('aria-label','Open direct messages in My Account');
      nav.append(b);
    }
    // Public naming: two intentionally separate content categories, preserving old element IDs.
    const updates=$('bulletin-announcements')?.closest('.bulletin-column');
    const heading=updates?.querySelector('.bulletin-column-head h3');
    if(heading)heading.textContent='WEBSITE UPDATES';
    const eyebrow=updates?.querySelector('.bulletin-column-head span');
    if(eyebrow)eyebrow.textContent='01 / SERVER & COMMUNITY NEWS';
    const empty=updates?.querySelector('.empty-state h3');if(empty && /NEWS COMING SOON/i.test(empty.textContent))empty.textContent='UPDATES COMING SOON';
    // Remove deprecated No Opponent UI without deleting historical Supabase records.
    $('find-rival')?.setAttribute('hidden','');
    for(const a of document.querySelectorAll('a[href="#find-rival"],button[data-staff-tab="opponents"]'))a.hidden=true;
    const oldOpp=$('my-opponents-title');if(oldOpp){const wrapper=oldOpp.closest('.account-option, .account-card, section');if(wrapper && wrapper!==$('account-profile'))wrapper.hidden=true;}
    // The shop and marketplace are provided by vxsk-marketplace.js.
    // Keeping this V12.9.4 file focused on homepage / DM UI avoids duplicate cards.

  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
