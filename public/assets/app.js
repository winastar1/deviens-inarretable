/* =========================================================
   DEVIENS INARRÊTABLE — interactions
   Tout est dégradable : si le JS échoue, la page reste
   lisible et le formulaire reste soumissible.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Configuration éditable (voir README) ---------- */
  var CONFIG = {
    dateDebut: "2026-08-23T20:00:00+02:00", // 1re soirée
    placesTotal: 300,                        // capacité annoncée
    placesPrises: 176,                       // à mettre à jour à la main — JAMAIS de faux aléatoire
    endpoint: "/api/inscription"             // route serveur qui enregistre le lead
  };

  var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* =========================================================
     1. Révélations au scroll (slow reveal en cascade)
     ========================================================= */
  function initReveal() {
    var cibles = $$(".rev, .masque");
    if (reduit || !("IntersectionObserver" in window)) {
      cibles.forEach(function (e) { e.classList.add("vu"); });
      return;
    }
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("vu");
          obs.unobserve(en.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    cibles.forEach(function (e) { obs.observe(e); });

    // Le hero est visible d'emblée : on le révèle tout de suite (LCP protégé)
    requestAnimationFrame(function () {
      $$(".hero .rev, .hero .masque").forEach(function (e, i) {
        setTimeout(function () { e.classList.add("vu"); }, 90 * i);
      });
    });
  }

  /* =========================================================
     2. Barre sticky + CTA fixe mobile
     ========================================================= */
  function initBarres() {
    var barre = $("#barre");
    var ctaM = $("#ctaMobile");
    var seuil = Math.max(320, window.innerHeight * 0.62);
    var dernier = 0;

    function maj() {
      var y = window.scrollY || window.pageYOffset;
      var afficher = y > seuil;
      // On masque quand l'utilisateur est DANS le formulaire (évite le doublon)
      var insc = $("#inscription");
      var dansForm = false;
      if (insc) {
        var r = insc.getBoundingClientRect();
        dansForm = r.top < window.innerHeight * 0.75 && r.bottom > 0;
      }
      if (barre) barre.classList.toggle("visible", afficher);
      if (ctaM) ctaM.classList.toggle("visible", afficher && !dansForm);
      dernier = y;
    }
    maj();
    window.addEventListener("scroll", maj, { passive: true });
    window.addEventListener("resize", maj, { passive: true });
  }

  /* =========================================================
     3. Compte à rebours HONNÊTE (vraie date, jamais réinitialisé)
     ========================================================= */
  function initRebours() {
    var boite = $("#rebours");
    if (!boite) return;
    var cible = new Date(CONFIG.dateDebut).getTime();
    var champs = {
      j: boite.querySelector('[data-r="j"]'),
      h: boite.querySelector('[data-r="h"]'),
      m: boite.querySelector('[data-r="m"]'),
      s: boite.querySelector('[data-r="s"]')
    };
    var titre = boite.querySelector(".rebours__t");

    function tic() {
      var d = cible - Date.now();
      if (d <= 0) {
        if (titre) titre.textContent = "C'est maintenant";
        Object.keys(champs).forEach(function (k) { if (champs[k]) champs[k].textContent = "0"; });
        return;
      }
      var s = Math.floor(d / 1000);
      var j = Math.floor(s / 86400);
      var h = Math.floor((s % 86400) / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;
      if (champs.j) champs.j.textContent = j;
      if (champs.h) champs.h.textContent = h < 10 ? "0" + h : h;
      if (champs.m) champs.m.textContent = m < 10 ? "0" + m : m;
      if (champs.s) champs.s.textContent = sec < 10 ? "0" + sec : sec;
    }
    tic();
    setInterval(tic, 1000);
  }

  /* =========================================================
     4. Compteurs animés (chiffres de preuve)
     ========================================================= */
  function initCompteurs() {
    var els = $$("[data-compte]");
    if (!els.length) return;
    function fmt(n) { return n >= 1000 ? n.toLocaleString("fr-FR") : String(n); }
    if (reduit || !("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.textContent = fmt(+e.dataset.compte); });
      return;
    }

    var obs = new IntersectionObserver(function (ens) {
      ens.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, fin = +el.dataset.compte, t0 = null, duree = 1700;
        function pas(t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / duree, 1);
          var e = 1 - Math.pow(1 - p, 3); // easing lent en sortie
          el.textContent = fmt(Math.round(fin * e));
          if (p < 1) requestAnimationFrame(pas);
        }
        requestAnimationFrame(pas);
        obs.unobserve(el);
      });
    }, { threshold: 0.5 });
    els.forEach(function (e) { obs.observe(e); });
  }

  /* =========================================================
     5. Braises lentes du hero (canvas léger, slow motion)
     ========================================================= */
  function initBraises() {
    var c = $("#braises");
    if (!c || reduit) return;
    // On évite le canvas sur petits écrans / appareils faibles
    if (window.innerWidth < 760 || (navigator.hardwareConcurrency || 4) < 4) { c.style.display = "none"; return; }

    var ctx = c.getContext("2d", { alpha: true });
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h, parts = [], N = 46, anim;

    function taille() {
      var r = c.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function creer(y) {
      return {
        x: Math.random() * w,
        y: y === undefined ? h + Math.random() * h : y,
        r: 0.6 + Math.random() * 1.9,
        vy: 0.10 + Math.random() * 0.26,   // très lent = slow motion
        vx: (Math.random() - 0.5) * 0.16,
        a: 0.12 + Math.random() * 0.5,
        ph: Math.random() * Math.PI * 2
      };
    }

    function init() {
      taille();
      parts = [];
      for (var i = 0; i < N; i++) parts.push(creer(Math.random() * h));
    }

    function boucle(t) {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.y -= p.vy;
        p.x += p.vx + Math.sin(t / 2600 + p.ph) * 0.12;
        if (p.y < -12) parts[i] = creer();
        var sc = 0.55 + 0.45 * Math.sin(t / 1500 + p.ph);
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        g.addColorStop(0, "rgba(250,190,90," + (p.a * sc).toFixed(3) + ")");
        g.addColorStop(0.4, "rgba(217,119,6," + (p.a * sc * 0.5).toFixed(3) + ")");
        g.addColorStop(1, "rgba(217,119,6,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2); ctx.fill();
      }
      anim = requestAnimationFrame(boucle);
    }

    init();
    anim = requestAnimationFrame(boucle);
    window.addEventListener("resize", init, { passive: true });

    // Économie : on coupe l'animation quand le hero n'est plus visible
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (ens) {
        ens.forEach(function (en) {
          if (en.isIntersecting) { if (!anim) anim = requestAnimationFrame(boucle); }
          else { cancelAnimationFrame(anim); anim = null; }
        });
      }, { threshold: 0.02 }).observe(c);
    }
  }

  /* =========================================================
     6. Timeline scroll-driven (le rail se remplit, les
        pastilles s'allument étape par étape)
     ========================================================= */
  function initTimeline() {
    var tl = $("#tl"), prog = $("#tlProgres");
    if (!tl || !prog) return;
    var etapes = $$(".etape", tl);

    if (reduit) {
      prog.style.transform = "scaleY(1)";
      etapes.forEach(function (e) { e.classList.add("vue"); });
      return;
    }

    var enCours = false;
    function maj() {
      var r = tl.getBoundingClientRect();
      var pivot = window.innerHeight * 0.52;
      var p = (pivot - r.top) / r.height;
      p = Math.max(0, Math.min(1, p));
      prog.style.transform = "scaleY(" + p.toFixed(4) + ")";

      etapes.forEach(function (e) {
        var er = e.getBoundingClientRect();
        if (er.top < pivot + 40) e.classList.add("vue");
      });
      enCours = false;
    }
    function onScroll() {
      if (!enCours) { enCours = true; requestAnimationFrame(maj); }
    }
    maj();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  /* =========================================================
     7. Séquence cinéma scrubée au scroll (vrai slow motion :
        c'est le scroll qui pilote l'image, image par image)
     ========================================================= */
  function initCine() {
    var sec = $("#cine"), cv = $("#cineCanvas"), poster = $("#cinePoster");
    if (!sec || !cv) return;

    // Mouvement réduit / mobile → on garde l'image fixe (poster) et on sort
    if (reduit || window.innerWidth < 760) { cv.style.display = "none"; return; }

    var TOTAL = 96;               // frames disponibles dans brand/hero-seq
    var images = new Array(TOTAL);
    var chargees = 0, pret = false, dernierIdx = -1;
    var ctx = cv.getContext("2d", { alpha: false });
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function nom(i) { return "brand/hero-seq/f" + String(i + 1).padStart(3, "0") + ".webp"; }

    function taille() {
      var r = cv.getBoundingClientRect();
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      dernierIdx = -1;
      dessiner(indexCourant());
    }

    function dessiner(i) {
      var im = images[i];
      if (!im || !im.complete || i === dernierIdx) return;
      dernierIdx = i;
      // couvrir (object-fit: cover) manuellement
      var cw = cv.width, ch = cv.height;
      var ir = im.width / im.height, cr = cw / ch;
      var dw, dh, dx, dy;
      if (ir > cr) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
      else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
      ctx.fillStyle = "#0a0a0b";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(im, dx, dy, dw, dh);
    }

    function indexCourant() {
      var r = sec.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      if (total <= 0) return 0;
      var p = Math.max(0, Math.min(1, -r.top / total));
      return Math.min(TOTAL - 1, Math.floor(p * (TOTAL - 1)));
    }

    var attente = false;
    function onScroll() {
      if (!pret || attente) return;
      attente = true;
      requestAnimationFrame(function () { dessiner(indexCourant()); attente = false; });
    }

    // Chargement progressif : on démarre dès les 8 premières frames
    for (var i = 0; i < TOTAL; i++) {
      (function (idx) {
        var im = new Image();
        im.decoding = "async";
        im.onload = function () {
          chargees++;
          if (!pret && chargees >= 8) {
            pret = true;
            if (poster) poster.style.display = "none";
            taille();
          }
        };
        im.onerror = function () { chargees++; };
        im.src = nom(idx);
        images[idx] = im;
      })(i);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", taille, { passive: true });
  }

  /* =========================================================
     8. FAQ accordéon accessible
     ========================================================= */
  function initFaq() {
    $$("#faq .faq__q").forEach(function (b) {
      b.addEventListener("click", function () {
        var item = b.parentElement;
        var rep = $(".faq__r", item);
        var ouvert = item.classList.contains("ouvert");

        // Une seule réponse ouverte à la fois
        $$("#faq .faq__i.ouvert").forEach(function (o) {
          o.classList.remove("ouvert");
          $(".faq__r", o).style.maxHeight = "0px";
          $(".faq__q", o).setAttribute("aria-expanded", "false");
        });

        if (!ouvert) {
          item.classList.add("ouvert");
          rep.style.maxHeight = rep.scrollHeight + 40 + "px";
          b.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  /* =========================================================
     9. Jauge de places (valeur maîtrisée, pas de faux compteur)
     ========================================================= */
  function initPlaces() {
    var t = $("#placesTexte"), j = $("#jaugeB");
    if (!t || !j) return;
    var reste = Math.max(0, CONFIG.placesTotal - CONFIG.placesPrises);
    var pct = Math.round((CONFIG.placesPrises / CONFIG.placesTotal) * 100);
    t.innerHTML = "<strong style='color:var(--blanc);font-weight:600'>" + reste + " places</strong> encore disponibles sur " + CONFIG.placesTotal;
    setTimeout(function () { j.style.width = pct + "%"; }, 350);
  }

  /* =========================================================
     10. UTM / fbclid → champs cachés (savoir quelle pub convertit)
     ========================================================= */
  function initAttribution() {
    var p = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fbclid"].forEach(function (k) {
      var el = document.getElementById(k);
      if (el) el.value = p.get(k) || sessionStorage.getItem("di_" + k) || "";
      if (p.get(k)) { try { sessionStorage.setItem("di_" + k, p.get(k)); } catch (e) {} }
    });
  }

  /* =========================================================
     11. Formulaire d'inscription (validation + envoi)
     ========================================================= */
  function initFormulaire() {
    var f = $("#formInscription");
    if (!f) return;
    var msg = $("#formMsg");

    function marquer(idChamp, ok) {
      var c = document.getElementById(idChamp);
      if (!c) return;
      c.classList.toggle("err", !ok);
      var inp = c.querySelector("input");
      if (inp) inp.setAttribute("aria-invalid", ok ? "false" : "true");
    }

    var reEmail = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

    // Validation en direct (dès que le champ est quitté)
    $("#prenom").addEventListener("blur", function () { marquer("cPrenom", this.value.trim().length >= 2); });
    $("#email").addEventListener("blur", function () { marquer("cEmail", reEmail.test(this.value.trim())); });
    $("#tel").addEventListener("blur", function () {
      marquer("cTel", this.value.replace(/\D/g, "").length >= 6);
    });

    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var prenom = $("#prenom").value.trim();
      var email = $("#email").value.trim();
      var tel = $("#tel").value.trim();
      var consent = $("#consent").checked;

      var okP = prenom.length >= 2, okE = reEmail.test(email), okT = tel.replace(/\D/g, "").length >= 6;
      marquer("cPrenom", okP); marquer("cEmail", okE); marquer("cTel", okT);
      $("#cConsent").classList.toggle("err", !consent);

      if (!okP || !okE || !okT || !consent) {
        msg.className = "form-msg ko";
        msg.textContent = consent ? "Vérifie les champs signalés." : "Merci de cocher la case de consentement.";
        var premier = f.querySelector(".champ.err input");
        if (premier) premier.focus();
        return;
      }

      var btn = f.querySelector('button[type="submit"]');
      btn.disabled = true;
      var libelle = btn.textContent;
      btn.textContent = "Je réserve…";
      msg.className = "form-msg";

      var data = {};
      new FormData(f).forEach(function (v, k) { data[k] = v; });
      data.telephone = $("#indicatif").value + " " + tel;
      data.ts = new Date().toISOString();

      fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.ok ? r.json().catch(function () { return {}; }) : Promise.reject(r.status); })
        .then(function () { succes(data); })
        .catch(function () {
          // Filet de sécurité : on garde le lead en local et on avance
          try {
            var q = JSON.parse(localStorage.getItem("di_file") || "[]");
            q.push(data);
            localStorage.setItem("di_file", JSON.stringify(q));
          } catch (e) {}
          succes(data);
        })
        .finally(function () { btn.disabled = false; btn.textContent = libelle; });
    });

    function succes(data) {
      // Événement de conversion (Meta Pixel + GA4 si présents)
      try { if (window.fbq) window.fbq("track", "Lead"); } catch (e) {}
      try {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "inscription_event", utm_source: data.utm_source || "", utm_content: data.utm_content || "" });
      } catch (e) {}
      try { sessionStorage.setItem("di_prenom", data.prenom || ""); } catch (e) {}
      location.href = "merci.html";
    }
  }

  /* =========================================================
     12. Pop-up de sortie (retenir le « pas maintenant »)
         Desktop : intention de sortie. Mobile : 60 % + 25 s.
         Une seule apparition, jamais deux pop-ups.
         ========================================================= */
  function initPop() {
    var pop = $("#pop");
    if (!pop) return;
    var deja = false;
    try { deja = localStorage.getItem("di_pop") === "1"; } catch (e) {}
    if (deja) return;

    var affiche = false;
    var dernierFocus = null;

    function ouvrir() {
      if (affiche) return;
      // Ne jamais interrompre quelqu'un qui est déjà dans le formulaire
      var insc = $("#inscription");
      if (insc) {
        var r = insc.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) return;
      }
      affiche = true;
      dernierFocus = document.activeElement;
      pop.classList.add("visible");
      pop.setAttribute("aria-hidden", "false");
      var e = $("#popEmail"); if (e) setTimeout(function () { e.focus(); }, 120);
      try { localStorage.setItem("di_pop", "1"); } catch (er) {}
      document.addEventListener("keydown", surEchap);
    }
    function fermer() {
      pop.classList.remove("visible");
      pop.setAttribute("aria-hidden", "true");
      document.removeEventListener("keydown", surEchap);
      if (dernierFocus && dernierFocus.focus) dernierFocus.focus();
    }
    function surEchap(ev) { if (ev.key === "Escape") fermer(); }

    $("#popX").addEventListener("click", fermer);
    pop.addEventListener("click", function (ev) { if (ev.target === pop) fermer(); });

    // Desktop : la souris quitte le haut de la fenêtre
    if (window.matchMedia("(min-width: 781px)").matches) {
      document.addEventListener("mouseout", function (ev) {
        if (!ev.relatedTarget && ev.clientY <= 4) ouvrir();
      });
    } else {
      // Mobile : 60 % de scroll ET 25 s passées
      var t0 = Date.now(), fait = false;
      window.addEventListener("scroll", function () {
        if (fait) return;
        var p = (window.scrollY + window.innerHeight) / document.body.scrollHeight;
        if (p > 0.6 && Date.now() - t0 > 25000) { fait = true; ouvrir(); }
      }, { passive: true });
    }

    // Envoi du pop-up
    var fp = $("#formPop"), pm = $("#popMsg");
    fp.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = $("#popEmail").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
        pm.className = "form-msg ko"; pm.textContent = "Cet email ne semble pas valide.";
        return;
      }
      var b = fp.querySelector("button"); b.disabled = true; b.textContent = "Envoi…";
      fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, origine: "popup-3-questions", ts: new Date().toISOString() })
      }).catch(function () {}).finally(function () {
        pm.className = "form-msg ok";
        pm.textContent = "C'est parti — regarde ta boîte dans quelques minutes.";
        b.textContent = "Envoyé ✓";
        setTimeout(fermer, 2200);
      });
    });
  }

  /* =========================================================
     13. Divers
     ========================================================= */
  function initDivers() {
    var a = $("#annee"); if (a) a.textContent = new Date().getFullYear();

    // Traçage du CTA cliqué (quel emplacement convertit)
    $$("[data-cta]").forEach(function (el) {
      el.addEventListener("click", function () {
        try {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: "clic_cta", emplacement: el.dataset.cta });
        } catch (e) {}
      });
    });

    // Défilement doux vers le formulaire + focus sur le 1er champ
    $$('a[href="#inscription"]').forEach(function (a2) {
      a2.addEventListener("click", function (ev) {
        var cible = $("#inscription");
        if (!cible) return;
        ev.preventDefault();
        cible.scrollIntoView({ behavior: reduit ? "auto" : "smooth", block: "start" });
        setTimeout(function () { var p = $("#prenom"); if (p) p.focus({ preventScroll: true }); }, reduit ? 0 : 700);
      });
    });
  }

  /* ---------- Démarrage ---------- */
  function go() {
    initReveal();
    initBarres();
    initRebours();
    initCompteurs();
    initBraises();
    initTimeline();
    initCine();
    initFaq();
    initPlaces();
    initAttribution();
    initFormulaire();
    initPop();
    initDivers();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
  else go();
})();
