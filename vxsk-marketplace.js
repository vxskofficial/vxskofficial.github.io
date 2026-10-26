'use strict';
/* VXSK V12.9.4 — gated marketplace UI. All pricing and authorizations verified server-side by optional RPCs. */
(() => {
  const GAME_LABELS={'valorant':'VALORANT','rocket_league':'ROCKET LEAGUE','league_of_legends':'LEAGUE OF LEGENDS'};
  const METHOD_NAMES={d17:'D17',poste:'La Poste Tunisienne',ooredoo:'Ooredoo',orange:'Orange Tunisie',tt:'Tunisie Telecom (TT)'};
  const METHOD_ICONS={d17:'assets/vxsk-pay-d17.webp',poste:'assets/vxsk-pay-poste.webp',ooredoo:'assets/vxsk-pay-ooredoo.webp',orange:'assets/vxsk-pay-orange.webp',tt:'assets/vxsk-pay-tt.webp'};
  const OPTIONS={jersey:['d17','poste'],coaching:['d17','poste'],rematch:['d17','poste','ooredoo','orange','tt'],boost:['d17','poste']};
  const catalog=[
    {kind:'jersey',tag:'MERCH / STAFF-INSPIRED',title:'VXSK OFFICIAL JERSEY',description:'Black VXSK esports jersey concept. Availability, sizes and delivery must be confirmed.',price:60,unit:'jersey',media:'assets/vxsk-shop-jersey.webp',action:'ORDER REQUEST'},
    {kind:'coaching',tag:'TRAINING / 1-TO-1',title:'COMPETITIVE COACHING',description:'One guided training session for VALORANT, Rocket League or League of Legends.',price:10,unit:'session',media:'assets/vxsk-shop-coaching.webp',action:'BOOK SESSION'},
    {kind:'rematch',tag:'SHOWMATCH / 1V1',title:'REMATCH REQUEST',description:'Request another VXSK 1v1 showmatch. Subject to event availability and approval.',price:5,unit:'rematch',media:'assets/vxsk-shop-rematch.webp',action:'REQUEST REMATCH'}
  ];
  const $=(id)=>document.getElementById(id);
  const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
  const api=()=>window.VXSKAuth?.client||null;
  const state={kind:'',game:'valorant',booster:'',quantity:1,method:'',approved:[],lastGame:'',loading:false};
  const errors=(err)=>String(err?.message||'Request unavailable').replace(/[<>]/g,'').slice(0,180);
  const price=(kind,q=1)=> (kind==='boost'?5*q:kind==='coaching'?10:kind==='rematch'?5:60);
  const currency=(n)=>`${n} DT`;
  const textLabel=(name,tag,attributes={})=>{const l=el('label','vxsk-mkt-field-label',name),e=el(tag,'vxsk-mkt-field');for(const [k,v] of Object.entries(attributes))e.setAttribute(k,v);l.append(e);return {label:l,input:e};};
  const getSession=async()=>{const client=api();if(!client)return null;const {data,error}=await client.auth.getUser();if(error)return null;return data?.user||null;};
  const rpc=async(name,params={})=>{const client=api();if(!client)throw new Error('Supabase is unavailable in this preview.');const {data,error}=await client.rpc(name,params);if(error)throw error;return data;};
  function makeCard(c){
    const a=el('article','vxsk-mkt-card');
    const visual=el('div','vxsk-mkt-visual');const img=el('img');img.src=c.media;img.alt=`${c.title} promotional concept`;img.loading='lazy';visual.append(img);
    const content=el('div','vxsk-mkt-card-content');
    content.append(el('span','vxsk-mkt-tag',c.tag),el('h3','',c.title),el('p','',c.description));
    const bottom=el('div','vxsk-mkt-card-footer');const p=el('div','vxsk-mkt-price');p.append(el('span','',c.kind==='jersey'?'CONCEPT PRICE':`PER ${c.unit.toUpperCase()}`),el('strong','',currency(c.price)));
    const b=el('button','vxsk-mkt-action',c.action);b.type='button';b.addEventListener('click',()=>openModal(c.kind));
    bottom.append(p,b);content.append(bottom);a.append(visual,content);return a;
  }
  function mount(){
    document.getElementById('vxsk-master-shop')?.remove();
    if($('vxsk-marketplace'))return;
    const section=el('section','vxsk-marketplace');section.id='vxsk-marketplace';section.setAttribute('aria-labelledby','vxsk-mkt-title');
    const inside=el('div','vxsk-mkt-inner');inside.append(el('span','vxsk-mkt-kicker','VXSK / SERVICES & MERCH'));
    const title=el('h2','', 'VXSK SHOP & SERVICES');title.id='vxsk-mkt-title';inside.append(title,el('p','vxsk-mkt-intro','Choose a service to see its price and eligible local payment options. Requests are not payments and are reviewed before acceptance.'));
    const cards=el('div','vxsk-mkt-cards');catalog.forEach(c=>cards.append(makeCard(c)));inside.append(cards);
    const boost=el('section','vxsk-mkt-boost');boost.id='vxsk-boosters';
    boost.append(el('span','vxsk-mkt-kicker','VXSK / PLAY TOGETHER'),el('h2','','SELECT YOUR BOOSTER'),el('p','','Choose VALORANT, Rocket League or League of Legends. Only approved VXSK teammates appear here. You keep control of your own game account. No password sharing.'));
    const controls=el('div','vxsk-mkt-boost-controls');
    const game=textLabel('GAME','select',{id:'vxsk-mkt-game'});
    for(const [key,label] of Object.entries(GAME_LABELS)){const o=el('option','',label);o.value=key;game.input.append(o);}
    game.input.addEventListener('change',()=>{state.game=game.input.value;state.booster='';loadBoosters();});controls.append(game.label);
    const qty=el('div','vxsk-mkt-quantity');qty.append(el('span','','GAMES'));
    const dec=el('button','', '−');dec.type='button';dec.setAttribute('aria-label','Remove one game');
    const num=el('output','',String(state.quantity));num.id='vxsk-mkt-qty';num.setAttribute('aria-live','polite');
    const inc=el('button','', '+');inc.type='button';inc.setAttribute('aria-label','Add one game');
    function change(delta){state.quantity=Math.min(40,Math.max(1,state.quantity+delta));num.textContent=String(state.quantity);$('vxsk-mkt-boost-total').textContent=currency(price('boost',state.quantity));}
    dec.addEventListener('click',()=>change(-1));inc.addEventListener('click',()=>change(1));qty.append(dec,num,inc);controls.append(qty);
    const total=el('div','vxsk-mkt-boost-total');total.append(el('span','','5 DT PER GAME'));
    const totalNum=el('strong','',currency(price('boost',state.quantity)));totalNum.id='vxsk-mkt-boost-total';total.append(totalNum);controls.append(total);
    boost.append(controls);
    const result=el('div','vxsk-mkt-booster-list');result.id='vxsk-mkt-booster-list';result.setAttribute('aria-live','polite');boost.append(result);
    const actions=el('div','vxsk-mkt-boost-actions');const request=el('button','vxsk-mkt-action','REQUEST PLAY-TOGETHER');request.type='button';request.id='vxsk-mkt-boost-request';request.disabled=true;request.addEventListener('click',()=>openModal('boost'));const apply=el('button','vxsk-mkt-ghost','APPLY TO BECOME A BOOSTER');apply.type='button';apply.addEventListener('click',openApply);actions.append(request,apply);boost.append(actions);
    inside.append(boost);section.append(inside);(document.querySelector('main')||document.body).append(section);
    const nav=$('nav-links');if(nav&&!nav.querySelector('a[href="#vxsk-marketplace"]')){const link=el('a','vxsk-master-shop-link','SHOP');link.href='#vxsk-marketplace';nav.append(link);}
    const stale=nav?.querySelector('a[href="#vxsk-master-shop"]');if(stale)stale.href='#vxsk-marketplace';
    loadBoosters();
  }
  function showStatus(node,text,good=false){node.textContent=text;node.className='vxsk-mkt-status'+(good?' is-good':'');}
  async function loadBoosters(){
    const box=$('vxsk-mkt-booster-list');if(!box)return;box.replaceChildren(el('p','vxsk-mkt-hint','Loading approved VXSK boosters…'));
    const activeGame=state.game;state.lastGame=activeGame;
    try{
      const rows=await rpc('vxsk_market_boosters',{p_game:activeGame});if(state.lastGame!==activeGame)return;
      state.approved=Array.isArray(rows)?rows:[];box.replaceChildren();
      if(!state.approved.length){box.append(el('p','vxsk-mkt-hint','No approved VXSK boosters for this game yet. Applications are open.'));}
      for(const row of state.approved){
        const card=el('label','vxsk-mkt-booster');const radio=el('input');radio.type='radio';radio.name='vxsk-approved-booster';radio.value=row.booster_id;radio.checked=state.booster===row.booster_id;
        radio.addEventListener('change',()=>{state.booster=radio.value;$('vxsk-mkt-boost-request').disabled=false;});
        const icon=el('span','vxsk-mkt-booster-avatar','VX');const body=el('span');body.append(el('strong','',String(row.nickname||'VXSK Booster')),el('small','',GAME_LABELS[row.game]||''));
        card.append(radio,icon,body);box.append(card);
      }
      $('vxsk-mkt-boost-request').disabled=!state.booster;
    }catch(e){state.approved=[];$('vxsk-mkt-boost-request').disabled=true;box.replaceChildren(el('p','vxsk-mkt-hint','Approved booster list will appear here after the private Supabase setup.'));}
  }
  function closeHandler(dialog){dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('close',()=>{dialog.remove();});}
  function modal(title,subtitle){
    const d=el('dialog','vxsk-mkt-dialog');d.setAttribute('aria-label',title);const head=el('div','vxsk-mkt-dialog-header');head.append(el('h2','',title),el('p','',subtitle));
    const close=el('button','vxsk-mkt-close','✕');close.type='button';close.setAttribute('aria-label','Close dialog');close.addEventListener('click',()=>d.close());head.append(close);
    const contents=el('div','vxsk-mkt-dialog-body');d.append(head,contents);document.body.append(d);closeHandler(d);d.showModal();return {dialog:d,contents};
  }
  function methodButtons(kind,onChange){
    const grid=el('div','vxsk-mkt-method-grid');grid.setAttribute('role','radiogroup');grid.setAttribute('aria-label','Payment method');state.method='';
    for(const method of OPTIONS[kind]){
      const lab=el('label','vxsk-mkt-method');const input=el('input');input.type='radio';input.name='vxsk-mkt-method';input.value=method;
      input.addEventListener('change',()=>{state.method=method;onChange(method);});
      const image=el('img');image.src=METHOD_ICONS[method];image.alt='';image.loading='lazy';lab.append(input,image,el('strong','',METHOD_NAMES[method]));grid.append(lab);
    }return grid;
  }
  function openModal(kind){
    state.kind=kind;const title=kind==='jersey'?'JERSEY ORDER REQUEST':kind==='coaching'?'BOOK A COACHING SESSION':kind==='rematch'?'SHOWMATCH REMATCH REQUEST':'REQUEST A VXSK BOOSTER';
    const {dialog,contents}=modal(title,'Choose an available local method for this service. A request is not a confirmed purchase or payment.');
    const form=el('form','vxsk-mkt-order-form');form.noValidate=true;
    const sum=el('div','vxsk-mkt-order-summary');sum.append(el('strong','',currency(price(kind,state.quantity))),el('span','',kind==='boost'?`${state.quantity} game(s) × 5 DT`:kind==='coaching'?'1 session × 10 DT':kind==='rematch'?'1 rematch × 5 DT':'1 jersey × 60 DT'));form.append(sum);
    let gameSel=null;if(kind==='coaching'||kind==='rematch'){
      const pick=textLabel('GAME','select');gameSel=pick.input;for(const [key,name] of Object.entries(GAME_LABELS)){const op=el('option','',name);op.value=key;gameSel.append(op);}form.append(pick.label);
    }
    if(kind==='jersey'){form.append(el('p','vxsk-mkt-hint','This jersey is a concept. Availability, sizes and delivery will be confirmed before any purchase.'));}
    if(kind==='boost'){if(!state.booster){form.append(el('p','vxsk-mkt-hint','Select an approved booster first.'));}else {const chosen=state.approved.find(x=>x.booster_id===state.booster);form.append(el('p','vxsk-mkt-hint',`Selected: ${chosen?.nickname||'VXSK booster'} · ${GAME_LABELS[state.game]}`));}}
    form.append(el('h3','vxsk-mkt-dialog-label','CHOOSE PAYMENT METHOD'));
    const paymentInfo=el('p','vxsk-mkt-hint','Payment options will only be available after a request is reviewed. Never post recharge PINs, passwords or payment details in chat.');
    form.append(methodButtons(kind,(method)=>{
      if(method==='d17')paymentInfo.textContent='D17: transfer arrangements are handled through official channels after approval. Choosing D17 does not transfer money.';
      else if(method==='poste')paymentInfo.textContent='La Poste Tunisienne: a verified account or mandate procedure must be confirmed separately. No automatic payment here.';
      else paymentInfo.textContent=`${METHOD_NAMES[method]}: telephone recharge methods require owner verification before use. Do not send recharge PINs or card images into the website.`;
    }),paymentInfo);
    const extra=textLabel('NOTES (optional — no payment codes)','textarea',{maxlength:'400',rows:'3',placeholder:'Preferred schedule / message to the VXSK team'});form.append(extra.label);
    const message=el('p','vxsk-mkt-status');message.setAttribute('role','status');message.setAttribute('aria-live','polite');form.append(message);
    const submit=el('button','vxsk-mkt-action','SEND REQUEST FOR REVIEW');submit.type='submit';form.append(submit);
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(!state.method){showStatus(message,'Choose a payment option first.');return;}
      if(kind==='boost'&&!state.booster){showStatus(message,'Select an approved booster.');return;}
      const user=await getSession();if(!user){showStatus(message,'Sign in with VXSK first.');return;}
      submit.disabled=true;showStatus(message,'Submitting request…');
      try{
        const data=await rpc('vxsk_market_create_request',{p_service:kind,p_game:kind==='boost'?state.game:(gameSel?.value||null),p_booster:kind==='boost'?state.booster:null,p_quantity:kind==='boost'?state.quantity:1,p_method:state.method,p_note:extra.input.value.trim()});
        showStatus(message,`Request ${String(data).slice(0,8)} recorded for OWNER review. No payment was made.`,true);submit.textContent='REQUEST SENT';
      }catch(err){showStatus(message,'Not accepted: '+errors(err));submit.disabled=false;}
    });
    contents.append(form);
  }
  function openApply(){
    const {contents}=modal('BECOME A VXSK BOOSTER','Apply for one game. Only approved applicants appear on the public booster list. Owner / Reviewer checks applications.');
    const form=el('form','vxsk-mkt-order-form');const game=textLabel('GAME','select');for(const [key,name] of Object.entries(GAME_LABELS)){const opt=el('option','',name);opt.value=key;game.input.append(opt);}
    const desc=textLabel('EXPERIENCE / PLAY STYLE','textarea',{maxlength:'450',minlength:'15',rows:'5',required:'',placeholder:'Tell VXSK about your experience and availability. Never share account credentials.'});form.append(game.label,desc.label);
    const note=el('p','vxsk-mkt-status');note.setAttribute('role','status');note.setAttribute('aria-live','polite');const submit=el('button','vxsk-mkt-action','SUBMIT APPLICATION');submit.type='submit';form.append(note,submit);
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(desc.input.value.trim().length<15){showStatus(note,'Please write at least 15 characters.');return;}
      const user=await getSession();if(!user){showStatus(note,'Sign in to VXSK first.');return;}
      submit.disabled=true;try{await rpc('vxsk_market_apply',{p_game:game.input.value,p_pitch:desc.input.value.trim()});showStatus(note,'Application sent. You will appear in the public list only after approval.',true);submit.textContent='APPLICATION SENT';}
      catch(err){showStatus(note,'Not accepted: '+errors(err));submit.disabled=false;}
    });contents.append(form);
  }
  const start=()=>mount();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
