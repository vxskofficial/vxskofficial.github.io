/* VXSK Teams Hub P5.1 — matches public.vxsk_directory_teams.
   Public pages read published rows. All writes are enforced by Supabase RLS. */
'use strict';
(() => {
  const config = window.VXSK_SUPABASE || {};
  const enabled = !window.VXSK_STAGING_BLOCKED &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url || '') &&
    /^(sb_publishable_|eyJ)/.test(config.publishableKey || '') &&
    !!window.supabase?.createClient;
  const api = enabled ? (window.VXSKAuth?.client || window.supabase.createClient(config.url,config.publishableKey)) : null;
  const table = 'vxsk_directory_teams';
  const isUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
  const safeLink = url => {
    if (typeof url !== 'string' || url.length > 500) return '';
    try { const u = new URL(url); return u.protocol === 'https:' ? u.href : ''; } catch (_) { return ''; }
  };
  const safeImage = v => {
    if (typeof v !== 'string' || v.length > 2600000) return '';
    if (/^assets\/[a-z0-9_./-]+\.(png|jpe?g|webp|gif)$/i.test(v) && !v.includes('..')) return v;
    if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(v)) return v;
    try {
      const u = new URL(v), root = new URL(config.url);
      if (u.protocol === 'https:' && u.hostname === root.hostname &&
          u.pathname.startsWith('/storage/v1/object/public/vxsk-team-logos/')) return v;
    } catch (_) {}
    return '';
  };
  function logoUrl(path) {
    const safe = safeImage(path);
    if (safe) return safe;
    // Only storage *paths* (not arbitrary external URLs) are stored in logo_path.
    if (!api || typeof path !== 'string' ||
        !/^[a-z0-9_-]+\/[a-z0-9._-]+\.(png|jpe?g|webp)$/i.test(path) ||
        path.includes('..')) return '';
    return safeImage(api.storage.from('vxsk-team-logos').getPublicUrl(path).data.publicUrl);
  }
  const rawFallback = () => {
    const raw = window.VXSKFeaturedTeamsData?.teams;
    if (!Array.isArray(raw)) return [];
    return raw.filter(t => t && t.name).slice(0,30).map((t,i) => format({
      ...t, slug:['n2xt','vortex','drax','team-test'][i] || String(t.id || ''),
      logo_path:t.image, featured_slot:i < 3 ? i + 1 : null,
      status:'published'
    }));
  };
  const linksFromRecord = raw => {
    if (Array.isArray(raw)) {
      return raw.filter(x => x && typeof x.label === 'string').map(x => ({
        label:String(x.label).slice(0,25),
        url:x.url?.startsWith('mailto:') && /^mailto:[^\s<>"']+@[^\s<>"']+$/i.test(x.url)
          ? x.url : safeLink(x.url)
      })).filter(x => x.url).slice(0,8);
    }
    if (!raw || typeof raw !== 'object') return [];
    const out = [];
    for (const key of ['website','discord','instagram','tiktok','other']) {
      const safe = safeLink(raw[key]);
      if (safe) out.push({label:key === 'other' ? 'LINK' : key.toUpperCase(),url:safe});
    }
    const email = String(raw.email || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 250)
      out.push({label:'EMAIL',url:'mailto:'+email});
    return out;
  };
  function format(t) {
    const logo_path=String(t.logo_path || t.image_url || t.image || '');
    const image=logoUrl(logo_path);
    const id=String(t.id || '');
    const featured = t.featured_slot ?? t.featured_order;
    return {
      id, slug: isUuid(id) ? id : String(t.slug || id).toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,100),
      name:String(t.name || '').slice(0,90),label:String(t.label || 'VXSK COMMUNITY TEAM').slice(0,100),
      description:String(t.description || '').slice(0,650),
      image, image_url:image, logo_path,
      games:Array.isArray(t.games) ? t.games.slice(0,8).map(g=>String(g).slice(0,40)) : [],
      links:linksFromRecord(t.links),
      featured_order:[1,2,3].includes(Number(featured)) ? Number(featured) : null,
      status:String(t.status || 'published'),
      created_at:t.created_at || null,updated_at:t.updated_at || null
    };
  }
  function staticList(options={}) {
    let rows=rawFallback();
    if(options.featured) rows=rows.filter(t=>t.featured_order!==null);
    if(options.q) rows=rows.filter(t=>t.name.toLowerCase().includes(String(options.q).toLowerCase()));
    if(options.game && options.game!=='all')rows=rows.filter(t=>t.games.some(g=>g.toLowerCase()===options.game.toLowerCase()));
    rows.sort((a,b)=>options.featured ? a.featured_order-b.featured_order :
      options.sort==='new' ? 0 : options.sort==='old' ? 0 : a.name.localeCompare(b.name));
    const count=rows.length, page=Math.max(1,Number(options.page)||1);
    return {teams:rows.slice((page-1)*12,page*12),count,source:'preview'};
  }
  async function list(options={}) {
    if (!api) return staticList(options);
    const page=Math.max(1,Number(options.page)||1);
    try {
      let q=api.from(table).select('*',{count:'exact'}).eq('status','published');
      if(options.featured) q=q.not('featured_slot','is',null);
      if(options.q) q=q.ilike('name','%'+String(options.q).slice(0,90).replace(/[%_\\]/g,'')+'%');
      if(options.game && options.game!=='all')q=q.contains('games',[options.game]);
      q=options.featured ? q.order('featured_slot',{ascending:true}) :
        options.sort==='new' ? q.order('created_at',{ascending:false}) :
        options.sort==='old' ? q.order('created_at',{ascending:true}) : q.order('name',{ascending:true});
      const {data,error,count}=await q.range((page-1)*12,page*12-1);
      if(error) throw error;
      return {teams:(data||[]).map(format),count:count??0,source:'database'};
    } catch(err) {
      console.warn('VXSK Teams database unavailable; showing legacy preview:',err?.message);
      return staticList(options);
    }
  }
  async function featured() {
    if (!api) return rawFallback().filter(t=>t.featured_order!==null).slice(0,3);
    try {
      const {data,error}=await api.from(table).select('*').eq('status','published')
        .not('featured_slot','is',null).order('featured_slot',{ascending:true}).limit(3);
      if(error) throw error;
      return (data||[]).map(format);
    } catch(err) {
      console.warn('VXSK featured database read failed:',err?.message);
      return rawFallback().filter(t=>t.featured_order!==null).slice(0,3);
    }
  }
  async function one(id) {
    if (!api) return rawFallback().find(t=>t.slug===id) || null;
    if (!isUuid(id)) return null; // No stale fallback profiles once hosted DB is active.
    try {
      const {data,error}=await api.from(table).select('*')
        .eq('id',id).eq('status','published').maybeSingle();
      if(error) throw error;
      return data ? format(data) : null;
    } catch(err) { console.warn('Team lookup failed:',err?.message);return null; }
  }
  async function owner() {
    if (!api) return false;
    try {
      const [u,level,role]=await Promise.all([
        api.auth.getUser(),
        api.auth.mfa.getAuthenticatorAssuranceLevel(),
        api.rpc('vxsk_hub_owner')
      ]);
      return !u.error && !!u.data?.user && !level.error &&
        level.data?.currentLevel==='aal2' && !role.error && role.data===true;
    } catch(_) { return false; }
  }
  const element=(tag,cls,text)=>{
    const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;
  };
  function logo(src,name) {
    const box=element('div','vxsk-th-logo'),img=element('img');
    img.alt=name+' logo';img.loading='lazy';img.decoding='async';
    const safe=safeImage(src);if(safe)img.src=safe;else img.hidden=true;
    const fallback=element('span','',name.slice(0,2));
    img.addEventListener('error',()=>img.hidden=true,{once:true});
    box.append(fallback,img);return box;
  }
  function card(t) {
    const a=element('a','vxsk-th-card');
    a.href='team.html?team='+encodeURIComponent(t.slug);
    a.append(logo(t.image,t.name));
    const b=element('div','vxsk-th-card-body');
    b.append(element('span','vxsk-th-eyebrow',t.featured_order ? '★ FEATURED TEAM':'COMMUNITY TEAM'),element('h2','',t.name));
    b.append(element('p','',t.description||'Explore this VXSK community team.'));
    const tags=element('div','vxsk-th-tags');
    t.games.slice(0,3).forEach(g=>tags.append(element('span','',g)));
    b.append(tags,element('span','vxsk-th-view','VIEW PROFILE ↗'));
    a.append(b);return a;
  }
  window.VXSKTeamsHub=Object.freeze({
    api,table,format,safeImage,safeLink,logoUrl,list,featured,one,owner,logo,card,fallback:rawFallback
  });
})();
