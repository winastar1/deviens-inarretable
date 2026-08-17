/**
 * DEVIENS INARRÊTABLE — serveur minimal
 * ------------------------------------------------------------
 * Zéro dépendance (Node natif). Il fait trois choses :
 *   1. servir les fichiers statiques de /public
 *   2. recevoir les inscriptions sur POST /api/inscription
 *      → écrites en JSONL dans data/leads.jsonl (+ CSV lisible)
 *   3. exposer GET /api/places (nombre de places restantes)
 *
 * Lancer :  node server.js        (port 3000 par défaut)
 *           PORT=8080 node server.js
 */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const RACINE = path.join(__dirname, "public");
const DOSSIER_DATA = path.join(__dirname, "data");
const FICHIER_LEADS = path.join(DOSSIER_DATA, "leads.jsonl");
const FICHIER_CSV = path.join(DOSSIER_DATA, "leads.csv");

// Capacité annoncée — doit rester cohérente avec CONFIG dans public/assets/app.js
const PLACES_TOTAL = 300;
const PLACES_DEPART = 176;

if (!fs.existsSync(DOSSIER_DATA)) fs.mkdirSync(DOSSIER_DATA, { recursive: true });

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".glb": "model/gltf-binary",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".ics": "text/calendar; charset=utf-8"
};

/* ---------------- utilitaires ---------------- */

function json(res, code, obj) {
  const corps = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(corps),
    "Cache-Control": "no-store"
  });
  res.end(corps);
}

function nettoyer(v, max) {
  return String(v == null ? "" : v).replace(/[\r\n\t]/g, " ").trim().slice(0, max || 200);
}

function emailValide(e) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e);
}

function compterLeads() {
  try {
    const c = fs.readFileSync(FICHIER_LEADS, "utf8");
    return c.split("\n").filter((l) => l.trim().length).length;
  } catch (e) {
    return 0;
  }
}

function ajouterCsv(l) {
  const entete = "date,prenom,email,telephone,utm_source,utm_medium,utm_campaign,utm_content,fbclid,origine,ip\n";
  if (!fs.existsSync(FICHIER_CSV)) fs.writeFileSync(FICHIER_CSV, entete, "utf8");
  const esc = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const ligne = [
    l.ts, l.prenom, l.email, l.telephone,
    l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content,
    l.fbclid, l.origine, l.ip
  ].map(esc).join(",") + "\n";
  fs.appendFileSync(FICHIER_CSV, ligne, "utf8");
}

/* ---------------- fichiers statiques ---------------- */

function servirStatique(req, res, chemin) {
  // URL décodée + normalisée, on interdit de sortir de /public
  let rel;
  try {
    rel = decodeURIComponent(chemin);
  } catch (e) {
    res.writeHead(400); return res.end("Requête invalide");
  }
  if (rel === "/" ) rel = "/index.html";
  if (rel === "/maintenant") rel = "/index.html";              // l'URL réelle de la campagne
  if (rel.endsWith("/")) rel += "index.html";

  const abs = path.normalize(path.join(RACINE, rel));
  if (!abs.startsWith(RACINE)) { res.writeHead(403); return res.end("Interdit"); }

  fs.stat(abs, (err, st) => {
    // Pas de fichier : on tente l'extension .html (URL propres)
    if (err || !st.isFile()) {
      const alt = abs + ".html";
      return fs.stat(alt, (e2, s2) => {
        if (e2 || !s2.isFile()) { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
          return res.end("<h1>404</h1><p><a href='/'>Retour à l'accueil</a></p>"); }
        envoyer(alt, s2);
      });
    }
    envoyer(abs, st);
  });

  function envoyer(fichier, st) {
    const ext = path.extname(fichier).toLowerCase();
    const type = TYPES[ext] || "application/octet-stream";
    // HTML : jamais de cache ; le reste : cache long (les noms sont stables)
    const cache = ext === ".html"
      ? "no-cache"
      : "public, max-age=31536000, immutable";
    const etag = '"' + st.size + "-" + Number(st.mtimeMs).toString(36) + '"';

    if (req.headers["if-none-match"] === etag) { res.writeHead(304); return res.end(); }

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": st.size,
      "Cache-Control": cache,
      "ETag": etag,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN"
    });
    fs.createReadStream(fichier).pipe(res);
  }
}

/* ---------------- serveur ---------------- */

const serveur = http.createServer((req, res) => {
  const u = new URL(req.url, "http://" + (req.headers.host || "localhost"));

  // Places restantes
  if (req.method === "GET" && u.pathname === "/api/places") {
    const prises = PLACES_DEPART + compterLeads();
    return json(res, 200, {
      total: PLACES_TOTAL,
      prises: Math.min(prises, PLACES_TOTAL),
      restantes: Math.max(0, PLACES_TOTAL - prises)
    });
  }

  // Inscription
  if (req.method === "POST" && u.pathname === "/api/inscription") {
    let brut = "";
    let trop = false;
    req.on("data", (c) => {
      brut += c;
      if (brut.length > 12000) { trop = true; req.destroy(); }
    });
    req.on("end", () => {
      if (trop) return json(res, 413, { ok: false, erreur: "Charge trop lourde" });

      let d;
      try { d = JSON.parse(brut || "{}"); }
      catch (e) { return json(res, 400, { ok: false, erreur: "JSON invalide" }); }

      const email = nettoyer(d.email, 160).toLowerCase();
      if (!emailValide(email)) return json(res, 400, { ok: false, erreur: "Email invalide" });

      const lead = {
        ts: new Date().toISOString(),
        prenom: nettoyer(d.prenom, 60),
        email: email,
        telephone: nettoyer(d.telephone || d.tel, 40),
        consent: d.consent ? true : false,
        origine: nettoyer(d.origine || "formulaire-principal", 60),
        page: nettoyer(d.page, 120),
        utm_source: nettoyer(d.utm_source, 80),
        utm_medium: nettoyer(d.utm_medium, 80),
        utm_campaign: nettoyer(d.utm_campaign, 120),
        utm_content: nettoyer(d.utm_content, 120),
        fbclid: nettoyer(d.fbclid, 220),
        ua: nettoyer(req.headers["user-agent"], 240),
        ip: nettoyer((req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0], 60)
      };

      try {
        fs.appendFileSync(FICHIER_LEADS, JSON.stringify(lead) + "\n", "utf8");
        ajouterCsv(lead);
      } catch (e) {
        console.error("[inscription] échec d'écriture :", e.message);
        return json(res, 500, { ok: false, erreur: "Enregistrement impossible" });
      }

      console.log("[inscription]", lead.email, "· source:", lead.utm_source || "direct");

      // >>> BRANCHEMENT EMAILING : voir README, section « Brancher l'emailing »
      // envoyerEmailBienvenue(lead).catch(e => console.error(e));

      return json(res, 200, { ok: true });
    });
    return;
  }

  // Méthode non prévue sur les routes API
  if (u.pathname.startsWith("/api/")) {
    return json(res, 405, { ok: false, erreur: "Méthode non autorisée" });
  }

  return servirStatique(req, res, u.pathname);
});

serveur.listen(PORT, () => {
  console.log("Deviens Inarrêtable — http://localhost:" + PORT);
  console.log("Leads → " + FICHIER_LEADS);
});
