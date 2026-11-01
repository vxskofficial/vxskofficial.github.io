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
      for(const row of rows){
        const card=el('div',undefined,'vxsk-boost-staff-row');
        card.append(
          el('strong',`${String(row.service||'request').toUpperCase()} — ${row.total_tnd} DT`),
          el('p',`Player: ${row.nickname||'VXSK player'} · Game: ${GAME[row.game]||'—'} · Qty: ${row.quantity} · Method: ${row.payment_method}`),
          el('p',`Status: ${row.status} · Notes: ${row.note||'None'}`)
        );
        // Only the owner-only RPC provides request rows; the status RPC independently
        // enforces owner + MFA and refuses updates to non-editable records.
        const choices=row.status==='pending'
          ? [['APPROVE REQUEST','approved'],['REJECT REQUEST','rejected'],['CANCEL REQUEST','cancelled']]
          : row.status==='approved'
          ? [['MARK COMPLETED','completed'],['CANCEL REQUEST','cancelled']]
          : [];
        if(choices.length && typeof row.id==='string'){
          const bar=el('div',undefined,'vxsk-boost-staff-actions');
          for(const [label,nextStatus] of choices){
            const button=el('button',label);button.type='button';
            button.addEventListener('click',async()=>{
              const description=`${String(row.service||'service').toUpperCase()} — ${row.total_tnd} DT`;
              const warning=nextStatus==='completed'
                ? 'Only mark completed if the service was actually delivered. This does not verify payment.'
                : 'This action changes request status only; it does not collect or confirm payment.';
              if(!window.confirm(`${label} for ${description}?\n\n${warning}`))return;
              for(const child of bar.querySelectorAll('button'))child.disabled=true;
              msg(status,`Updating request to ${nextStatus}…`);
              try{
                await rpc('vxsk_market_owner_request_status',{
                  p_request_id:row.id,p_status:nextStatus
                });
                await orders();
              }catch(error){
                msg(status,'Request update failed: '+err(error));
                for(const child of bar.querySelectorAll('button'))child.disabled=false;
              }
            });
            bar.append(button);
          }
          card.append(bar);
        }
        list.append(card);
      }
    }catch(error){msg(status,'Owner-only requests unavailable: '+err(error));}
  }


  // P10.8 — Coach applications are owner-only (including MFA enforced inside Supabase).
  function makeCoachBoard(){
    const parent=$('staff-view-boosters');if(!parent||$('vxsk-coaching-owner-board'))return;
    const board=el('section',undefined,'staff-arena-card vxsk-staff-coach-board');board.id='vxsk-coaching-owner-board';board.hidden=true;board.style.display='none';
    const title=el('h3','COACH APPLICATIONS / OWNER REVIEW');
    const help=el('p','Coach applicants must use separate VXSK accounts. Self-approval is blocked. Owner approval publishes a coach profile with the proposed session price; no payment is collected.','small-muted');
    const refreshBtn=el('button','↻ REFRESH COACH APPLICATIONS');refreshBtn.type='button';refreshBtn.addEventListener('click',refreshCoaches);
    const status=el('p','Owner + MFA required.','notice');status.id='vxsk-coaching-owner-status';status.setAttribute('role','status');
    const list=el('div',undefined,'vxsk-boost-staff-list');list.id='vxsk-coaching-owner-list';
    board.append(title,help,refreshBtn,status,list);parent.append(board);
  }
  async function refreshCoaches(){
    const list=$('vxsk-coaching-owner-list'),status=$('vxsk-coaching-owner-status');if(!list)return;
    list.replaceChildren();msg(status,'Checking owner-only coach applications…');
    try{
      const payload=await rpc('vxsk_coaching_owner_applications');const rows=Array.isArray(payload)?payload:[];
      msg(status,`${rows.length} coach application(s) visible to verified owner.`);
      if(!rows.length)list.append(el('p','No coach applications yet.'));
      for(const row of rows){
        const card=el('article',undefined,'vxsk-boost-staff-row');
        card.append(el('strong',`${String(row.nickname||'VXSK member').slice(0,70)} — ${GAME[row.game]||row.game}`),
          el('p',`Status: ${row.status||'pending'} · Proposed price: ${Number(row.price_tnd)||0} DT/session`),
          el('p',String(row.pitch||'').slice(0,450)));
        if(row.status==='pending'&&typeof row.id==='string'){
          const bar=el('div',undefined,'vxsk-boost-staff-actions');
          if(row.self_application){card.append(el('p','Owner cannot approve their own coach application.','small-muted'));}
          else for(const [title,approve] of [['APPROVE COACH',true],['REJECT COACH',false]]){
            const button=el('button',title);button.type='button';
            button.addEventListener('click',async()=>{
              if(!window.confirm(`${title} for ${GAME[row.game]||row.game}? Owner approval will make this coach publicly bookable. No payment is collected.`))return;
              for(const child of bar.querySelectorAll('button'))child.disabled=true;
              try{await rpc('vxsk_coaching_owner_review',{p_application_id:row.id,p_approve:approve});await refreshCoaches();}
              catch(error){msg(status,'Coach review failed: '+err(error));for(const child of bar.querySelectorAll('button'))child.disabled=false;}
            });bar.append(button);
          }
          card.append(bar);
        }
        list.append(card);
      }
    }catch(error){msg(status,'Owner-only coach applications unavailable: '+err(error));}
  }

  function makeCoachBookingsBoard(){
    const parent=$('staff-view-boosters');if(!parent||$('vxsk-coach-booking-board'))return;
    const board=el('section',undefined,'staff-arena-card vxsk-staff-coach-bookings');board.id='vxsk-coach-booking-board';board.hidden=true;board.style.display='none';
    const title=el('h3','COACHING BOOKINGS / OWNER REVIEW');
    const info=el('p','These are requests, not payment confirmation. Mark completed only after coaching has actually been delivered.','small-muted');
    const refresh=el('button','↻ REFRESH COACHING BOOKINGS');refresh.type='button';refresh.addEventListener('click',refreshCoachBookings);
    const status=el('p','Owner + MFA required.','notice');status.id='vxsk-coach-bookings-status';status.setAttribute('role','status');
    const list=el('div',undefined,'vxsk-boost-staff-list');list.id='vxsk-coach-bookings-list';
    board.append(title,info,refresh,status,list);parent.append(board);
  }
  async function refreshCoachBookings(){
    const list=$('vxsk-coach-bookings-list'),status=$('vxsk-coach-bookings-status');if(!list)return;
    list.replaceChildren();msg(status,'Checking owner-only coaching bookings…');
    try{
      const payload=await rpc('vxsk_coaching_owner_bookings');const rows=Array.isArray(payload)?payload:[];
      msg(status,`${rows.length} booking request(s) visible to verified owner.`);
      if(!rows.length)list.append(el('p','No coaching bookings yet.'));
      for(const row of rows){
        const card=el('article',undefined,'vxsk-boost-staff-row');
        card.append(el('strong',`${String(row.coach||'Coach').slice(0,70)} — ${GAME[row.game]||row.game} — ${Number(row.price_tnd)||0} DT`),
          el('p',`Player: ${String(row.player||'VXSK member').slice(0,70)} · Status: ${String(row.status||'pending')} · Method: ${String(row.payment_method||'—')}`),
          el('p',String(row.note||'').slice(0,300)));
        const choices=row.status==='pending'
          ? [['APPROVE BOOKING','approved'],['REJECT BOOKING','rejected'],['CANCEL BOOKING','cancelled']]
          : row.status==='approved'
          ? [['MARK SESSION DELIVERED','completed'],['CANCEL BOOKING','cancelled']] : [];
        if(choices.length&&typeof row.booking_id==='string'){
          const bar=el('div',undefined,'vxsk-boost-staff-actions');
          for(const [label,next] of choices){
            const button=el('button',label);button.type='button';
            button.addEventListener('click',async()=>{
              const warning=next==='completed'?'Confirm the coaching session was actually delivered. This does not verify payment.':'Booking status only. This does not process or confirm payment.';
              if(!window.confirm(`${label} for ${row.coach||'Coach'}?\n\n${warning}`))return;
              for(const child of bar.querySelectorAll('button'))child.disabled=true;
              try{await rpc('vxsk_coaching_owner_booking_status',{p_booking_id:row.booking_id,p_status:next});await refreshCoachBookings();}
              catch(error){msg(status,'Booking review failed: '+err(error));for(const child of bar.querySelectorAll('button'))child.disabled=false;}
            });bar.append(button);
          }
          card.append(bar);
        }
        list.append(card);
      }
    }catch(error){msg(status,'Owner-only coaching bookings unavailable: '+err(error));}
  }
  // P11 — Verified Reviews private moderation panel. Server enforces staff role + MFA,
  // review ownership restrictions, completed source and review status.
  function makeReviewsBoard(){
    const parent=$('staff-view-boosters');if(!parent||$('vxsk-staff-review-board'))return;
    const board=el('section',undefined,'staff-arena-card vxsk-staff-review-board');
    board.id='vxsk-staff-review-board';board.hidden=true;board.style.display='none';
    const title=el('h3','VERIFIED REVIEWS / STAFF MODERATION');
    const info=el('p','A published review requires a real completed coaching booking or boost request. Staff cannot moderate their own review or their own service. No payments are checked here.','small-muted');
    const refreshButton=el('button','↻ REFRESH VERIFIED REVIEWS');refreshButton.type='button';refreshButton.addEventListener('click',refreshVerifiedReviews);
    const status=el('p','Owner / Reviewer + MFA required.','notice');status.id='vxsk-review-staff-status';status.setAttribute('role','status');
    const list=el('div',undefined,'vxsk-boost-staff-list');list.id='vxsk-review-staff-list';
    board.append(title,info,refreshButton,status,list);parent.append(board);
  }
  async function refreshVerifiedReviews(){
    const status=$('vxsk-review-staff-status'),list=$('vxsk-review-staff-list');if(!list)return;
    list.replaceChildren();msg(status,'Checking staff-only verified reviews…');
    try{
      const payload=await rpc('vxsk_market_staff_reviews');const records=Array.isArray(payload)?payload:[];
      const pending=records.filter(row=>row.status==='pending').length;
      msg(status,`${pending} pending · ${records.length} total reviews shown (up to 100, pending first).`);
      if(!records.length){list.append(el('p','No submitted reviews yet.'));return;}
      for(const row of records){
        const card=el('article',undefined,'vxsk-boost-staff-row');
        const stars=Number(row.stars);
        const score=Number.isInteger(stars)&&stars>=1&&stars<=5?'★'.repeat(stars)+'☆'.repeat(5-stars):'UNRATED';
        card.append(
          el('strong',`${score} · ${String(row.service||'service').toUpperCase()} · ${String(row.provider||'VXSK provider').slice(0,70)}`),
          el('p',`Player: ${String(row.reviewer||'VXSK member').slice(0,70)} · Game: ${GAME[row.game]||'VXSK'} · Status: ${String(row.status||'pending')}`),
          el('p',String(row.comment||'').slice(0,350))
        );
        if(row.status==='pending' && typeof row.id==='string'){
          if(row.self_review||row.own_profile){
            card.append(el('p','Self-moderation is blocked. Another authorized reviewer is required.','small-muted'));
          }else{
            const actions=el('div',undefined,'vxsk-boost-staff-actions');
            for(const [label,approved] of [['PUBLISH REVIEW',true],['REJECT REVIEW',false]]){
              const button=el('button',label);button.type='button';
              button.addEventListener('click',async()=>{
                if(!window.confirm(`${label}? Only publish genuine, appropriate reviews after the service was completed.`))return;
                for(const b of actions.querySelectorAll('button'))b.disabled=true;
                try{
                  await rpc('vxsk_market_moderate_review',{p_review_id:row.id,p_approve:approved});
                  await refreshVerifiedReviews();
                }catch(error){msg(status,'Review moderation failed: '+err(error));for(const b of actions.querySelectorAll('button'))b.disabled=false;}
              });actions.append(button);
            }
            card.append(actions);
          }
        }
        list.append(card);
      }
    }catch(error){msg(status,'Staff review list unavailable: '+err(error));}
  }
  // Read-only Staff Command feedback board. Authorization enforced by Supabase RPC, not by this tab.
  function makeFeedbackBoard(){
    const parent=document.getElementById('staff-view-boosters');if(!parent||document.getElementById('vxsk-staff-feedback-board'))return;
    const board=el('section',undefined,'staff-arena-card vxsk-staff-feedback-board');board.id='vxsk-staff-feedback-board';
    const title=el('h3','SERVER FEEDBACK / PRIVATE STAFF INBOX');
    const info=el('p','Feedback is private to authorized VXSK owner/reviewers once the secure backend is installed. Email forwarding to the owner requires a separate verified server-side integration.','small-muted');
    const refreshBtn=el('button','↻ REFRESH FEEDBACK');refreshBtn.type='button';refreshBtn.id='vxsk-feedback-refresh';refreshBtn.addEventListener('click',refreshFeedback);
    const status=el('p','Private inbox not yet checked.','notice');status.id='vxsk-feedback-status';status.setAttribute('role','status');
    const list=el('div',undefined,'vxsk-staff-feedback-list');list.id='vxsk-feedback-list';
    board.append(title,info,refreshBtn,status,list);parent.append(board);
  }
  async function refreshFeedback(){
    const status=$('vxsk-feedback-status'),list=$('vxsk-feedback-list');if(!list)return;
    list.replaceChildren();msg(status,'Checking private staff feedback inbox…');
    try{
      const payload=await rpc('vxsk_server_feedback_staff_list');const records=Array.isArray(payload)?payload:[];
      msg(status,`${records.length} feedback item(s) visible to your verified role.`);
      if(!records.length){list.append(el('p','No feedback yet.'));return;}
      for(const entry of records.slice(0,100)){
        const card=el('article',undefined,'vxsk-staff-feedback-entry');
        const category=String(entry.category||'feedback').slice(0,30).toUpperCase();
        const nickname=String(entry.nickname||'Registered player').slice(0,60);
        card.append(el('strong',`${category} · ${nickname}`),el('p',String(entry.message||'').slice(0,800)));
        list.append(card);
      }
    }catch(error){msg(status,'Verified backend required: '+err(error));}
  }
  const start=()=>{
    makeFeedbackBoard();makeCoachBoard();makeCoachBookingsBoard();makeReviewsBoard();
    $('vxsk-boost-refresh')?.addEventListener('click',refresh);$('vxsk-boost-orders-refresh')?.addEventListener('click',orders);
    document.querySelector('[data-staff-tab="boosters"]')?.addEventListener('click',()=>{refresh();refreshFeedback();refreshVerifiedReviews();});
    window.addEventListener('vxsk:staff-ready',e=>{
      const role=e.detail?.role;
      const allowed=['owner','reviewer'].includes(role);
      const tab=document.querySelector('[data-staff-tab="boosters"]');if(tab)tab.hidden=!allowed;
      const coachBoard=$('vxsk-coaching-owner-board');if(coachBoard){coachBoard.hidden=role!=='owner';coachBoard.style.display=role==='owner'?'':'none';}
      const coachBookingsBoard=$('vxsk-coach-booking-board');if(coachBookingsBoard){coachBookingsBoard.hidden=role!=='owner';coachBookingsBoard.style.display=role==='owner'?'':'none';}
      const reviewBoard=$('vxsk-staff-review-board');if(reviewBoard){reviewBoard.hidden=!allowed;reviewBoard.style.display=allowed?'':'none';}
      if(allowed && location.hash==='#boosters'){refresh();refreshVerifiedReviews();}
      if(allowed){refreshVerifiedReviews();}
      if(role==='owner'){refreshCoaches();refreshCoachBookings();}
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
