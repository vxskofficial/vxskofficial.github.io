/* VXSK Owner Records — audited archive (hides public record, retains snapshot). */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const make=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);return n};
 let db=null;
 function status(message,error){const n=$('v19-record-status');if(n){n.textContent=message;n.dataset.error=error?'1':'0';}}
 async function rpc(name,args){const {data,error}=await db.rpc(name,args||{});if(error)throw Error(error.message);return data;}
 async function refresh(){if(!db)return;try{const data=await rpc('vxsk_v19_owner_records');const root=$('v19-record-list');root.replaceChildren();
   const sections=[['tournaments','tournament','TOURNAMENTS'],['fixtures','legacy_fixture','LEGACY FIXTURES'],['posts','showmatch_post','SHOWMATCH POSTS']];
   for(const [key,kind,title] of sections){const heading=make('h3',title);root.append(heading);const rows=data?.[key]||[];
    if(!rows.length)root.append(make('p','No records.'));
    rows.forEach(row=>{const item=make('div');item.className='vxsk-cleanup-item';
      const info=make('div');info.append(make('strong',row.name||'Record'),make('small',`${row.status||'—'} · ${row.published?'PUBLIC':'PRIVATE'}`));
      const btn=make('button',row.published?'ARCHIVE / HIDE':'ARCHIVED / PRIVATE');btn.className='vxsk-cleanup-delete';btn.type='button';
      btn.disabled=!row.published;btn.style.cursor=row.published?'pointer':'not-allowed';btn.style.opacity=row.published?'1':'.55';
      btn.addEventListener('click',async()=>{const reason=prompt('Reason for archiving this record (minimum 8 characters):');
       if(!reason||reason.trim().length<8)return status('Archive cancelled: reason required.',true);
       if(!confirm('Hide this record from public view? The database snapshot will be retained for audit.'))return;
       btn.disabled=true;try{await rpc('vxsk_v19_owner_archive',{p_kind:kind,p_id:row.id,p_reason:reason.trim()});
       status('Record hidden, audited and retained.');await refresh();}catch(e){status('Archive failed: '+e.message,true);btn.disabled=false;}
      });item.append(info,btn);root.append(item);});
   }
 }catch(e){status('Unable to load records: '+e.message,true);}}
 function init(e){if(e?.detail?.role!=='owner')return;db=window.VXSK_STAFF_API;
  if(!db||!$('staff-view-cleanup')||$('v19-records'))return;
  const previous=$('staff-view-cleanup').querySelector('.vxsk-cleanup-panel');if(previous)previous.hidden=true;
  const root=make('section');root.id='v19-records';root.className='vxsk-cleanup-panel';
  root.innerHTML='<p class="vxsk-cleanup-warning">ARCHIVE / HIDE — not permanent delete. Owner + MFA, audit entry, and stored record snapshot. Active tournaments cannot be archived.</p><button class="v19-action" id="v19-record-refresh" type="button">↻ REFRESH RECORDS</button><p class="v19-status" id="v19-record-status" role="status"></p><div class="vxsk-cleanup-list" id="v19-record-list"></div>';
  $('staff-view-cleanup').append(root);
  $('v19-record-refresh').addEventListener('click',refresh);
  void refresh();
 }
 window.addEventListener('vxsk:staff-ready',init);
})();
