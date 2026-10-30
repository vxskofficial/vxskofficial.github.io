'use strict';
/* VXSK V12.9.4 — gated marketplace UI. All pricing and authorizations verified server-side by optional RPCs. */
(() => {
  const GAME_LABELS={'valorant':'VALORANT','rocket_league':'ROCKET LEAGUE','league_of_legends':'LEAGUE OF LEGENDS'};
  const METHOD_NAMES={d17:'D17',poste:'La Poste Tunisienne',ooredoo:'Ooredoo',orange:'Orange Tunisie',tt:'Tunisie Telecom (TT)'};
  const METHOD_ICONS={d17:'assets/vxsk-pay-d17.webp',poste:'assets/vxsk-pay-poste.webp',ooredoo:'assets/vxsk-pay-ooredoo.webp',orange:'assets/vxsk-pay-orange.webp',tt:'assets/vxsk-pay-tt.webp'};
  const OPTIONS={jersey:['d17','poste'],coaching:['d17','poste'],rematch:['d17','poste','ooredoo','orange','tt'],boost:['d17','poste']};
  const catalog=[
    {kind:'jersey',tag:'MERCH / STAFF-INSPIRED',title:'VXSK OFFICIAL JERSEY',description:'Staff-inspired jersey. Loyal members may qualify for 10% off after 30+ days of verified participation, pending secure review.',price:60,unit:'jersey',media:'assets/vxsk-shop-jersey.webp',action:'ORDER REQUEST'},
    {kind:'coaching',tag:'TRAINING / VXSK COACHES',title:'COMPETITIVE COACHING',description:'Explore approved VXSK coaches, their specialties, verified player reviews and individual session prices.',price:null,unit:'session',media:'assets/vxsk-shop-coaching.webp',action:'EXPLORE COACHES'},
    {kind:'rematch',tag:'SHOWMATCH / 1V1',title:'REMATCH REQUEST',description:'Request another VXSK 1v1 showmatch. Subject to event availability and approval.',price:5,unit:'rematch',media:'assets/vxsk-shop-rematch.webp',action:'REQUEST REMATCH'}
  ];
  const $=(id)=>document.getElementById(id);
  const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
  const api=()=>window.VXSKAuth?.client||null;
  const state={kind:'',game:'valorant',booster:'',quantity:1,method:'',approved:[],lastGame:'',loading:false,currentRank:'',targetRank:'',currentDivision:'IV',targetDivision:'IV'};
  const errors=(err)=>String(err?.message||'Request unavailable').replace(/[<>]/g,'').slice(0,180);
  const price=(kind,q=1)=> (kind==='boost'?5*q:kind==='rematch'?5:kind==='jersey'?60:null); // Coaching price must come from a verified, approved coach on the server.
  const currency=(n)=>`${n} DT`;
  const textLabel=(name,tag,attributes={})=>{const l=el('label','vxsk-mkt-field-label',name),e=el(tag,'vxsk-mkt-field');for(const [k,v] of Object.entries(attributes))e.setAttribute(k,v);l.append(e);return {label:l,input:e};};
  const getSession=async()=>{const client=api();if(!client)return null;const {data,error}=await client.auth.getUser();if(error)return null;return data?.user||null;};
  const rpc=async(name,params={})=>{const client=api();if(!client)throw new Error('Supabase is unavailable in this preview.');const {data,error}=await client.rpc(name,params);if(error)throw error;return data;};
  function makeCard(c){
    const a=el('article','vxsk-mkt-card');
    const visual=el('div','vxsk-mkt-visual');const img=el('img');img.src=c.media;img.alt=`${c.title} promotional concept`;img.loading='lazy';visual.append(img);
    const content=el('div','vxsk-mkt-card-content');
    content.append(el('span','vxsk-mkt-tag',c.tag),el('h3','',c.title),el('p','',c.description));
    const bottom=el('div','vxsk-mkt-card-footer');const p=el('div','vxsk-mkt-price');p.append(el('span','',c.kind==='coaching'?'INDIVIDUAL COACH PRICING':c.kind==='jersey'?'STANDARD PRICE':`PER ${c.unit.toUpperCase()}`),el('strong','',c.kind==='coaching'?'SET BY COACH':currency(c.price)));
    const b=el('button','vxsk-mkt-action',c.action);b.type='button';b.addEventListener('click',()=>c.kind==='coaching'?$('vxsk-coach-directory')?.scrollIntoView({behavior:'smooth',block:'start'}):openModal(c.kind));
    bottom.append(p,b);content.append(bottom);a.append(visual,content);return a;
  }
  function mount(){
    if(document.body?.dataset.vxskPage!=='merch')return; // Never inject marketplace panels into the VXSK homepage.
    document.getElementById('vxsk-master-shop')?.remove();
    if($('vxsk-marketplace'))return;
    const section=el('section','vxsk-marketplace');section.id='vxsk-marketplace';section.setAttribute('aria-labelledby','vxsk-mkt-title');
    const inside=el('div','vxsk-mkt-inner');inside.append(el('span','vxsk-mkt-kicker','VXSK / MERCH & SERVICES'));
    const title=el('h2','', 'VXSK MERCH & SERVICES');title.id='vxsk-mkt-title';inside.append(title,el('p','vxsk-mkt-intro','Choose a service to see its price and eligible local payment options. Requests are not payments and are reviewed before acceptance.'));
    const cards=el('div','vxsk-mkt-cards');catalog.forEach(c=>cards.append(makeCard(c)));inside.append(cards);
    const coaches=buildCoachDirectory();inside.append(coaches);
    const boost=el('section','vxsk-mkt-boost');boost.id='vxsk-boosters';
    boost.append(el('span','vxsk-mkt-kicker','VXSK / PLAY TOGETHER'),el('h2','','SELECT YOUR BOOSTER'),el('p','','Choose VALORANT, Rocket League or League of Legends. Only approved VXSK teammates appear here. You keep control of your own game account. No password sharing.'));
    const controls=el('div','vxsk-mkt-boost-controls');
    const game=textLabel('GAME','select',{id:'vxsk-mkt-game'});
    for(const [key,label] of Object.entries(GAME_LABELS)){const o=el('option','',label);o.value=key;game.input.append(o);}
    game.input.addEventListener('change',()=>{state.game=game.input.value;state.booster='';renderRankChoices();loadBoosters();});controls.append(game.label);
    const qty=el('div','vxsk-mkt-quantity');qty.append(el('span','','GAMES'));
    const dec=el('button','', '−');dec.type='button';dec.setAttribute('aria-label','Remove one game');
    const num=el('output','',String(state.quantity));num.id='vxsk-mkt-qty';num.setAttribute('aria-live','polite');
    const inc=el('button','', '+');inc.type='button';inc.setAttribute('aria-label','Add one game');
    function change(delta){state.quantity=Math.min(40,Math.max(1,state.quantity+delta));num.textContent=String(state.quantity);$('vxsk-mkt-boost-total').textContent=currency(price('boost',state.quantity));}
    dec.addEventListener('click',()=>change(-1));inc.addEventListener('click',()=>change(1));qty.append(dec,num,inc);controls.append(qty);
    const total=el('div','vxsk-mkt-boost-total');total.append(el('span','','5 DT PER GAME'));
    const totalNum=el('strong','',currency(price('boost',state.quantity)));totalNum.id='vxsk-mkt-boost-total';total.append(totalNum);controls.append(total);
    boost.append(controls,buildRankPanel());
    const result=el('div','vxsk-mkt-booster-list');result.id='vxsk-mkt-booster-list';result.setAttribute('aria-live','polite');boost.append(result);
    const actions=el('div','vxsk-mkt-boost-actions');const request=el('button','vxsk-mkt-action','CONFIRM BOOST REQUEST');request.type='button';request.id='vxsk-mkt-boost-request';request.disabled=true;request.addEventListener('click',()=>openModal('boost'));const apply=el('button','vxsk-mkt-ghost','APPLY TO BECOME A BOOSTER');apply.type='button';apply.addEventListener('click',openApply);const edit=el('button','vxsk-mkt-ghost','EDIT MY BOOSTER PROFILE');edit.type='button';edit.addEventListener('click',openEditBoosterProfile);
    actions.append(request,apply,edit);boost.append(actions);
    inside.append(boost);section.append(inside);(document.querySelector('main')||document.body).append(section);renderRankChoices();
    const nav=$('nav-links');if(nav&&!nav.querySelector('a[href="#vxsk-marketplace"]')){const link=el('a','vxsk-master-shop-link','MERCH');link.href='#vxsk-marketplace';nav.append(link);}
    const stale=nav?.querySelector('a[href="#vxsk-master-shop"]');if(stale)stale.href='#vxsk-marketplace';
    loadBoosters();loadCoaches();
  }
  function showStatus(node,text,good=false){node.textContent=text;node.className='vxsk-mkt-status'+(good?' is-good':'');}
  async function loadBoosters(){
    const box=$('vxsk-mkt-booster-list');if(!box)return;box.replaceChildren(el('p','vxsk-mkt-hint','Loading approved VXSK boosters…'));
    const activeGame=state.game;state.lastGame=activeGame;
    try{
      const rows=await rpc('vxsk_market_boosters',{p_game:activeGame});if(state.lastGame!==activeGame)return;
      state.approved=Array.isArray(rows)?rows:[];box.replaceChildren();
      if(!state.approved.length){box.append(el('div','vxsk-coach-empty','☆☆☆☆☆ · No verified booster profiles or ratings yet for this game. Applications are open.'));}
      for(const row of state.approved){
        const card=el('label','vxsk-mkt-booster');const radio=el('input');radio.type='radio';radio.name='vxsk-approved-booster';radio.value=row.booster_id;radio.checked=state.booster===row.booster_id;
        radio.addEventListener('change',()=>{state.booster=radio.value;$('vxsk-mkt-boost-request').disabled=false;});
        const avatar=safePhoto(row.avatar_url);let icon;
        if(avatar){icon=el('img','vxsk-mkt-booster-avatar-photo');icon.src=avatar;icon.alt='';icon.loading='lazy';}
        else icon=el('span','vxsk-mkt-booster-avatar',String(row.nickname||'VX').slice(0,2).toUpperCase());
        const body=el('span','vxsk-mkt-booster-body');body.append(el('strong','',String(row.nickname||'VXSK Booster').slice(0,70)),el('small','',GAME_LABELS[row.game]||''));
        if(row.rank_name)body.append(el('small','vxsk-booster-rank',`SELF-REPORTED RANK · ${String(row.rank_name).slice(0,35)}${row.rank_division?' '+String(row.rank_division):''}`));
        else body.append(el('small','vxsk-booster-rank','Rank not provided yet'));
        if(row.region)body.append(el('small','vxsk-booster-region',`Region: ${String(row.region).slice(0,40)}`));
        if(row.availability)body.append(el('small','vxsk-booster-availability',`Availability: ${String(row.availability).slice(0,80)}`));
        if(row.nationality)body.append(el('small','vxsk-booster-nation',String(row.nationality).slice(0,60)));
        if(row.bio)body.append(el('small','vxsk-booster-bio',String(row.bio).slice(0,180)));
        const reviews=el('button','vxsk-mkt-reviews-open',validRating(row));reviews.type='button';reviews.addEventListener('click',event=>{event.preventDefault();openReviews(row.booster_id,String(row.nickname||'VXSK Booster'));});
        const profile=el('button','vxsk-mkt-reviews-open','VIEW PROFILE ↗');profile.type='button';profile.addEventListener('click',event=>{event.preventDefault();openBoosterProfile(row);});
        const meta=el('span','vxsk-mkt-booster-extra');meta.append(el('small','','5 DT / game'),profile,reviews);card.append(radio,icon,body,meta);box.append(card);
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
    if(kind==='coaching'){document.getElementById('vxsk-coach-directory')?.scrollIntoView({behavior:'smooth'});return;}
    state.kind=kind;const title=kind==='jersey'?'JERSEY ORDER REQUEST':kind==='coaching'?'CHOOSE A VERIFIED COACH':kind==='rematch'?'SHOWMATCH REMATCH REQUEST':'REQUEST A VXSK BOOSTER';
    const {dialog,contents}=modal(title,'Choose an available local method for this service. A request is not a confirmed purchase or payment.');
    const form=el('form','vxsk-mkt-order-form');form.noValidate=true;
    const sum=el('div','vxsk-mkt-order-summary');sum.append(el('strong','',currency(price(kind,state.quantity))),el('span','',kind==='boost'?`${state.quantity} game(s) × 5 DT`:kind==='coaching'?'Select a coach to see pricing':kind==='rematch'?'1 rematch × 5 DT':'1 jersey × 60 DT'));form.append(sum);
    let gameSel=null;if(kind==='rematch'){
      const pick=textLabel('GAME','select');gameSel=pick.input;for(const [key,name] of Object.entries(GAME_LABELS)){const op=el('option','',name);op.value=key;gameSel.append(op);}form.append(pick.label);
    }
    if(kind==='jersey'){form.append(el('p','vxsk-mkt-hint','Standard 60 DT. Members with 30+ days of verified activity may qualify for 10% off (54 DT), subject to secure owner verification. Availability, sizes and delivery must be confirmed.'));}
    if(kind==='boost'){if(!state.booster){form.append(el('p','vxsk-mkt-hint','Select an approved booster first.'));}else {const chosen=state.approved.find(x=>x.booster_id===state.booster);form.append(el('p','vxsk-mkt-hint',`Selected: ${chosen?.nickname||'VXSK booster'} · ${GAME_LABELS[state.game]}`));}}
    if(kind==='boost')form.append(el('p','vxsk-mkt-hint','Rank goal (informational only): '+rankSummary()));
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
      if(kind==='boost'&&(!state.currentRank||!state.targetRank||state.currentRank===state.targetRank)){showStatus(message,'Choose different current and target ranks.');return;}
      const user=await getSession();if(!user){showStatus(message,'Sign in with VXSK first.');return;}
      submit.disabled=true;showStatus(message,'Submitting request…');
      try{
        const data=await rpc('vxsk_market_create_request',{p_service:kind,p_game:kind==='boost'?state.game:(gameSel?.value||null),p_booster:kind==='boost'?state.booster:null,p_quantity:kind==='boost'?state.quantity:1,p_method:state.method,p_note:((kind==='boost'?(`Requested rank path (goal only, not guaranteed): ${rankSummary()} | `):kind==='jersey'?'Loyalty discount review requested (60 DT standard; possible 54 DT only with server-verified 30+ days participation). | ':'')+extra.input.value.trim()).slice(0,400)});
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

  // P10.1: edit only the authenticated player's own approved profile.
  // Server RPC verifies ownership; UI checks are not security boundaries.
  async function openEditBoosterProfile(){
    const user=await getSession();
    if(!user){const {contents}=modal('SIGN IN REQUIRED','Open My Account on this hosted VXSK preview and sign in before editing your own booster profile.');contents.append(el('p','vxsk-mkt-hint','Login sessions do not work from local file:// pages.'));return;}
    let profiles;
    try{profiles=await rpc('vxsk_market_my_booster_profiles');}
    catch(error){const {contents}=modal('PROFILE EDITOR UNAVAILABLE','P10.1 database upgrade is required.');contents.append(el('p','vxsk-mkt-status',errors(error)));return;}
    if(!Array.isArray(profiles)||!profiles.length){const {contents}=modal('NO APPROVED BOOSTER PROFILE','Only your own approved booster profile can be edited.');contents.append(el('p','vxsk-mkt-hint','Submit a booster application and have it reviewed by a different authorized staff member first.'));return;}
    const {contents}=modal('EDIT MY BOOSTER PROFILE','Choose your game, add a logo/photo and self-reported rank. Never share passwords or account identifiers. Public photos are visible to everyone.');
    const form=el('form','vxsk-mkt-order-form');
    const chooser=textLabel('YOUR APPROVED GAME','select');
    for(const item of profiles){const o=el('option','',`${GAME_LABELS[item.game]||item.game} — ${item.nickname||'VXSK Booster'}`);o.value=item.booster_id;chooser.input.append(o);}
    const nickname=textLabel('DISPLAY NAME','input',{maxlength:'70',minlength:'2',required:'',placeholder:'Your VXSK nickname'});
    const bio=textLabel('ABOUT YOUR PLAY STYLE','textarea',{maxlength:'700',rows:'4',placeholder:'Your experience, specialties and what you can help with. No contact details.'});
    const rank=textLabel('YOUR RANK IN THIS GAME (SELF-REPORTED)','select');
    const division=textLabel('RANK DIVISION','select');
    const region=textLabel('SERVER REGION','select');
    for(const [value,label] of [['','Not specified'],['EU','Europe'],['MENA','Middle East / North Africa'],['NA','North America'],['Other','Other']]){const o=el('option','',label);o.value=value;region.input.append(o);}
    const nationality=textLabel('COUNTRY / NATIONALITY (OPTIONAL)','input',{maxlength:'60',placeholder:'Optional public profile field'});
    const availability=textLabel('AVAILABILITY (OPTIONAL)','input',{maxlength:'80',placeholder:'Example: Weekends, evenings UTC+1'});
    const photo=textLabel('PUBLIC PHOTO OR TEAM LOGO (OPTIONAL)','input',{type:'file',accept:'image/png,image/jpeg,image/webp'});
    const hint=el('p','vxsk-mkt-hint','PNG / JPG / WEBP, up to 1.5 MB. A team logo is fine; no personal photo is required. Uploaded images will be public.');
    const status=el('p','vxsk-mkt-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const submit=el('button','vxsk-mkt-action','SAVE MY PROFILE');submit.type='submit';
    form.append(chooser.label,nickname.label,bio.label,rank.label,division.label,region.label,nationality.label,availability.label,photo.label,hint,status,submit);
    const getSelected=()=>profiles.find(p=>p.booster_id===chooser.input.value)||profiles[0];
    function fill(){
      const p=getSelected();nickname.input.value=String(p.nickname||'');bio.input.value=String(p.bio||'');
      rank.input.replaceChildren();for(const [label] of (RANKS[p.game]||[])){const option=el('option','',label);option.value=label;rank.input.append(option);}
      rank.input.value=p.rank_name||(RANKS[p.game]?.[0]?.[0]||'');
      division.input.replaceChildren();for(const label of ['','I','II','III','IV']){const o=el('option','',label||'No division');o.value=label;division.input.append(o);}
      division.input.value=p.rank_division||'';region.input.value=p.region||'';nationality.input.value=p.nationality||'';availability.input.value=p.availability||'';
      photo.input.value='';status.textContent='';
    }
    chooser.input.addEventListener('change',fill);fill();
    form.addEventListener('submit',async event=>{
      event.preventDefault();const p=getSelected();const name=nickname.input.value.trim(),about=bio.input.value.trim();
      if(name.length<2||about.length<20){showStatus(status,'Add a display name (2+) and an about section (20+ characters).');return;}
      const file=photo.input.files?.[0];
      if(file&&(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1572864)){
        showStatus(status,'Choose a PNG/JPG/WEBP up to 1.5 MB.');return;
      }
      submit.disabled=true;showStatus(status,'Saving your profile…');
      try{
        let path=null;
        if(file){
          const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
          path=`${user.id}/${crypto.randomUUID()}.${ext}`;
          const {error}=await api().storage.from('vxsk-booster-photos').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
          if(error)throw error;
        }
        await rpc('vxsk_market_update_my_booster_profile',{
          p_booster_id:p.booster_id,p_nickname:name,p_bio:about,p_rank_name:rank.input.value,
          p_rank_division:division.input.value,p_region:region.input.value,
          p_availability:availability.input.value.trim(),p_nationality:nationality.input.value.trim(),p_avatar_path:path
        });
        showStatus(status,'Profile saved! Your public profile will show the new details after refresh.',true);
        submit.textContent='SAVED';await loadBoosters();
      }catch(error){showStatus(status,'Not saved: '+errors(error));submit.disabled=false;}
    });
    contents.append(form);
  }

  // V12.9.4 next UI: VXSK existing ranks/assets, NO copied competitor UI.
  const RANKS={
    valorant:[['Unranked','assets/ranks/valo-unranked.svg'],['Iron','assets/rank-badges/val-iron.webp'],['Bronze','assets/rank-badges/val-bronze.webp'],['Silver','assets/rank-badges/val-silver.webp'],['Gold','assets/rank-badges/val-gold.webp'],['Platinum','assets/rank-badges/val-platinum.webp'],['Diamond','assets/rank-badges/val-diamond.webp'],['Ascendant','assets/rank-badges/val-ascendant.svg'],['Immortal','assets/rank-badges/val-immortal.webp'],['Radiant','assets/rank-badges/val-radiant.webp']],
    rocket_league:[['Unranked','assets/ranks/rl-unranked.svg'],['Bronze','assets/rank-badges/rl-bronze.webp'],['Silver','assets/rank-badges/rl-silver.webp'],['Gold','assets/rank-badges/rl-gold.webp'],['Platinum','assets/rank-badges/rl-platinum.webp'],['Diamond','assets/rank-badges/rl-diamond.webp'],['Champion','assets/rank-badges/rl-champion.webp'],['Grand Champion','assets/rank-badges/rl-grand-champion.webp'],['Supersonic Legend','assets/rank-badges/rl-supersonic-legend.webp']],
    league_of_legends:[['Unranked','assets/ranks/lol-unranked.svg'],['Iron','assets/rank-badges/lol-iron.webp'],['Bronze','assets/rank-badges/lol-bronze.webp'],['Silver','assets/rank-badges/lol-silver.webp'],['Gold','assets/rank-badges/lol-gold.webp'],['Platinum','assets/rank-badges/lol-platinum.webp'],['Emerald','assets/rank-badges/lol-emerald.webp'],['Diamond','assets/rank-badges/lol-diamond.webp'],['Master','assets/rank-badges/lol-master.webp'],['Grandmaster','assets/rank-badges/lol-grandmaster.webp'],['Challenger','assets/rank-badges/lol-challenger.webp']]
  };
  const GAME_ICONS={valorant:'assets/game-valorant.webp',rocket_league:'assets/game-rocket.webp',league_of_legends:'assets/game-league.webp'};
  function rankSummary(){return `${GAME_LABELS[state.game]}: ${state.currentRank||'Not set'} ${state.currentDivision} → ${state.targetRank||'Not set'} ${state.targetDivision}`;}
  function buildRankPanel(){
    const panel=el('div','vxsk-rank-panel');panel.id='vxsk-rank-panel';
    panel.append(el('h3','','YOUR CURRENT RANK & TARGET'),el('p','vxsk-mkt-hint','Tap VXSK rank badges to describe your goal. Your actual result is not guaranteed; 5 DT is charged per requested play-together game, subject to approval.'));
    const grids=el('div','vxsk-rank-columns');
    for(const key of ['current','target']){
      const group=el('fieldset','vxsk-rank-group');group.id=`vxsk-rank-${key}`;
      const legend=el('legend','',key==='current'?'01 / CURRENT RANK':'02 / TARGET RANK');group.append(legend);
      const row=el('div','vxsk-rank-options');row.id=`vxsk-rank-options-${key}`;group.append(row);
      const division=el('label','vxsk-rank-division');division.append(el('span','','DIVISION'));
      const select=el('select','vxsk-mkt-field');select.id=`vxsk-${key}-division`;select.setAttribute('aria-label',`${key} rank division`);
      for(const val of ['IV','III','II','I']){const opt=el('option','',val);opt.value=val;select.append(opt);}
      select.addEventListener('change',()=>{state[key+'Division']=select.value;updateRankSummary();});division.append(select);group.append(division);grids.append(group);
    }
    const summary=el('p','vxsk-rank-summary','');summary.id='vxsk-rank-summary';summary.setAttribute('aria-live','polite');panel.append(grids,summary);return panel;
  }
  function updateRankSummary(){const node=$('vxsk-rank-summary');if(node)node.textContent='REQUESTED GOAL · '+rankSummary()+' · Not a rank guarantee.';}
  function renderRankChoices(){
    const choices=RANKS[state.game]||[];
    if(!choices.some(x=>x[0]===state.currentRank))state.currentRank=choices[0]?.[0]||'';
    if(!choices.some(x=>x[0]===state.targetRank)||state.targetRank===state.currentRank)state.targetRank=choices[Math.min(3,choices.length-1)]?.[0]||'';
    for(const key of ['current','target']){
      const row=$(`vxsk-rank-options-${key}`);if(!row)continue;row.replaceChildren();
      for(const [name,file] of choices){if(key==='target'&&name==='Unranked')continue;
        const b=el('button','vxsk-rank-choice');b.type='button';b.setAttribute('aria-pressed',String(state[key+'Rank']===name));
        b.setAttribute('aria-label',`${key==='current'?'Current':'Target'} ${name}`);
        const img=el('img');img.src=file;img.alt='';img.loading='lazy';b.append(img,el('span','',name));
        b.addEventListener('click',()=>{state[key+'Rank']=name;for(const item of row.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item===b));updateDivisionState();updateRankSummary();});row.append(b);
      }
    }
    updateDivisionState();updateRankSummary();
  }
  function updateDivisionState(){
    for(const key of ['current','target']){
      const select=$(`vxsk-${key}-division`);if(!select)continue;
      const val=state[key+'Rank'];const noDivision=val==='Unranked'||(state.game==='valorant'&&['Immortal','Radiant'].includes(val))||(state.game==='rocket_league'&&val==='Supersonic Legend')||(state.game==='league_of_legends'&&['Master','Grandmaster','Challenger'].includes(val));
      select.disabled=noDivision;select.title=noDivision?'This rank does not use IV–I divisions.':'';
      if(noDivision)state[key+'Division']='';else {state[key+'Division']=select.value||'IV';}
    }
  }
  function buildCoachDirectory(){
    const section=el('section','vxsk-coach-directory');section.id='vxsk-coach-directory';
    section.append(el('span','vxsk-mkt-kicker','VXSK / COACHING'),el('h2','','MEET YOUR COACHES'),el('p','vxsk-mkt-intro','Choose a verified coach, open their full profile, and see their own session price. Ratings appear only after verified completed bookings — never invented.'));
    const filters=el('div','vxsk-coach-filters');const pick=textLabel('SPECIALTY','select',{id:'vxsk-coach-filter'});
    for(const [key,name] of [['all','ALL GAMES'],...Object.entries(GAME_LABELS)]){const opt=el('option','',name);opt.value=key;pick.input.append(opt);}
    pick.input.addEventListener('change',loadCoaches);const refresh=el('button','vxsk-mkt-ghost','REFRESH COACHES');refresh.type='button';refresh.addEventListener('click',loadCoaches);
    filters.append(pick.label,refresh);section.append(filters);
    const cards=el('div','vxsk-coach-grid');cards.id='vxsk-coach-list';cards.setAttribute('aria-live','polite');section.append(cards);
    const apply=el('p','vxsk-mkt-hint','Want to coach? Applications and coach-set prices will open only after the private Supabase approval workflow is tested.');section.append(apply);
    return section;
  }
  const safePhoto=(uri)=>{try{const u=new URL(String(uri),location.href);return (u.origin===location.origin || (u.hostname==='opzqnmahfgehaewgciwg.supabase.co'&&u.pathname.startsWith('/storage/v1/object/public/')))?u.href:null;}catch{return null;}};
  function numberPrice(v){const n=Number(v);return Number.isInteger(n)&&n>0&&n<=1000?n:null;}
  async function loadCoaches(){
    const container=$('vxsk-coach-list');if(!container)return;
    container.replaceChildren(el('p','vxsk-mkt-hint','Loading approved VXSK coaches…'));
    try{
      const payload=await rpc('vxsk_coaching_public_profiles');const all=Array.isArray(payload)?payload:[];
      const game=$('vxsk-coach-filter')?.value||'all';const approved=all.filter(x=>x&&x.coach_id&&x.approved===true&&(game==='all'||x.game===game));
      container.replaceChildren();if(!approved.length){container.append(el('div','vxsk-coach-empty', '☆☆☆☆☆ · No verified coaching reviews yet. Approved coach profiles and individual prices will appear here.'));return;}
      for(const coach of approved){const priceValue=numberPrice(coach.price_tnd);if(!priceValue)continue;
        const card=el('article','vxsk-coach-card');const top=el('div','vxsk-coach-top');const imgPath=safePhoto(coach.avatar_url);
        if(imgPath){const img=el('img','vxsk-coach-photo');img.src=imgPath;img.alt='';img.loading='lazy';top.append(img);}else top.append(el('span','vxsk-coach-monogram',String(coach.nickname||'VX').slice(0,2).toUpperCase()));
        const id=el('div');id.append(el('h3','',String(coach.nickname||'VXSK Coach')));
        const specialty=el('span','vxsk-coach-specialty');if(GAME_ICONS[coach.game]){const gameIcon=el('img');gameIcon.src=GAME_ICONS[coach.game];gameIcon.alt='';specialty.append(gameIcon);}specialty.append(el('span','',GAME_LABELS[coach.game]||'VXSK'));id.append(specialty);top.append(id);
        const bio=el('p','vxsk-coach-bio',String(coach.bio||'VXSK coaching profile').slice(0,220));
        const rating=el('p','vxsk-coach-rating',validRating(coach));
        const foot=el('div','vxsk-coach-foot');foot.append(el('strong','vxsk-coach-price',`${priceValue} DT / session`));
        const profile=el('button','vxsk-mkt-ghost','VIEW PROFILE');profile.type='button';profile.addEventListener('click',()=>openCoachProfile(coach));
        const book=el('button','vxsk-mkt-action','BOOK SESSION');book.type='button';book.addEventListener('click',()=>openCoachBooking(coach));foot.append(profile,book);
        card.append(top,bio,rating,foot);container.append(card);
      }
      if(!container.childElementCount)container.append(el('p','vxsk-mkt-hint','No coach profiles with approved pricing are available yet.'));
    }catch(e){container.replaceChildren(el('div','vxsk-coach-empty','☆☆☆☆☆ · No verified coaches or ratings available yet. The private approval backend must be installed first.'));}
  }
  function validRating(c){const count=Number(c.reviews_count),avg=Number(c.reviews_avg);if(Number.isInteger(count)&&count>0&&Number.isFinite(avg)&&avg>=1&&avg<=5)return `★ ${avg.toFixed(1)} (${count} verified review${count===1?'':'s'})`;return '☆ No verified reviews yet';}
  async function openReviews(id,displayName){
    const {contents}=modal(`REVIEWS · ${displayName}`,'Verified player reviews only. Public reviews require completed sessions and moderation.');
    const list=el('div','vxsk-review-list');list.append(el('p','vxsk-mkt-hint','Checking verified reviews…'));contents.append(list);
    try{const data=await rpc('vxsk_market_verified_reviews',{p_profile_id:id});const rows=Array.isArray(data)?data:[];list.replaceChildren();
      if(!rows.length){list.append(el('p','vxsk-mkt-hint','No verified reviews yet.'));return;}
      for(const r of rows.slice(0,30)){
        const n=Number(r.stars);if(!Number.isInteger(n)||n<1||n>5)continue;
        const item=el('article','vxsk-review-entry');item.append(el('strong','',`${'★'.repeat(n)}${'☆'.repeat(5-n)} · Verified review`),el('p','',String(r.comment||'').slice(0,350)));list.append(item);
      }
    }catch{list.replaceChildren(el('p','vxsk-mkt-hint','Verified reviews are not available until the private feedback/reviews backend is installed.'));}
    const form=el('form','vxsk-review-submit');const heading=el('h3','','LEAVE A VERIFIED REVIEW');
    const hint=el('p','vxsk-mkt-hint','Only players with a completed verified booking may leave a review. Staff and the server validate eligibility.');
    const stars=textLabel('YOUR RATING','select');stars.input.required=true;
    for(let score=5;score>=1;score--){const opt=el('option','',`${'★'.repeat(score)}${'☆'.repeat(5-score)} · ${score}/5`);opt.value=String(score);stars.input.append(opt);}
    const comment=textLabel('REVIEW (20–350 characters)','textarea',{maxlength:'350',minlength:'20',rows:'3',required:'',placeholder:'Share what went well and what could improve. Avoid personal details.'});
    const status=el('p','vxsk-mkt-status');status.setAttribute('role','status');
    const submit=el('button','vxsk-mkt-action','SUBMIT FOR VERIFICATION');submit.type='submit';
    form.append(heading,hint,stars.label,comment.label,status,submit);contents.append(form);
    form.addEventListener('submit',async event=>{event.preventDefault();const msg=comment.input.value.trim();if(msg.length<20){showStatus(status,'Please write at least 20 characters.');return;}
      if(!await getSession()){showStatus(status,'Sign in to VXSK to leave a review.');return;}
      submit.disabled=true;try{await rpc('vxsk_market_submit_verified_review',{p_profile_id:id,p_stars:Number(stars.input.value),p_comment:msg});
        showStatus(status,'Review submitted for verification. It is not public until accepted.',true);comment.input.value='';}
      catch{showStatus(status,'Review submission unavailable or you do not have a verified completed booking.');submit.disabled=false;}
    });
  }
  function openBoosterProfile(booster){
    const nick=String(booster.nickname||'VXSK Booster').slice(0,70);
    const {contents}=modal(`BOOSTER · ${nick}`,'Approved VXSK booster. No player account passwords or logins are required.');
    const row=el('div','vxsk-coach-detail');const photo=safePhoto(booster.avatar_url);
    if(photo){const img=el('img','vxsk-coach-photo');img.src=photo;img.alt='';row.append(img);}
    else row.append(el('span','vxsk-coach-monogram',nick.slice(0,2).toUpperCase()));
    const details=el('div');details.append(el('h3','',nick),el('p','',GAME_LABELS[booster.game]||GAME_LABELS[state.game]||'VXSK'),el('strong','vxsk-coach-price','5 DT / game'),el('p','',validRating(booster)));
    if(booster.rank_name){
      const badge=(RANKS[booster.game]||[]).find(x=>x[0]===booster.rank_name);
      if(badge){const rankimg=el('img','vxsk-booster-profile-rank-image');rankimg.src=badge[1];rankimg.alt='';rankimg.loading='lazy';details.append(rankimg);}
      details.append(el('p','vxsk-booster-rank',`Self-reported rank: ${String(booster.rank_name).slice(0,35)}${booster.rank_division?' '+String(booster.rank_division):''}`));
    }else details.append(el('p','vxsk-booster-rank','Rank not added yet'));
    if(booster.region)details.append(el('p','',`Server region: ${String(booster.region).slice(0,40)}`));
    if(booster.availability)details.append(el('p','',`Availability: ${String(booster.availability).slice(0,80)}`));
    if(booster.nationality)details.append(el('p','',`Nationality: ${String(booster.nationality).slice(0,60)}`));row.append(details);contents.append(row);
    contents.append(el('p','vxsk-coach-fullbio',String(booster.bio||'Full biography has not yet been provided by this booster.').slice(0,700)));
    const actions=el('div','vxsk-mkt-boost-actions');const read=el('button','vxsk-mkt-ghost','VERIFIED REVIEWS');read.type='button';read.addEventListener('click',()=>openReviews(booster.booster_id,nick));
    const select=el('button','vxsk-mkt-action','CHOOSE THIS BOOSTER');select.type='button';select.addEventListener('click',()=>{
      state.booster=booster.booster_id;const input=[...document.querySelectorAll('input[name="vxsk-approved-booster"]')].find(x=>x.value===booster.booster_id);
      if(input)input.checked=true;const req=$('vxsk-mkt-boost-request');if(req){req.disabled=false;req.scrollIntoView({block:'center',behavior:'smooth'});}
      document.querySelectorAll('dialog.vxsk-mkt-dialog').forEach(d=>{if(d.open)d.close();});
    });actions.append(read,select);contents.append(actions);
  }
  function openCoachProfile(coach){
    const {contents}=modal(`COACH · ${String(coach.nickname||'VXSK Coach').slice(0,70)}`,'Approved VXSK coach profile — details provided and verified by the staff team.');
    const intro=el('div','vxsk-coach-detail');const pic=safePhoto(coach.avatar_url);
    if(pic){const img=el('img','vxsk-coach-photo');img.src=pic;img.alt='';intro.append(img);}else intro.append(el('span','vxsk-coach-monogram',String(coach.nickname||'VX').slice(0,2).toUpperCase()));
    const about=el('div');about.append(el('h3','',String(coach.nickname||'VXSK Coach')),el('p','',GAME_LABELS[coach.game]||'VXSK'),el('strong','vxsk-coach-price',`${numberPrice(coach.price_tnd)||'—'} DT / session`),el('p','',validRating(coach)));if(coach.nationality)about.append(el('p','',`Nationality: ${String(coach.nationality).slice(0,60)}`));intro.append(about);contents.append(intro);
    contents.append(el('p','vxsk-coach-fullbio',String(coach.bio||'No additional description provided.').slice(0,700)));
    const buttons=el('div','vxsk-mkt-boost-actions');const rev=el('button','vxsk-mkt-ghost','READ VERIFIED REVIEWS');rev.type='button';rev.addEventListener('click',()=>openReviews(coach.coach_id,String(coach.nickname||'VXSK Coach')));
    const book=el('button','vxsk-mkt-action','BOOK THIS COACH');book.type='button';book.addEventListener('click',()=>openCoachBooking(coach));buttons.append(rev,book);contents.append(buttons);
  }
  function openCoachBooking(coach){
    const coachPrice=numberPrice(coach.price_tnd);if(!coachPrice)return;
    const {contents}=modal('COACHING BOOKING REQUEST','The coach sets their price. The server must verify that price, approval, and identity before accepting a booking. No payment happens on this page.');
    const form=el('form','vxsk-mkt-order-form');const summary=el('div','vxsk-mkt-order-summary');summary.append(el('strong','',`${coachPrice} DT`),el('span','',`${String(coach.nickname||'VXSK Coach')} · 1 session`));form.append(summary);
    const method=el('p','vxsk-mkt-hint','D17 and La Poste Tunisienne only. A real transfer is arranged after approval.');form.append(method,methodButtons('coaching',()=>{}));
    const note=textLabel('SESSION PREFERENCE (optional)','textarea',{maxlength:'300',rows:'3',placeholder:'What would you like to work on? No passwords or payment details.'});form.append(note.label);
    const status=el('p','vxsk-mkt-status');status.setAttribute('role','status');form.append(status);
    const submit=el('button','vxsk-mkt-action','SEND COACHING REQUEST');submit.type='submit';form.append(submit);
    form.addEventListener('submit',async e=>{e.preventDefault();if(!state.method){showStatus(status,'Choose D17 or La Poste first.');return;}
      if(!await getSession()){showStatus(status,'Sign in to VXSK first.');return;}submit.disabled=true;
      try{await rpc('vxsk_coaching_create_booking',{p_coach_id:coach.coach_id,p_method:state.method,p_note:note.input.value.trim()});showStatus(status,'Request recorded for owner review. No payment made.',true);submit.textContent='REQUEST SENT';}
      catch(err){showStatus(status,'Backend verification required: '+errors(err));submit.disabled=false;}
    });contents.append(form);
  }
  function buildFeedbackPanel(){
    const sec=el('section','vxsk-server-feedback');sec.id='vxsk-server-feedback';
    sec.append(el('span','vxsk-mkt-kicker','VXSK / COMMUNITY'),el('h2','','SERVER FEEDBACK'),el('p','vxsk-mkt-intro','Help us improve VXSK. Reports and suggestions go to verified owner/reviewer staff once the private inbox backend is enabled. Email notification requires a separate verified server integration.'));
    const form=el('form','vxsk-mkt-feedback-form');const category=textLabel('CATEGORY','select');for(const c of [['suggestion','Suggestion'],['bug','Bug / technical issue'],['community','Community feedback'],['safety','Safety concern']]){const opt=el('option','',c[1]);opt.value=c[0];category.input.append(opt);}
    const body=textLabel('YOUR MESSAGE','textarea',{maxlength:'800',minlength:'20',rows:'4',required:'',placeholder:'Explain your suggestion or issue. Do not include passwords, recharge PINs, private IDs or payment details.'});
    const status=el('p','vxsk-mkt-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const send=el('button','vxsk-mkt-action','SEND FEEDBACK');send.type='submit';form.append(category.label,body.label,status,send);
    form.addEventListener('submit',async e=>{e.preventDefault();const message=body.input.value.trim();if(message.length<20){showStatus(status,'Please provide at least 20 characters.');return;}if(!await getSession()){showStatus(status,'Sign in to VXSK to submit feedback.');return;}
      send.disabled=true;try{await rpc('vxsk_server_feedback_submit',{p_category:category.input.value,p_message:message});showStatus(status,'Feedback received by the private staff inbox. No email delivery is claimed.',true);send.textContent='FEEDBACK SENT';body.input.value='';}
      catch(error){showStatus(status,'Feedback inbox unavailable: '+errors(error));send.disabled=false;}
    });sec.append(form);return sec;
  }

  const start=()=>mount();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
