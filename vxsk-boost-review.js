'use strict';
/* VXSK Staff Command booster reviews: Supabase SECURITY DEFINER RPCs are authoritative. */
(() => {
  const $=id=>document.getElementById(id);
  const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;};
  const rpc=async(name,p={})=>{const api=window.VXSK_STAFF_API;if(!api)throw Error('Verified staff session is not ready.');const {data,error}=await api.rpc(name,p);if(error)throw error;return data;};
  const msg=(node,text)=>{if(node)node.textContent=text;};
  const err=e=>String(e?.message||'Not authorized or backend not installed').slice(0,200);
  const GAME={'valorant':'VALORANT','rocket_league':'ROCKET LEAGUE','league_of_legends':'LEAGUE OF LEGENDS'};
  async function refresh(){
    const status=$('vxsk-boost-staff-status'),list=$('vxsk-boost-staff-list');if(!list)return;
    msg(status,'Checking applications with Supabase…');list.replaceChildren();
    try{const data=await rpc('vxsk_market_review_list');const rows=Array.isArray(data)?data:[];msg(status,`${rows.length} application(s) visible to your role.`);
      if(!rows.length)list.append(el('p','No booster applications yet.'));
      for(const row of rows){
        const card=el('div',undefined,'vxsk-boost-staff-row');card.append(el('strong',`${row.nickname||'Registered player'} — ${GAME[row.game]||row.game}`),el('p',`Status: ${row.status||'pending'} · Applied: ${new Date(row.created_at).toLocaleDateString()}`),el('p',row.pitch||''));
        if(row.status==='pending'){
          const bar=el('div',undefined,'vxsk-boost-staff-actions');
          for(const [text,approved] of [['APPROVE',true],['REJECT',false]]){
            const b=el('button',text);b.type='button';b.addEventListener('click',async()=>{
              if(!window.confirm(`${text} this booster application for ${GAME[row.game]||row.game}?`))return;
              b.disabled=true;try{await rpc('vxsk_market_review',{p_application_id:row.application_id,p_approve:approved});await refresh();}
              catch(error){msg(status,err(error));b.disabled=false;}
            });bar.append(b);
          }card.append(bar);
        }list.append(card);
      }
    }catch(error){msg(status,'Access denied or private SQL not installed: '+err(error));}
  }
  async function orders(){const status=$('vxsk-boost-owner-status'),list=$('vxsk-boost-owner-list');if(!list)return;
    list.replaceChildren();msg(status,'Checking owner-only access…');
    try{const data=await rpc('vxsk_market_owner_requests');const rows=Array.isArray(data)?data:[];msg(status,`${rows.length} requests visible to verified owner.`);
      if(!rows.length)list.append(el('p','No requests yet.'));
      for(const row of rows){const card=el('div',undefined,'vxsk-boost-staff-row');card.append(el('strong',`${row.service.toUpperCase()} — ${row.total_tnd} DT`),el('p',`Player: ${row.nickname||'VXSK player'} · Game: ${GAME[row.game]||'—'} · Qty: ${row.quantity} · Method: ${row.payment_method}`),el('p',`Status: ${row.status} · Notes: ${row.note||'None'}`));list.append(card);}
    }catch(error){msg(status,'Owner-only requests unavailable: '+err(error));}
  }
  const start=()=>{
    $('vxsk-boost-refresh')?.addEventListener('click',refresh);$('vxsk-boost-orders-refresh')?.addEventListener('click',orders);
    document.querySelector('[data-staff-tab="boosters"]')?.addEventListener('click',()=>refresh());
    window.addEventListener('vxsk:staff-ready',e=>{
      const role=e.detail?.role;
      const allowed=['owner','reviewer'].includes(role);
      const tab=document.querySelector('[data-staff-tab="boosters"]');if(tab)tab.hidden=!allowed;
      if(allowed && location.hash==='#boosters')refresh();
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
