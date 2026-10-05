/* Motion UF — accounts + private sync.
   Server is the source of truth for signed-in users; localStorage is only a per-user cache.
   Privacy is enforced by Postgres RLS (see supabase/migrations/001_motion_planner.sql),
   not by this file. */
window.Sync=(function(){
  const C=window.MOTION_CONFIG||{}; const enabled=!!(C.supabaseUrl&&C.supabaseAnonKey);
  let sb=null, user=null, timer=null, lastIds=new Set(), ready=false, failed=false;
  const loadLib=()=>new Promise((res,rej)=>{ if(window.supabase) return res(); const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
  const toRow=(e,uid)=>({id:String(e.id),user_id:uid,title:e.title,category:e.category,date:e.date,start_time:e.start,end_time:e.end,recurrence:{repeat:e.repeat||'none',days:e.days||null,exdates:e.exdates||[]},source:e.source||'user',updated_at:new Date().toISOString()});
  const fromRow=r=>({id:r.id,title:r.title,category:r.category,date:r.date,start:String(r.start_time).slice(0,5),end:String(r.end_time).slice(0,5),repeat:(r.recurrence||{}).repeat||'none',...((r.recurrence||{}).days?{days:r.recurrence.days}:{}),exdates:(r.recurrence||{}).exdates||[],source:r.source});
  async function init(){
    if(!enabled) return;
    try{ await loadLib(); sb=window.supabase.createClient(C.supabaseUrl,C.supabaseAnonKey,{auth:{persistSession:true,storageKey:'motion_auth'}}); }
    catch(e){ console.warn('Motion sync unavailable',e); failed=true; if(typeof render==='function'&&S&&S.user) render(); return; }
    const {data}=await sb.auth.getSession(); if(data.session) await onUser(data.session.user,false);
    sb.auth.onAuthStateChange((ev,ses)=>{ if(ev==='SIGNED_IN'&&ses&&(!user||user.id!==ses.user.id)) onUser(ses.user,true); if(ev==='SIGNED_OUT') onOut(); });
    ready=true; if(typeof render==='function'&&S&&S.user) render();
  }
  async function onUser(u,fresh){
    const guest=OWNER.kind==='guest'?JSON.parse(JSON.stringify(S)):null;
    user=u; load({kind:'user',id:u.id});
    try{ await pull(); }catch(e){ console.warn('pull failed',e); }
    if(fresh&&guest&&(guest.events.length||guest.sessions.length)){
      if(confirm('Vill du flytta ditt lokala schema till ditt konto?\n\nDet som redan finns på kontot påverkas inte.')){
        const have=new Set(S.events.map(e=>e.id));
        S.events=[...S.events,...guest.events.filter(e=>!have.has(e.id)).map(e=>({...e,id:crypto.randomUUID()}))];
        S.sessions=[...S.sessions,...guest.sessions]; S.completions=[...S.completions,...guest.completions];
        if(!S.user&&guest.user) S.user=guest.user;
      }
    }
    if(!S.user) S.user={name:(u.user_metadata&&u.user_metadata.name)||u.email.split('@')[0],prefLen:10};
    save(); setAvatar(); render();
    if(!S.user.onboarded&&!S.events.length) onboarding();
  }
  function onOut(){ user=null; lastIds=new Set(); load(); setAvatar(); render(); }
  async function pull(){
    const ev=await sb.from('planner_events').select('*'); if(ev.error) throw ev.error;
    const st=await sb.from('motion_state').select('data').maybeSingle(); if(st.error) throw st.error;
    S.events=ev.data.map(fromRow); lastIds=new Set(S.events.map(e=>e.id));
    if(st.data&&st.data.data){ const d=st.data.data; S.user=d.user||S.user; S.sessions=d.sessions||[]; S.completions=d.completions||[]; S.players=d.players||[]; }
    try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(e){}
  }
  function push(){ if(!sb||!user) return; clearTimeout(timer); timer=setTimeout(flush,600); }
  async function flush(){
    const ids=new Set(S.events.map(e=>String(e.id)));
    const removed=[...lastIds].filter(id=>!ids.has(id));
    if(S.events.length){ const r=await sb.from('planner_events').upsert(S.events.map(e=>toRow(e,user.id))); if(r.error) console.warn(r.error); }
    if(removed.length){ const r=await sb.from('planner_events').delete().in('id',removed); if(r.error) console.warn(r.error); }
    lastIds=ids;
    const r2=await sb.from('motion_state').upsert({user_id:user.id,data:{user:S.user,sessions:S.sessions,completions:S.completions,players:S.players},updated_at:new Date().toISOString()}); if(r2.error) console.warn(r2.error);
  }
  return {
    init, push, get enabled(){return enabled}, get user(){return user}, get ready(){return ready}, get failed(){return failed},
    signIn:(email,password)=>sb.auth.signInWithPassword({email,password}),
    signUp:(email,password)=>sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/app.html#progress'}}),
    signOut:async()=>{ await flush().catch(()=>{}); await sb.auth.signOut(); },
  };
})();
