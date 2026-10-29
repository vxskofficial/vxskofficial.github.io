'use strict';
(() => {
  const $=id=>document.getElementById(id),hub=window.VXSKTeamsHub;
  if(!hub)return;
  let page=1,seq=0;
  async function refresh(){
    const curr=++seq,opts={q:$('th-search').value.trim(),game:$('th-game').value,sort:$('th-sort').value,page};
    $('th-results').textContent='Loading...';
    const out=await hub.list(opts);
    if(curr!==seq)return;
    const totalPages=Math.max(1,Math.ceil(out.count/12));
    if(page>totalPages){page=totalPages;return refresh();}
    $('th-grid').replaceChildren(...out.teams.map(hub.card));
    $('th-empty').hidden=out.teams.length!==0;
    $('th-results').textContent=out.count+' '+(out.count===1?'team':'teams')+' found'+(out.source==='preview'?' · Preview data':'');
    $('th-page').textContent=page+' / '+totalPages;
    $('th-prev').disabled=page<=1;$('th-next').disabled=page>=totalPages;
  }
  let debounce;
  $('th-search').addEventListener('input',()=>{page=1;clearTimeout(debounce);debounce=setTimeout(refresh,170);});
  $('th-game').addEventListener('change',()=>{page=1;void refresh();});
  $('th-sort').addEventListener('change',()=>{page=1;void refresh();});
  $('th-prev').addEventListener('click',()=>{if(page>1){page--;void refresh();}});
  $('th-next').addEventListener('click',()=>{page++;void refresh();});
  void refresh();
})();
