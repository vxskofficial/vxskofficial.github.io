'use strict';
/* VXSK P13 public crew renderer. Never display cached/retired photos when the source is unavailable. */
(() => {
  const roster=document.querySelector('.vxsk-team-roster');
  if(!roster)return;
  const groups={leadership:['01 / LEADERSHIP','VXSK LEADERSHIP'],management:['02 / MANAGEMENT','OPERATIONS · GAME MANAGEMENT · MEDIA'],community:['03 / COMMUNITY','CASTING · REFEREES · MODERATION']};
  const fallback='assets/vxsk-logo.png';
  function photoPath(path){
    const s=String(path||'');
    if(/^assets\/vxsk-team-[a-z0-9-]+\.webp$/.test(s))return s;
    if(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpe?g|png)$/.test(s)){
      return String(window.VXSK_SUPABASE?.url||'').replace(/\/$/,'')+'/storage/v1/object/public/vxsk-crew-photos/'+s;
    }
    return fallback;
  }
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  function render(rows){
    const fragment=document.createDocumentFragment();
    for(const [key,[title,subtitle]] of Object.entries(groups)){
      const members=rows.filter(x=>x.department===key);
      if(!members.length)continue;
      const group=el('div','vxsk-team-group vxsk-team-group--'+(key==='leadership'?'leadership':key==='management'?'management':'community'));
      const head=el('div','vxsk-team-group-head');head.append(el('span','vxsk-team-rule'),el('h3','',title),el('span','',subtitle));
      const grid=el('div','vxsk-team-grid');
      members.forEach((row,i)=>{
        const card=el('article','vxsk-team-card'+(key==='leadership'?' vxsk-team-card--lead':''));
        card.setAttribute('aria-label',row.display_name+' — '+row.role_title);
        const imageBox=el('div','vxsk-team-image'),img=el('img');img.src=photoPath(row.photo_path);img.alt='VXSK crew portrait of '+row.display_name;img.loading='lazy';img.decoding='async';
        img.addEventListener('error',()=>{if(!img.src.endsWith(fallback))img.src=fallback;});imageBox.append(img);
        const info=el('div','vxsk-team-info');info.append(el('span','vxsk-team-tier',key.toUpperCase()+' / '+String(i+1).padStart(2,'0')),el('h3','',row.display_name),el('p','',row.role_title));
        if(row.bio)info.append(el('p','vxsk-p13-bio',row.bio));
        card.append(imageBox,info);grid.append(card);
      });
      group.append(head,grid);fragment.append(group);
    }
    if(!fragment.childNodes.length){
      const empty=el('div','vxsk-p13-empty','Crew profiles are being updated.');fragment.append(empty);
    }
    roster.replaceChildren(fragment);
  }
  async function load(){
    const cfg=window.VXSK_SUPABASE;
    if(!cfg?.url||!cfg.publishableKey||!window.supabase?.createClient){roster.textContent='Crew profiles are temporarily unavailable.';return;}
    const client=window.VXSKAuth?.client||window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    try{
      const {data,error}=await client.rpc('vxsk_p13_public_crew');
      if(error||!Array.isArray(data))throw Error('Crew RPC unavailable');
      render(data);
    }catch(_){roster.replaceChildren(el('p','vxsk-p13-empty','Crew profiles are temporarily unavailable.'));}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else void load();
})();
