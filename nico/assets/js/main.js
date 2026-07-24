/* ============================================================
   MAIN.JS — geteilte Interaktionen für alle Seiten
   (Mobile-Nav, Header-Schatten, FAQ-Akkordeon, Scroll-Reveal)
   Alles defensiv: greift nur, wenn die Elemente existieren.
   ============================================================ */

/* ---------- Mobile-Nav ---------- */
(function(){
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  if(toggle && nav){
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded','false');
    }));
  }
})();

/* ---------- Header-Schatten bei Scroll ---------- */
(function(){
  const header = document.querySelector('.site-header');
  if(!header) return;
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, {passive:true});
})();

/* ---------- FAQ-Akkordeon (nur eines offen) ---------- */
(function(){
  const items = document.querySelectorAll('.faq-item');
  if(!items.length) return;
  items.forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    if(!q || !a) return;
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach(other => {
        other.classList.remove('open');
        const oa = other.querySelector('.faq-a');
        if(oa) oa.style.maxHeight = null;
      });
      if(!isOpen){
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });
})();

/* ---------- Scroll-Reveal (dezent) ---------- */
(function(){
  const els = document.querySelectorAll('.reveal');
  if(!els.length) return;
  if(!('IntersectionObserver' in window)){ els.forEach(e=>e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){ entry.target.classList.add('in'); io.unobserve(entry.target); }
    });
  }, {threshold:0.12, rootMargin:'0px 0px -40px 0px'});
  els.forEach(el => io.observe(el));
})();

/* ---------- Amazon-/Preis-Labels aus config übernehmen ---------- */
(function(){
  const cfg = window.SITE_CONFIG || {};
  // Amazon-Links, die als Platzhalter markiert sind, verdrahten
  document.querySelectorAll('[data-amazon]').forEach(el => {
    el.addEventListener('click', openAmazon);
    if(cfg.AMAZON_URL){ el.setAttribute('href', cfg.AMAZON_URL); el.setAttribute('target','_blank'); el.setAttribute('rel','noopener'); }
  });
})();
