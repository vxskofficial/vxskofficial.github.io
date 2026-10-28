/* VXSK home Phase 2 — keep privacy controls reachable under My Account, show verified partner data only. */
'use strict';(()=>{
  function start(){
    // Move existing opt-in presence controls out of the busy homepage.
    // Existing community.js handlers remain attached. Opt-in is preserved for privacy.
    const privacy=document.getElementById('community-privacy-controls');
    const settings=document.querySelector('#account-dialog .account-settings-grid');
    if(privacy&&settings){
      const option=document.createElement('div');option.className='account-option';
      const title=document.createElement('h3');title.textContent='ONLINE STATUS PRIVACY';
      const detail=document.createElement('p');detail.textContent='Choose whether accepted friends may see your Online status while your browser is active. Offline otherwise.';
      option.append(title,detail,privacy);settings.append(option);
    }
    // Weekly standings remain blank unless server returns verified rows.
    const list=document.getElementById('vxsk-weekly-list');const status=document.getElementById('vxsk-weekly-status');
    if(!list||!status)return;
    const tryRefresh=async()=>{
      const client=window.VXSKAuth?.client;if(!client)return;
      try{const {data,error}=await client.rpc('vxsk_partner_weekly_standings');if(error||!Array.isArray(data))return;
        const allowed=new Map([['vortex_tn','VORTEX TN'],['drax_esports','DRAX ESPORTS'],['n2xt_esports','N2XT ESPORTS']]);
        const clean=data.filter(x=>allowed.has(String(x.team_key))&&Number.isInteger(Number(x.verified_points))&&Number(x.verified_points)>=0&&x.is_verified===true).sort((a,b)=>b.verified_points-a.verified_points).slice(0,10);
        if(!clean.length)return;
        list.replaceChildren();for(const entry of clean){const row=document.createElement('div');row.className='vxsk-weekly-row';
          const name=document.createElement('span');name.textContent=allowed.get(String(entry.team_key));const points=document.createElement('strong');points.textContent=String(entry.verified_points)+' verified points';row.append(name,points);list.append(row);}
        status.textContent='Current week · verified community support only. Figures update when VXSK staff validate qualifying activity.';
      }catch{ /* backend optional */ }
    };
    tryRefresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();