// VXSK V18: format exploration ONLY. No backend writes or claims of real support.
'use strict';
(()=>{
 function init(){
  const n=document.getElementById('vxsk-planner-count');
  const mode=document.getElementById('vxsk-planner-format');
  const out=document.getElementById('vxsk-planner-result');
  if(!n||!mode||!out)return;
  for(let entrants=16;entrants<=64;entrants++){
   const opt=document.createElement('option');opt.value=String(entrants);opt.textContent=entrants+' entrants';n.append(opt);
  }
  n.value='32';
  function suggest(count){return [16,32,64].includes(count)?'single':({20:'groups',40:'groups',48:'groups'}[count]||'swiss');}
  function render(){
   const entrants=Number(n.value),s=mode.value==='recommended'?suggest(entrants):mode.value;
   const slots=2**Math.ceil(Math.log2(entrants));
   const byes=slots-entrants;
   const qualified=entrants<32?8:16;
   let stage='';
   if(s==='single')stage=`Direct knockout with ${slots} slots and ${byes} BYEs.`;
   else if(s==='double')stage=`Winners and losers brackets, plus a grand final (extra fixtures and staff required).`;
   else if(s==='groups'){
    const groups=entrants===20?4:entrants===40||entrants===48?8:Math.ceil(entrants/5);
    stage=`About ${groups} groups of 4–6; define fair qualifiers and tie-breaks → knockout.`;
   }else stage=`Swiss rounds, matched by similar records and no rematches → Top ${qualified} knockout.`;
   const current=s==='single'&&byes===0;
   out.replaceChildren();
   const head=document.createElement('strong');head.textContent=`${entrants} entrants · ${s.toUpperCase()} · ${byes} BYEs`;
   const p=document.createElement('p');p.textContent=stage;
   const foot=document.createElement('p');foot.textContent=current?'Backend supports this format for approved entrants. Real workflow still requires testing.':'PLANNING ONLY — not ready for automatic tournament generation on VXSK.';
   out.append(head,p,foot);
  }
  n.addEventListener('change',render);mode.addEventListener('change',render);render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
