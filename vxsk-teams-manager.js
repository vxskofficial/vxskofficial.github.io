'use strict';
(async () => {
  const $=id=>document.getElementById(id),hub=window.VXSKTeamsHub,api=hub?.api;
  const status=(text)=>{$('th-save-status').textContent=text;};
  const authStatus=(text)=>{$('th-auth-status').textContent=text;};
  // P5.3: keep the entire editor truly hidden until access is confirmed.
  // A CSS display rule in P5.2 was accidentally overriding the HTML `hidden`
  // attribute, so an unauthenticated user could see inert buttons.
  const locked=(message,showLogin=true)=>{
    $('th-manager').hidden=true;
    authStatus(message);
    const a=$('th-auth-action');if(a)a.hidden=!showLogin;
  };
  if (!api){locked('Team Manager is locked: Supabase client could not initialize. Check your connection and refresh. No changes were made.',false);return;}
  try {
    const u=await api.auth.getUser();
    if(u.error || !u.data?.user){
      locked('Team Manager is locked: you are not signed in on this website. Open HOME on this same website, sign in with your VXSK owner account, finish 2FA, then return to Manager. Signing in on another domain will not sign you in here.');
      return;
    }
    const level=await api.auth.mfa.getAuthenticatorAssuranceLevel();
    if(level.error || level.data?.currentLevel!=='aal2'){
      locked('Team Manager is locked: owner two-step verification (MFA/AAL2) is not complete on this website. Finish verification using MY ACCOUNT / SECURITY on the preview homepage, then return.');
      return;
    }
    const role=await api.rpc('vxsk_hub_owner');
    if(role.error){
      locked('Team Manager is locked: owner role could not be checked ('+String(role.error.message||'RPC error').slice(0,180)+'). No changes were made.');
      return;
    }
    if(role.data!==true){
      locked('Team Manager is locked: the signed-in account was not verified as VXSK owner. No changes were made.');
      return;
    }
  }catch(err){
    locked('Team Manager is locked: login check failed ('+String(err?.message||'unknown error').slice(0,160)+'). No changes were made.');
    return;
  }
  let selected=null, teams=[], saving=false, migration=false, importArmed=false;
  const importStatus=(text)=>{$('th-import-status').textContent=text;};
  const importButton=$('th-import');
  const fields=['name','label','description','discord','instagram','tiktok','website','email'];
  const idMap=Object.fromEntries(fields.map(key=>[key,$('th-'+key)]));
  $('th-auth-status').hidden=true;const authAction=$('th-auth-action');if(authAction)authAction.hidden=true;$('th-manager').hidden=false;
  const linksToValues=(team)=>{
    const obj={discord:'',instagram:'',tiktok:'',website:'',email:''};
    for (const l of team?.links||[]) {const key=String(l.label||'').toLowerCase();if (key==='email'&&l.url?.startsWith('mailto:'))obj.email=l.url.slice(7);else if(key in obj)obj[key]=l.url;}
    return obj;
  };
  const linksFromValues=()=>{
    const out={};
    for(const name of ['discord','instagram','tiktok','website']){
      const url=idMap[name].value.trim();if(!url)continue;
      const safe=hub.safeLink(url);
      if(!safe)throw Error(name+' must be a valid HTTPS link');
      out[name]=safe;
    }
    const email=idMap.email.value.trim();
    if(email){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Please use a valid email');out.email=email;}
    return out;
  };
  // Convert legacy team links into the JSON object used by the new database.
  function linkRecord(list){
    const out={};
    for(const link of list||[]){
      const key=String(link.label||'').toLowerCase();
      if(key==='email' && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(link.url||'')){
        out.email=link.url.slice(7);
      }else if(['discord','instagram','tiktok','website'].includes(key)){
        const safe=hub.safeLink(link.url);if(safe)out[key]=safe;
      }
    }
    return out;
  }
  function logoPreview(src,name){const box=hub.logo(src,name||'VXSK');if(src?.startsWith('blob:')){const im=box.querySelector('img');im.src=src;im.hidden=false;}$('th-preview-logo').replaceChildren(box);}
  function select(team){
    selected=team || null;const v=linksToValues(team);
    for(const key of fields)idMap[key].value=team?.[key]||v[key]||'';
    $('th-games').querySelectorAll('option').forEach(o=>{o.selected=(team?.games||[]).includes(o.value);});
    $('th-featured').value=team?.featured_order ? String(team.featured_order):'';
    $('th-logo').value='';
    logoPreview(team?.image_url||'',team?.name||'NEW TEAM');
    $('th-form-heading').textContent=team?.id?'Edit '+team.name:'Create Team';
    $('th-archive').hidden=!team?.id || team.status==='archived';
    status(team?.id?'Editing team: '+team.status:'New team. Fill in the details, then Save Draft or Publish.');
    refreshList();
  }
  function refreshList(){const box=$('th-team-list');box.replaceChildren();teams.forEach(t=>{
    const btn=document.createElement('button');btn.type='button';btn.textContent=t.name+' · '+t.status+(t.featured_order?' · Featured '+t.featured_order:'');
    btn.setAttribute('aria-current',String(selected?.id===t.id));btn.addEventListener('click',()=>select(t));box.append(btn);
  });}
  async function reload(){
    const {data,error}=await api.from('vxsk_directory_teams').select('*').order('updated_at',{ascending:false}).limit(500);
    if(error){authStatus('Team database is not activated yet. P5 SQL must first be reviewed and applied in Supabase staging. '+error.message);$('th-manager').hidden=true;$('th-auth-status').hidden=false;return false;}
    teams=(data||[]).map(hub.format);refreshList();
    const originals=hub.fallback();
    $('th-import').hidden=originals.length===0 ||
      originals.every(old=>teams.some(t=>t.name.toLowerCase()===old.name.toLowerCase()));
    return true;
  }
  async function upload(file){
    if(!file)return selected?.logo_path||'';
    if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>1_500_000)throw Error('Use PNG/JPG/WebP logo smaller than 1.5MB');
    const {data:{user},error:userError}=await api.auth.getUser();if(userError||!user)throw Error('Owner session expired');
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const path=user.id+'/'+crypto.randomUUID()+'.'+ext;
    const {error}=await api.storage.from('vxsk-team-logos').upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw error;
    return path; // Save the object path, never an arbitrary public URL.
  }
  async function save(mode){
    if(saving)return;
    if(!await hub.owner()){status('Owner session or MFA is no longer valid. Sign in again.');return;}
    const name=idMap.name.value.trim();if(name.length<3){status('Team name must have at least 3 characters.');idMap.name.focus();return;}
    saving=true;for(const id of ['th-publish','th-draft','th-archive'])$(id).disabled=true;
    status('Saving securely...');
    try{
      const links=linksFromValues();
      const logo_path=await upload($('th-logo').files[0]);
      const games=Array.from($('th-games').selectedOptions,x=>x.value);
      const featured_slot=mode==='published'&&$('th-featured').value?Number($('th-featured').value):null;
      const payload={name,label:idMap.label.value.trim().slice(0,100),description:idMap.description.value.trim().slice(0,650),games,links,logo_path,status:mode,featured_slot,updated_at:new Date().toISOString()};
      const query=selected?.id?api.from('vxsk_directory_teams').update(payload).eq('id',selected.id):api.from('vxsk_directory_teams').insert(payload);
      const {data,error}=await query.select().single();if(error)throw error;
      await reload();select(teams.find(t=>t.id===data.id)||hub.format(data));status(mode==='published'?'Published! Team is now available in the directory.':'Draft saved securely. It is not publicly visible.');
    }catch(err){status(err?.message?.includes('vxsk_directory_featured_unique')?'That featured slot is occupied. Unfeature the existing team first.':(err?.message||'Save failed. No publication was confirmed.'));}
    finally{saving=false;for(const id of ['th-publish','th-draft','th-archive'])$(id).disabled=false;}
  }
  $('th-create').addEventListener('click',()=>select(null));
  $('th-draft').addEventListener('click',()=>void save('draft'));
  $('th-publish').addEventListener('click',()=>void save('published'));
  $('th-logo').addEventListener('change',()=>{const f=$('th-logo').files[0];if(!f)return;const url=URL.createObjectURL(f);logoPreview(url,idMap.name.value||'NEW TEAM');});
  idMap.name.addEventListener('input',()=>{if(!selected)logoPreview('',idMap.name.value||'NEW TEAM');});
  $('th-archive').addEventListener('click',async()=>{
    if(!selected?.id || !confirm('Archive this team? It will disappear from public VXSK pages.'))return;
    if(!await hub.owner()){status('Session expired.');return;}
    const {error}=await api.from('vxsk_directory_teams').update({status:'archived',featured_slot:null,updated_at:new Date().toISOString()}).eq('id',selected.id);
    if(error){status(error.message);return;}await reload();select(teams.find(t=>t.id===selected.id)||null);status('Archived. Not visible to the public.');
  });
  // Owner-only migration. Require an explicit second click and show progress
  // immediately beside the import button (not below the long team editor).
  importButton.addEventListener('click',async()=>{
    if(migration)return;
    if(!importArmed){
      importArmed=true;
      importButton.textContent='CONFIRM IMPORT 4 TEAMS';
      importStatus('Confirm to publish the 4 existing VXSK teams into the shared Supabase database. This is a real change.');
      return;
    }
    importArmed=false;
    importButton.textContent='BRING EXISTING VXSK TEAMS';
    if(!await hub.owner()){importStatus('Owner MFA is required. Nothing was imported.');return;}
    migration=true;importButton.disabled=true;let added=0,skipped=0;
    try{
      const old=hub.fallback();
      if(old.length!==4)throw Error('Expected 4 existing teams, found '+old.length+'. No import started.');
      for(const [i,t] of old.entries()){
        importStatus('Importing '+t.name+' ('+(i+1)+'/4)...');
        const {data:existing,error:findError}=await api.from('vxsk_directory_teams')
          .select('id').eq('name',t.name).limit(1).maybeSingle();
        if(findError)throw findError;
        if(existing){skipped++;continue;}
        let logo_path=t.image;
        if(logo_path.startsWith('data:image/')){
          const blob=await (await fetch(logo_path)).blob();
          const uploadFile=new File([blob],'team.webp',{type:blob.type||'image/webp'});
          logo_path=await upload(uploadFile);
        }
        const payload={name:t.name,label:t.label,description:t.description,games:t.games,links:linkRecord(t.links),logo_path,status:'published',featured_slot:i<3?i+1:null};
        const {error}=await api.from('vxsk_directory_teams').insert(payload);
        if(error)throw error;
        added++;
      }
      await reload();select(null);
      const message='Import complete: '+added+' added, '+skipped+' already existed. Reload All Teams to verify.';
      importStatus(message);status(message);
    }catch(err){
      const message='Import stopped: '+(err?.message||'Unknown error')+'. '+added+' added so far. Do not retry until reviewed.';
      importStatus(message);status(message);
    }finally{migration=false;importButton.disabled=false;}
  });
  if(await reload()){select(null);importStatus('Import is owner-only and will require a second confirmation click. No changes until confirmed.');}
})();
