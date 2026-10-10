/* Fyll i dina uppgifter HÄR — de visas automatiskt på alla sidor (integritet, villkor, retur, om oss, sidfot).
   Lämna en rad tom ('') så visas en tydlig markering på sidan tills du fyllt i. */
window.MOTION_CO = {
  name:    '',   // UF-företagets registrerade namn, t.ex. 'Motion UF'
  org:     '',   // Organisationsnummer, t.ex. '123456-7890' (finns hos UF Sverige)
  address: '',   // Postadress, t.ex. 'Gatan 1, 123 45 Stockholm'
  email:   'hej@motionplanner.se',   // Kontakt-e-post för frågor, ånger, personuppgifter
  school:  '',   // Skola / UF-region (valfritt)
  instagram: ''  // Full URL till ert Instagram-konto (valfritt — länken döljs om tom)
};
(function(){
  var C = window.MOTION_CO;
  function fill(){
    document.querySelectorAll('[data-co]').forEach(function(el){
      var k = el.getAttribute('data-co'), v = C[k];
      if(k==='instagram'){ if(v){ el.setAttribute('href', v); el.hidden=false; } else { el.hidden=true; } return; }
      if(v){ el.textContent = v; el.classList.remove('todo'); if(k==='email' && el.tagName==='A'){ el.href='mailto:'+v; } }
      else { el.textContent = '[fyll i ' + ({name:'företagsnamn',org:'org.nr',address:'adress',email:'e-post',school:'skola/UF-region'}[k]||k) + ']'; el.classList.add('todo'); }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fill); else fill();
})();
