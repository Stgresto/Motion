/* Motion UF: samlar skannade kort mellan övningssidorna och startar passet när alla är skannade */
(function(){
  var m=location.pathname.match(/\/ovning\/(\d\d)\/?$/); if(!m) return;
  try{if(localStorage.getItem('muf_dev')!=='1')return}catch(e){return}
  var nr=m[1], hand=[], target=6;
  try{ hand=JSON.parse(localStorage.getItem('muf_hand')||'[]'); target=+localStorage.getItem('muf_target')||6; }catch(e){}
  if(!Array.isArray(hand)) hand=[];
  if(hand.length>=target && hand.indexOf(nr)<0) hand=[];
  var isNew=hand.indexOf(nr)<0; if(isNew) hand.push(nr);
  try{ localStorage.setItem('muf_hand',JSON.stringify(hand)); }catch(e){}
  var n=hand.length, full=n>=target;
  var css=document.createElement('style');
  css.textContent='.mh{position:fixed;left:0;right:0;bottom:0;z-index:99;background:#171A18;color:#F7F5F0;padding:14px 18px calc(14px + env(safe-area-inset-bottom,0px));font-family:Manrope,system-ui,sans-serif;box-shadow:0 -8px 24px rgba(0,0,0,.18)}.mh-in{max-width:640px;margin:0 auto}.mh-t{display:flex;justify-content:space-between;align-items:baseline;font-weight:600}.mh-t small{color:#E6D5AE;letter-spacing:.14em;font-size:.72rem;font-weight:700}.mh-b{height:3px;background:#3a3d3a;margin:8px 0 12px}.mh-b i{display:block;height:100%;background:#C6A15B}.mh-r{display:flex;gap:10px}.mh a{flex:1;text-align:center;padding:14px 10px;font-weight:700;letter-spacing:.08em;font-size:.85rem;text-decoration:none;color:#171A18;background:#C6A15B}.mh a.o{background:none;color:#F7F5F0;border:1px solid #5a5d5a;flex:none;padding:14px 16px}body{padding-bottom:150px}';
  document.head.appendChild(css);
  var bar=document.createElement('div'); bar.className='mh';
  bar.innerHTML='<div class="mh-in"><div class="mh-t"><span>'+(full?'Alla '+target+' kort skannade':'Kort '+n+' av '+target+' skannade')+'</span><small>MOTION</small></div><div class="mh-b"><i style="width:'+Math.min(100,n/target*100)+'%"></i></div><div class="mh-r">'+
   (full?'<a href="/app.html#run">KÖR PASSET</a>':'<a href="/app.html#scan">SKANNA NÄSTA KORT</a>')+'<a class="o" href="#" id="mhx">Börja om</a></div>'+
   (full?'':'<p style="margin:10px 0 0;font-size:.82rem;color:#bdb8aa">Skanna nästa QR-kod med kameran, så fortsätter vi. När du skannat '+target+' börjar passet.</p>')+'</div>';
  document.body.appendChild(bar);
  document.getElementById('mhx').onclick=function(e){e.preventDefault();try{localStorage.setItem('muf_hand','[]')}catch(_){} location.reload();};
  if(full && isNew) setTimeout(function(){ location.href='/app.html#run'; },2500);
})();
