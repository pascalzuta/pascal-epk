/* ============================================================
   PASSWORT-GATE (Vorschau-Schutz)
   ------------------------------------------------------------
   HINWEIS: Clientseitiges Gate für die Vorschau-Phase — hält
   zufällige Besucher ab, ist aber KEIN echter Server-Schutz.
   Nach dem ersten korrekten Passwort wird der Zugang im Browser
   gemerkt (localStorage), bis er dort gelöscht wird.
   Passwort ändern: PASSWORD unten anpassen.
   Gate entfernen: <script src="assets/js/gate.js"> aus den Seiten
   nehmen — oder REQUIRE_GATE auf false setzen.
   ============================================================ */
(function(){
  "use strict";
  var PASSWORD    = "kira";
  var REQUIRE_GATE = true;
  var KEY = "sl_gate_ok";

  if(!REQUIRE_GATE) return;
  try { if(localStorage.getItem(KEY) === "1") return; } catch(e){}

  /* Inhalt sofort verbergen (verhindert Aufblitzen) */
  var hide = document.createElement("style");
  hide.id = "gate-hide-style";
  hide.textContent =
    "body{visibility:hidden !important}" +
    "#site-gate,#site-gate *{visibility:visible !important}";
  (document.head || document.documentElement).appendChild(hide);

  function build(){
    if(document.getElementById("site-gate")) return;

    var wrap = document.createElement("div");
    wrap.id = "site-gate";
    wrap.setAttribute("role","dialog");
    wrap.setAttribute("aria-modal","true");
    wrap.setAttribute("aria-label","Passwortgeschützte Vorschau");
    wrap.innerHTML =
      '<div class="gate-card">' +
        '<div class="gate-moon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">' +
            '<path d="M20.5 14.2A8 8 0 1 1 9.8 3.5a6.4 6.4 0 0 0 10.7 10.7Z" stroke-linejoin="round"/>' +
            '<path d="M17 4.5l.6 1.5 1.5.6-1.5.6L17 9l-.6-1.8-1.5-.6 1.5-.6L17 4.5Z" fill="currentColor" stroke="none"/>' +
          '</svg>' +
        '</div>' +
        '<div class="gate-eyebrow">Private Vorschau</div>' +
        '<h1 class="gate-title">Schlafen&nbsp;lernen</h1>' +
        '<p class="gate-text">Diese Seite ist noch nicht öffentlich. Bitte gib das Passwort ein, um fortzufahren.</p>' +
        '<form class="gate-form" id="gate-form" autocomplete="off">' +
          '<input class="gate-input" id="gate-input" type="password" inputmode="text" ' +
                 'placeholder="Passwort" aria-label="Passwort" autofocus />' +
          '<button class="gate-btn" type="submit">Weiter</button>' +
        '</form>' +
        '<p class="gate-error" id="gate-error" hidden>Das Passwort stimmt nicht. Bitte versuch es erneut.</p>' +
      '</div>';

    var css = document.createElement("style");
    css.textContent =
      '#site-gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
        'padding:24px;background:#f4efe6;font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#211d18;' +
        'background-image:radial-gradient(120% 80% at 50% -10%,#fbf8f1,transparent 60%);}' +
      '#site-gate .gate-card{width:100%;max-width:420px;text-align:center;background:#fbf8f1;border:1px solid #ddd0b8;' +
        'border-radius:28px;padding:44px 34px;box-shadow:0 10px 30px rgba(33,29,24,.10),0 30px 60px rgba(33,29,24,.10);}' +
      '#site-gate .gate-moon{width:52px;height:52px;margin:0 auto 18px;color:#5f6d54;}' +
      '#site-gate .gate-moon svg{width:52px;height:52px;}' +
      '#site-gate .gate-eyebrow{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#5f6d54;margin-bottom:12px;}' +
      '#site-gate .gate-title{font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:2rem;letter-spacing:-.02em;line-height:1.05;margin:0 0 12px;color:#211d18;}' +
      '#site-gate .gate-text{font-size:.98rem;line-height:1.6;color:#4a4238;margin:0 auto 24px;max-width:32ch;}' +
      '#site-gate .gate-form{display:flex;flex-direction:column;gap:12px;}' +
      '#site-gate .gate-input{width:100%;font:inherit;font-size:1rem;padding:14px 16px;border:1px solid #ddd0b8;border-radius:100px;' +
        'background:#fff;color:#211d18;text-align:center;outline:none;transition:border-color .2s,box-shadow .2s;}' +
      '#site-gate .gate-input:focus{border-color:#7c8a6f;box-shadow:0 0 0 3px rgba(124,138,111,.20);}' +
      '#site-gate .gate-btn{width:100%;font:inherit;font-weight:600;font-size:1rem;padding:14px 20px;border:none;border-radius:100px;' +
        'background:#5f6d54;color:#fbf8f1;cursor:pointer;transition:background .2s,transform .2s;}' +
      '#site-gate .gate-btn:hover{background:#211d18;transform:translateY(-1px);}' +
      '#site-gate .gate-error{color:#b4674a;font-size:.9rem;margin:14px 0 0;}' +
      '#site-gate.shake .gate-card{animation:gate-shake .4s;}' +
      '@keyframes gate-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}';
    wrap.appendChild(css);

    document.body.appendChild(wrap);

    var form  = document.getElementById("gate-form");
    var input = document.getElementById("gate-input");
    var err   = document.getElementById("gate-error");

    setTimeout(function(){ try{ input.focus(); }catch(e){} }, 40);

    form.addEventListener("submit", function(ev){
      ev.preventDefault();
      if(input.value === PASSWORD){
        try { localStorage.setItem(KEY, "1"); } catch(e){}
        var hs = document.getElementById("gate-hide-style");
        if(hs) hs.parentNode.removeChild(hs);
        wrap.parentNode.removeChild(wrap);
      } else {
        err.hidden = false;
        wrap.classList.add("shake");
        input.value = "";
        input.focus();
        setTimeout(function(){ wrap.classList.remove("shake"); }, 450);
      }
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
