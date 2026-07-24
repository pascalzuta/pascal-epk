/* ============================================================
   ZENTRALE KONFIGURATION — „Jedes Kind kann schlafen lernen"
   ------------------------------------------------------------
   HIER wird die Seite später „scharf geschaltet".
   Nur diese Werte müssen gesetzt werden — sonst nichts.
   ============================================================ */

window.SITE_CONFIG = {
  /* Stripe Payment Link (Dashboard → Payment Links → Link erstellen,
     Erfolgs-Weiterleitung auf .../success.html einstellen).
     Solange leer: CTA zeigt einen freundlichen Hinweis statt zu leiten. */
  STRIPE_PAYMENT_LINK: "",

  /* Amazon-Produkt-/Shop-Link für die gedruckte Ausgabe.
     Solange leer: Amazon-Buttons zeigen „bald verfügbar". */
  AMAZON_URL: "",

  /* Preis (nur Anzeige — der echte Betrag kommt aus dem Stripe-Link). */
  PRICE_LABEL: "29 €",

  /* Schutz der Download-Seite: success.html erwartet in der URL das
     Kennzeichen einer erfolgreichen Stripe-Zahlung. Bei Stripe Payment
     Links wird ?session_id={CHECKOUT_SESSION_ID} angehängt, wenn man in
     der Success-URL diesen Platzhalter setzt. Ist true, wird die Seite
     ohne dieses Kennzeichen als „gesperrt" angezeigt. */
  REQUIRE_CHECKOUT_TOKEN: true
};

/* ---------- Zentrale Kauf-Aktion (überall via onclick) ---------- */
function startCheckout(){
  var link = (window.SITE_CONFIG && window.SITE_CONFIG.STRIPE_PAYMENT_LINK) || "";
  if(link){ window.location.href = link; }
  else {
    alert("Der Checkout wird in Kürze aktiviert.\n\n(Stripe Payment Link in assets/js/config.js eintragen — dann ist der Kauf sofort live.)");
  }
}

/* ---------- Amazon-Aktion ---------- */
function openAmazon(e){
  var url = (window.SITE_CONFIG && window.SITE_CONFIG.AMAZON_URL) || "";
  if(url){ window.open(url, "_blank", "noopener"); }
  else { if(e && e.preventDefault) e.preventDefault(); alert("Die gedruckte Ausgabe ist bald auf Amazon verfügbar."); }
}
