'use strict';
/* VXSK P13: owner-only PUBLIC crew presentation. This does not create users, assign staff_roles or bypass existing staff access. */
(() => {
  const $ = id => document.getElementById(id);
  const api = () => window.VXSK_STAFF_API;
  const ownerOnly = () => !!window.VXSK_STAFF_API && allowed;
  let allowed = false, list = [], selected = null, busy = false, previewUrl = null;
  const form = $('vxsk-p13-form');
  if (!form) return;
  const fallback = 'assets/vxsk-logo.png';
  const msg = (value,kind='') => { const el=$('vxsk-p13-status');el.textContent=value;el.dataset.kind=kind; };
  const image = path => {
    const s = String(path||'');
    if (/^assets\/vxsk-team-[a-z0-9-]+\.webp$/.test(s)) return s;
    if (/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpe?g|png)$/.test(s)) {
      const root=String(window.VXSK_SUPABASE?.url||'').replace(/\/$/,'');
      return root+'/storage/v1/object/public/vxsk-crew-photos/'+s;
    }
    return fallback;
  };
  const el = (tag, text, className) => {
    const e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e;
  };
  const sectionLabel = s => ({leadership:'Leadership',management:'Operations',community:'Community'})[s]||'Crew';
  const fresh = () => {
    selected=null; form.reset();$('vxsk-p13-id').value='';$('vxsk-p13-order').value='10';$('vxsk-p13-visible').checked=true;
    $('vxsk-p13-form-title').textContent='ADD A CREW MEMBER';
    if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
    $('vxsk-p13-preview').src=fallback;
  };
  function choose(row) {
    selected=row;
    if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
    $('vxsk-p13-id').value=row.id;
    $('vxsk-p13-name').value=row.display_name;
    $('vxsk-p13-role').value=row.role_title;
    $('vxsk-p13-bio').value=row.bio||'';
    $('vxsk-p13-section').value=row.department;
    $('vxsk-p13-order').value=row.sort_order;
    $('vxsk-p13-visible').checked=!!row.visible;
    $('vxsk-p13-photo').value='';
    $('vxsk-p13-preview').src=image(row.photo_path);
    $('vxsk-p13-form-title').textContent='EDIT '+row.display_name;
    form.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function draw(){
    const area=$('vxsk-p13-list');area.replaceChildren();
    $('vxsk-p13-count').textContent=String(list.length);
    if(!list.length){area.append(el('p','No crew profiles yet. Add your first member.','vxsk-p13-hint'));return;}
    for(const row of list){
      const item=el('article',null,'vxsk-p13-member'+(row.visible?'':' is-hidden'));
      const photo=el('img');photo.src=image(row.photo_path);photo.alt='';photo.loading='lazy';photo.addEventListener('error',()=>{if(!photo.src.endsWith(fallback))photo.src=fallback;});
      const detail=el('div',null,'vxsk-p13-member-info');
      detail.append(el('strong',row.display_name),el('small',row.role_title),el('span',sectionLabel(row.department)+' · '+(row.visible?'ON HOMEPAGE':'HIDDEN')));
      const actions=el('div',null,'vxsk-p13-member-actions');
      const edit=el('button','EDIT','vxsk-p13-outline');edit.type='button';edit.addEventListener('click',()=>choose(row));
      const hide=el('button',row.visible?'REMOVE':'RESTORE','vxsk-p13-outline '+(row.visible?'danger':''));hide.type='button';
      hide.addEventListener('click',async()=>{
        if(!ownerOnly()||busy)return;
        const verb=row.visible?'hide this crew profile from the homepage':'restore this crew profile to the homepage';
        if(!window.confirm('Do you want to '+verb+'?\nVXSK account permissions will NOT change.'))return;
        busy=true;hide.disabled=true;
        try{
          const {data,error}=await api().rpc('vxsk_p13_set_crew_visibility',{p_id:row.id,p_visible:!row.visible});
          if(error||data!==true)throw Error(error?.message||'Could not update visibility');
          msg('Updated. Homepage crew cards will refresh on next visit.','success');await load();
        }catch(e){msg(String(e.message||e),'error');}
        finally{busy=false;hide.disabled=false;}
      });
      actions.append(edit,hide);item.append(photo,detail,actions);area.append(item);
    }
  }
  async function verify() {
    if(!api())throw Error('Sign in as Owner + 2FA first.');
    const [identity,mfa,role]=await Promise.all([api().auth.getUser(),api().auth.mfa.getAuthenticatorAssuranceLevel(),api().rpc('vxsk_p13_owner_ok')]);
    if(identity.error||!identity.data?.user||mfa.error||mfa.data?.currentLevel!=='aal2'||role.error||role.data!==true)
      throw Error(role.error?.message||'Only the verified VXSK Owner with 2FA can manage public crew profiles.');
  }
  async function load(){
    if(!allowed)return;
    msg('Loading current profiles…');
    try{
      const {data,error}=await api().rpc('vxsk_p13_owner_crew');
      if(error)throw Error(error.message);
      list=Array.isArray(data)?data:[];draw();msg('Crew profiles loaded. Edit, hide or add a member.','success');
    }catch(e){msg('Crew backend unavailable: '+String(e.message||e)+'. Run P13 SQL after backup.','error');}
  }
  function optimize(file){return new Promise((resolve,reject)=>{
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))return reject(Error('Choose a JPG, PNG or WEBP image.'));
    if(file.size>12*1024*1024)return reject(Error('Choose an image under 12 MB.'));
    const url=URL.createObjectURL(file),pic=new Image();
    pic.onload=()=>{
      URL.revokeObjectURL(url);
      const factor=Math.min(1,1280/Math.max(pic.naturalWidth,pic.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(pic.naturalWidth*factor));canvas.height=Math.max(1,Math.round(pic.naturalHeight*factor));
      canvas.getContext('2d').drawImage(pic,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Image compression failed.')),'image/webp',0.82);
    };
    pic.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Cannot open the selected image.'));};pic.src=url;
  });}
  async function submit(event){
    event.preventDefault();if(busy||!allowed)return;
    busy=true;$('vxsk-p13-save').disabled=true;
    msg('Saving profile…');
    try{
      await verify();
      let path=selected?.photo_path||'';
      const file=$('vxsk-p13-photo').files[0];
      if(file){
        const blob=await optimize(file);
        if(blob.size>2*1024*1024)throw Error('Photo is too large after optimization. Try a smaller image.');
        const {data:user}=await api().auth.getUser();
        const uuid=crypto.randomUUID();path=user.user.id+'/'+uuid+'.webp';
        const {error}=await api().storage.from('vxsk-crew-photos').upload(path,blob,{contentType:'image/webp',upsert:false,cacheControl:'3600'});
        if(error)throw Error('Photo upload: '+error.message);
      }
      const params={p_id:selected?.id||null,p_name:$('vxsk-p13-name').value.trim(),p_role:$('vxsk-p13-role').value.trim(),
        p_bio:$('vxsk-p13-bio').value.trim(),p_department:$('vxsk-p13-section').value,p_photo_path:path,
        p_sort:Number($('vxsk-p13-order').value),p_visible:$('vxsk-p13-visible').checked};
      const {error}=await api().rpc('vxsk_p13_save_crew',params);
      if(error)throw Error(error.message);
      fresh();await load();msg('Saved! Public crew roster is updated.','success');
    }catch(e){msg(String(e.message||e),'error');}
    finally{busy=false;$('vxsk-p13-save').disabled=false;}
  }
  form.addEventListener('submit',submit);
  $('vxsk-p13-new').addEventListener('click',fresh);$('vxsk-p13-cancel').addEventListener('click',fresh);
  $('vxsk-p13-refresh').addEventListener('click',load);
  $('vxsk-p13-photo').addEventListener('change',()=>{
    const file=$('vxsk-p13-photo').files[0];
    if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
    $('vxsk-p13-preview').src=file?(previewUrl=URL.createObjectURL(file)):image(selected?.photo_path);
  });
  window.addEventListener('vxsk:staff-ready',async event=>{
    allowed=false;
    const owner=event.detail?.role==='owner';
    $('vxsk-p13-crew-tab').hidden=!owner;
    document.querySelectorAll('[data-p13-owner]').forEach(e=>e.hidden=!owner);
    if(!owner){$('staff-view-crew').hidden=true;return;}
    try{await verify();allowed=true;}catch(e){msg(String(e.message||e),'error');$('vxsk-p13-crew-tab').hidden=true;document.querySelectorAll('[data-p13-owner]').forEach(e=>e.hidden=true);return;}
    if(!$('staff-view-crew').hidden)await load();
  });
  window.addEventListener('vxsk:p13-crew-open',()=>{if(allowed)void load();});
  // Staff Command overview launch cards call the existing tab controls.
  document.querySelectorAll('[data-p13-go]').forEach(button=>button.addEventListener('click',()=>{
    const target=document.querySelector('[data-staff-tab="'+button.dataset.p13Go+'"]');
    if(target&&!target.hidden)target.click();
  }));
})();
