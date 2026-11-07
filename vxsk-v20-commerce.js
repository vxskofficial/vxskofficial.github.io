/* VXSK V20 buyer checkout. Orders remain server-priced and manually verified.
   Payment evidence is private (2 MiB WebP, up to five images/order).
   This is NOT automatic D17, Orange or Ooredoo payment processing. */
'use strict';
(()=>{
 if(document.body?.dataset.vxskPage!=='merch')return;
 const $=id=>document.getElementById(id);
 const make=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined&&txt!==null)x.textContent=String(txt);if(cls)x.className=cls;return x;};
 let api=null,orders=[],selected=null,files=[],busy=false;
 const recipient='56661169';
 const methods={d17:'D17 mobile transfer',poste:'La Poste Tunisienne',ooredoo:'Ooredoo Tunisia',orange:'Orange Tunisia',tt:'Tunisie Telecom'};
 function client(){api=api||window.VXSKAuth?.client;if(!api)throw Error('Please sign in through the VXSK website first.');return api;}
 async function rpc(name,params={}){const {data,error}=await client().rpc(name,params);if(error)throw Error(error.message);return data;}
 function status(msg,error=false){const n=$('v20-market-state');if(n){n.textContent=msg;n.dataset.error=error?'1':'0';}}
 async function getUser(){const {data,error}=await client().auth.getUser();if(error||!data?.user)throw Error('Sign in to submit your order and upload photos.');return data.user;}
 async function loadOrders(){const menu=$('v20-market-order');if(!menu)return;
  menu.replaceChildren();const choice=make('option','Choose your order');choice.value='';menu.append(choice);
  try{await getUser();orders=await rpc('vxsk_v20_my_orders');
   for(const o of orders){const opt=make('option',`${o.service.toUpperCase()} · ${o.total_tnd} DT · ${o.status} · ${o.payment_state||'not submitted'}`);opt.value=o.id;menu.append(opt);}
   if(selected&&orders.some(o=>o.id===selected)){menu.value=selected;}else if(orders.length){selected=orders[0].id;menu.value=selected;}
   showOrder();status(`${orders.length} order(s) found. Only verified transfers count as paid.`);
  }catch(e){status(e.message,true);selected=null;showOrder();}
 }
 function showOrder(){const output=$('v20-market-order-detail'),button=$('v20-market-submit');if(!output||!button)return;
  output.replaceChildren();const row=orders.find(x=>x.id===selected);
  if(!row){output.append(make('p','Choose an order. Start by selecting a service above.'));button.disabled=true;return;}
  output.append(make('strong',`${String(row.service).toUpperCase()} · ${row.total_tnd} DT`),
   make('p',`${methods[row.payment_method]||row.payment_method} · Order status: ${row.status}`),
   make('p',`Payment review: ${(row.payment_state||'not submitted').replaceAll('_',' ').toUpperCase()} · ${row.photo_count||0}/5 uploaded photos`));
  if(row.owner_note)output.append(make('p','Owner note: '+row.owner_note));
  const channel=make('p');channel.append('Transfer recipient supplied by VXSK: ',make('b',recipient));output.append(channel);
  output.append(make('p','Important: 56661169 is a contact/transfer number supplied by VXSK. Verify in the official payment app before sending. A simple phone-number QR is not a provider-approved payment QR.'));
  const allowed=['pending','approved'].includes(row.status) && !['awaiting_review','verified'].includes(row.payment_state||'');
  button.disabled=!allowed;const picker=$('v20-market-add-photo');if(picker)picker.disabled=!allowed;
  $('v20-market-submit').textContent=row.payment_state==='verified'?'PAYMENT VERIFIED BY OWNER':row.payment_state==='awaiting_review'?'WAITING FOR OWNER VERIFICATION':'UPLOAD PHOTOS & SUBMIT PROOF';
 }
 function showPhotos(){const host=$('v20-market-images');if(!host)return;
  host.replaceChildren();for(let i=0;i<files.length;i++){
   const f=files[i],card=make('article',null,'v20-buyer-photo');
   const img=make('img');img.src=f.url;img.alt=`Selected proof ${i+1}`;img.loading='lazy';
   const remove=make('button','×');remove.type='button';remove.setAttribute('aria-label',`Remove proof ${i+1}`);
   remove.addEventListener('click',()=>{URL.revokeObjectURL(f.url);files.splice(i,1);showPhotos();});
   card.append(img,remove,make('small',`PHOTO ${i+1}`));host.append(card);
  }
  const btn=make('button','＋ ADD PHOTO','v20-buyer-photo-add');btn.type='button';btn.addEventListener('click',()=>$('v20-market-photos')?.click());
  host.append(btn);
 }
 async function compress(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Only JPEG, PNG and WEBP photos are supported.');
  if(file.size>15*1024*1024)throw Error('Use photos under 15 MB.');
  const url=URL.createObjectURL(file);
  try{const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Could not read image'));im.src=url;});
   const size=Math.min(1,1440/Math.max(image.naturalWidth,image.naturalHeight));
   const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(image.naturalWidth*size));cv.height=Math.max(1,Math.round(image.naturalHeight*size));
   cv.getContext('2d',{alpha:false}).drawImage(image,0,0,cv.width,cv.height);
   for(const quality of [.82,.68,.52,.38]){
    const blob=await new Promise(res=>cv.toBlob(res,'image/webp',quality));
    if(blob&&blob.size<=1950000)return blob;
   }throw Error('Photo too large after compression; choose a smaller image.');
  }finally{URL.revokeObjectURL(url);}
 }
 async function sendProof(){if(busy||!selected)return;const row=orders.find(x=>x.id===selected);if(!row)return;
  if(!files.length && !row.photo_count)return status('Add at least one receipt/card photo before sending for review.',true);
  if((row.photo_count||0)+files.length>5)return status('Maximum 5 photos per order. Remove extra photos.',true);
  try{await getUser();busy=true;const btn=$('v20-market-submit');btn.disabled=true;
   for(let i=0;i<files.length;i++){
    status(`Preparing private photo ${i+1} of ${files.length}…`);
    const compressed=await compress(files[i].file);
    const path=await rpc('vxsk_v20_reserve_proof',{p_request:selected});
    try{const {error}=await client().storage.from('vxsk-payment-proofs').upload(path,compressed,{contentType:'image/webp',upsert:false});
     if(error)throw Error(error.message);
    }catch(e){try{await rpc('vxsk_v20_cancel_proof_reservation',{p_path:path});}catch(_){};throw e;}
   }
   status('Submitting proof to VXSK Owner…');
   await rpc('vxsk_v20_submit_payment',{p_request:selected});
   files.forEach(f=>URL.revokeObjectURL(f.url));files=[];showPhotos();await loadOrders();
   status('Proof submitted privately. Owner will independently verify the transfer; this is not automatically PAID.');
  }catch(e){status('Not submitted: '+e.message,true);}finally{busy=false;showOrder();}
 }
 function mount(){const intro=document.querySelector('.vxsk-merch-intro');if(!intro||$('v20-buyer-guide'))return;
  const guide=make('section',null,'v20-buyer-guide');guide.id='v20-buyer-guide';
  guide.innerHTML='<div class="v20-buyer-head"><span class="v20-eyebrow">VXSK / SIMPLE & SECURE SHOPPING</span><h2>BUYER EXPERIENCE</h2><p>Pick a service, request an order, then submit private transfer evidence for Owner review.</p></div><div class="v20-buyer-steps"><span><b>01</b> PICK SERVICE</span><span><b>02</b> CHOOSE PAYMENT</span><span><b>03</b> SEND PROOF</span><span><b>04</b> OWNER VERIFIES</span></div><div class="v20-buyer-methods"><span>D17</span><span>LA POSTE</span><span>ORANGE</span><span>OOREDOO</span><span>TUNISIE TELECOM</span></div><p class="v20-buyer-note">No card passwords, account PINs or OTP codes. Transfer and voucher codes are sensitive; evidence is private, never posted to public chat. Do not pay until VXSK confirms service availability.</p>';
  intro.insertAdjacentElement('afterend',guide);
  const panel=make('section',null,'v20-buyer-checkout');panel.id='v20-buyer-checkout';
  panel.innerHTML='<div class="v20-buyer-head"><span class="v20-eyebrow">VXSK / PRIVATE PAYMENT REVIEW</span><h2>MY ORDERS & PAYMENT PROOF</h2><p>Owner-confirmed manual transfers only. No bank/card credentials are entered on VXSK.</p></div><div class="v20-buyer-select"><label for="v20-market-order">SELECT YOUR ORDER</label><select id="v20-market-order"><option>Loading…</option></select><button type="button" id="v20-market-refresh">↻ REFRESH ORDERS</button></div><div id="v20-market-order-detail" class="v20-buyer-summary"></div><div id="v20-market-images" class="v20-buyer-images"></div><input type="file" id="v20-market-photos" accept="image/png,image/jpeg,image/webp" hidden multiple><div class="v20-buyer-cta"><button id="v20-market-submit" type="button">UPLOAD PHOTOS & SUBMIT PROOF</button></div><p id="v20-market-state" class="v20-buyer-status" role="status" aria-live="polite">Sign in to view your orders.</p><p class="v20-buyer-note">A valid D17/provider merchant payment QR is not yet connected. No fake QR is shown. A transfer is marked verified only after Owner checks the actual provider transaction.</p>';
  const footer=document.querySelector('.vxsk-merch-footer');if(footer)footer.before(panel);else document.body.append(panel);
  $('v20-market-order').addEventListener('change',e=>{selected=e.target.value;showOrder();});
  $('v20-market-refresh').addEventListener('click',loadOrders);
  $('v20-market-submit').addEventListener('click',sendProof);
  $('v20-market-photos').addEventListener('change',e=>{
   for(const file of [...e.target.files]){
    if(files.length+(orders.find(o=>o.id===selected)?.photo_count||0)>=5)break;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15*1024*1024){status('Some photos were skipped. Accept JPG/PNG/WEBP up to 15 MB.',true);continue;}
    files.push({file,url:URL.createObjectURL(file)});
   }e.target.value='';showPhotos();
  });
  showPhotos();void loadOrders();
  window.addEventListener('vxsk:v20-order-created',e=>{
   const id=typeof e.detail?.requestId==='string'?e.detail.requestId:null;
   if(id)selected=id;void loadOrders();
   panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
