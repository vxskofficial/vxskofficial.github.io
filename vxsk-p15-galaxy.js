/* VXSK P15 — Galaxy Motion. Visual-only; no cookies, no data access, no API calls. */
(() => {
  'use strict';
  if (document.documentElement.dataset.vxskGalaxy === 'p15') return;
  document.documentElement.dataset.vxskGalaxy = 'p15';
  const boot = () => {
    if (!document.body) return;
    const body = document.body;
    const name = location.pathname.split('/').pop() || 'index.html';
    const kind = name === 'staff.html' ? 'staff'
      : name === 'arena.html' ? 'arena'
      : name === 'merch.html' ? 'merch'
      : name === 'index.html' ? 'home' : 'team';
    body.classList.add('vxsk-galaxy-active', 'vxsk-galaxy-' + kind);
    const scene = document.createElement('div');
    scene.className = 'vxsk-galaxy-stage';
    scene.setAttribute('aria-hidden','true');
    scene.innerHTML = '<div class="vxsk-galaxy-sky"></div><div class="vxsk-galaxy-nebula"></div><div class="vxsk-galaxy-nebula vxsk-galaxy-nebula-two"></div><div class="vxsk-galaxy-orbit"></div><canvas></canvas><i class="vxsk-galaxy-meteor"></i><i class="vxsk-galaxy-meteor"></i>';
    body.prepend(scene);
    const canvas = scene.querySelector('canvas');
    const ctx = canvas && canvas.getContext('2d',{ alpha:true });
    const motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    const smallScreen = window.matchMedia && window.matchMedia('(max-width:720px)');
    const connection = navigator.connection;
    let reduced = Boolean(motion && motion.matches);
    const lowLag = () => document.documentElement.classList.contains('vxsk-low-lag') || document.body.classList.contains('vxsk-low-lag');
    const shouldAnimate = () => !reduced && !document.hidden && !lowLag() && !(smallScreen && smallScreen.matches) && !connection?.saveData;
    let stars=[], width=0,height=0,dpr=1,lastFrame=0,raf=0,seed=78131;
    const random = () => {seed=(seed*1664525+1013904223)>>>0; return seed/4294967296;};
    const resize = () => {
      if (!ctx) return;
      const w=Math.max(1,Math.round(window.innerWidth));
      const h=Math.max(1,Math.round(window.innerHeight));
      const ratio=Math.min(window.devicePixelRatio || 1, smallScreen && smallScreen.matches ? 1.2 : 1.5);
      if(w===width && h===height && dpr===ratio)return;
      width=w;height=h;dpr=ratio;
      canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
      ctx.setTransform(ratio,0,0,ratio,0,0);
      const count = smallScreen && smallScreen.matches ? 22 : Math.min(140, Math.max(36, Math.round((w*h)/13500)));
      stars=[];seed=78131;
      for(let i=0;i<count;i++){
        stars.push({x:random()*w,y:random()*h,r:.34+random()*1.05,alpha:.20+random()*.59,
          phase:random()*Math.PI*2,speed:.00035+random()*.00075,hue:random()});
      }
      draw(0);
    };
    const draw = (time) => {
      if(!ctx)return;
      ctx.clearRect(0,0,width,height);
      for(const s of stars){
        const shimmer=reduced ? 0.8 : (0.78+0.22*Math.sin(s.phase+time*s.speed));
        const alpha=s.alpha*shimmer;
        const color=s.hue<.18 ? `rgba(190,165,255,${alpha})` : s.hue<.37 ? `rgba(144,205,255,${alpha})` : `rgba(238,235,255,${alpha})`;
        ctx.fillStyle=color;
        ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
        if(s.r>1.09 && s.alpha>.66){
          ctx.strokeStyle=`rgba(152,166,255,${alpha*.19})`;
          ctx.lineWidth=.6;
          ctx.beginPath();ctx.moveTo(s.x-4,s.y);ctx.lineTo(s.x+4,s.y);
          ctx.moveTo(s.x,s.y-4);ctx.lineTo(s.x,s.y+4);ctx.stroke();
        }
      }
    };
    const loop = (t) => {
      raf=0;
      if(!shouldAnimate())return;
      if(t-lastFrame >= 31){lastFrame=t;draw(t);}
      raf=requestAnimationFrame(loop);
    };
    const motionChange = () => {
      reduced=Boolean(motion && motion.matches);
      if(raf)cancelAnimationFrame(raf);
      raf=0;draw(0);
      if(shouldAnimate())raf=requestAnimationFrame(loop);
    };
    if(ctx){
      resize();motionChange();
      let resizeToken=0;
      window.addEventListener('resize',()=>{
        if(resizeToken)cancelAnimationFrame(resizeToken);
        resizeToken=requestAnimationFrame(()=>{resizeToken=0;resize();});
      },{passive:true});
      document.addEventListener('visibilitychange',motionChange);
      document.addEventListener('vxsk:performance-mode',motionChange);
      if(motion && motion.addEventListener) motion.addEventListener('change',motionChange);
      if(smallScreen && smallScreen.addEventListener) smallScreen.addEventListener('change',motionChange);
      connection?.addEventListener?.('change',motionChange);
    }
    // Progressive enhancement: panels remain visible if there is no observer, scripting fails,
    // the owner is not authorized, or reduced-motion is enabled.
    if(!reduced && 'IntersectionObserver' in window){
      const target = [
        '.section-head','.season-phase-card','.vxsk-master-shop-card',
        '.vxsk-mkt-card','.vxsk-p14-metric','.vxsk-p13-launch-card',
        '.p12-stage','.p12-match','.vxsk-th-card','.vxsk-p14-merch-top'
      ].join(',');
      const observed=new WeakSet();
      const observer=new IntersectionObserver(entries=>{
        for(const entry of entries){
          if(!entry.isIntersecting)continue;
          entry.target.classList.add('vxsk-galaxy-enter');
          observer.unobserve(entry.target);
        }
      },{threshold:.08,rootMargin:'0px 0px 24px 0px'});
      const watch = (root) => {
        if(root.matches && root.matches(target) && !observed.has(root)){
          observed.add(root);observer.observe(root);
        }
        if(root.querySelectorAll)root.querySelectorAll(target).forEach(el=>{
          if(observed.has(el))return;
          observed.add(el);observer.observe(el);
        });
      };
      watch(document.body);
      // Newly loaded Supabase cards should animate, without touching their data or handlers.
      let pending=0;
      const changeObserver=new MutationObserver(records=>{
        if(pending)return;
        if(!records.some(r=>r.addedNodes.length))return;
        pending=requestAnimationFrame(()=>{pending=0;watch(document.body);});
      });
      changeObserver.observe(document.body,{childList:true,subtree:true});
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
