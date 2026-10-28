/* VXSK compact server feedback bubble. Requires a private Supabase RPC for submission. */
'use strict';(()=>{
  const make=(tag,cl,text)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)n.textContent=text;return n;};
  function start(){if(document.getElementById('vxsk-feedback-trigger'))return;
    const btn=make('button','vxsk-feedback-trigger','✦ FEEDBACK');btn.type='button';btn.id='vxsk-feedback-trigger';btn.setAttribute('aria-label','Open VXSK server feedback');btn.setAttribute('aria-expanded','false');
    const panel=make('section','vxsk-feedback-popover');panel.id='vxsk-feedback-popover';panel.hidden=true;panel.setAttribute('aria-label','Send server feedback');
    const head=make('div','vxsk-feedback-head');const h=make('h2','', 'SERVER FEEDBACK');const close=make('button','vxsk-feedback-close','✕');close.type='button';close.setAttribute('aria-label','Close server feedback');head.append(h,close);
    const desc=make('p','','Suggestions, issues and safety reports for the VXSK team. Delivery is available only after the private backend is enabled.');
    const form=make('form');const category=make('select');category.required=true;category.setAttribute('aria-label','Feedback category');
    for(const [value,name] of [['suggestion','Suggestion'],['bug','Bug / website issue'],['community','Community feedback'],['safety','Safety concern']]){const opt=make('option','',name);opt.value=value;category.append(opt);}
    const message=make('textarea');message.required=true;message.minLength=20;message.maxLength=800;message.rows=5;message.placeholder='Your feedback (20–800 characters). Do not include passwords, payment or personal codes.';message.setAttribute('aria-label','Feedback message');
    const status=make('p','vxsk-feedback-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const send=make('button','vxsk-feedback-submit','SEND FEEDBACK');send.type='submit';form.append(category,message,status,send);panel.append(head,desc,form);
    document.body.append(btn,panel);
    const open=()=>{panel.hidden=false;btn.setAttribute('aria-expanded','true');message.focus();};
    const hide=()=>{panel.hidden=true;btn.setAttribute('aria-expanded','false');btn.focus();};
    btn.addEventListener('click',()=>panel.hidden?open():hide());close.addEventListener('click',hide);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)hide();});
    form.addEventListener('submit',async e=>{e.preventDefault();const value=message.value.trim();if(value.length<20){status.textContent='Please add more details.';return;}
      const client=window.VXSKAuth?.client;if(!client){status.textContent='Private feedback service not available. Please contact vxskofficial@gmail.com.';return;}
      try{const {data:userData,error:authError}=await client.auth.getUser();if(authError||!userData?.user){status.textContent='Please sign in to VXSK before submitting feedback.';return;}
        send.disabled=true;status.textContent='Submitting…';const {error}=await client.rpc('vxsk_server_feedback_submit',{p_category:category.value,p_message:value});
        if(error)throw error;status.textContent='Feedback submitted to the protected staff inbox. Email notification requires separate setup.';message.value='';}
      catch{status.textContent='Feedback inbox unavailable. No message was recorded; use official contact email.';}finally{send.disabled=false;}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();