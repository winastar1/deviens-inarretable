# Deviens Inarrêtable — landing d'inscription

Refonte complète de `deviens-inarretable.com/maintenant`.
Objectif unique : maximiser les inscriptions à l'événement live gratuit des 23 & 24 août, et réduire le no-show.

## Démarrer

    node server.js              # http://localhost:3000
    PORT=4173 node server.js    # autre port

Aucune dépendance à installer (Node natif). Node 18+ recommandé.

- La page principale répond sur `/` ET sur `/maintenant` (l'URL utilisée dans les pubs).
- Les inscriptions arrivent dans `data/leads.jsonl` et `data/leads.csv` (ouvrable dans Excel).

## Arborescence

    public/
      index.html              la landing
      merci.html              page de confirmation (anti-no-show, .ics)
      confidentialite.html    RGPD — A COMPLETER
      mentions-legales.html   LCEN — A COMPLETER
      robots.txt / sitemap.xml
      assets/styles.css       tout le design
      assets/app.js           toutes les interactions
      brand/                  visuels + hero-seq/ (96 frames de la séquence scrubée)
    server.js                 serveur statique + API inscription
    data/                     leads (créé automatiquement)

## Les 3 réglages à faire avant la mise en ligne

### 1. Dates, places, endpoint

`public/assets/app.js`, tout en haut :

    var CONFIG = {
      dateDebut:    "2026-08-23T20:00:00+02:00", // pilote le compte à rebours
      placesTotal:  300,
      placesPrises: 176,                          // à mettre à jour à la main
      endpoint:     "/api/inscription"
    };

Miroir côté serveur dans `server.js` : `PLACES_TOTAL` et `PLACES_DEPART`.

Le compteur de places est volontairement manuel. Pas de faux décompte aléatoire, pas de timer qui se réinitialise à chaque visite. Si le chiffre affiché est faux et que quelqu'un le remarque, c'est toute la crédibilité de la page qui tombe.

### 2. Mentions légales et confidentialité

`mentions-legales.html` et `confidentialite.html` contiennent des champs [entre crochets] : dénomination sociale, SIREN, adresse, hébergeur, email de contact, prestataire d'emailing, durées de conservation.

Obligatoire : la case de consentement du formulaire renvoie vers la politique de confidentialité. Si la page est vide, le consentement n'est pas valable.

### 3. Brancher l'emailing

Dans `server.js`, à la fin de la route `/api/inscription`, la ligne est déjà prête :

    // envoyerEmailBienvenue(lead).catch(e => console.error(e));

Exemple minimal (Brevo, Mailjet, Resend, ActiveCampaign… même principe) :

    async function envoyerEmailBienvenue(lead) {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": process.env.EMAIL_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sender: { name: "Jeremy Mezadorian", email: "contact@deviens-inarretable.com" },
          to: [{ email: lead.email, name: lead.prenom }],
          subject: "Ta place est réservée — voici ton lien Zoom",
          htmlContent: "<p>" + lead.prenom + ", ta place est confirmée pour les 23 et 24 août à 20h.</p>"
        })
      });
    }

Lancer ensuite avec la clé : `EMAIL_API_KEY=xxx node server.js`

Les rappels J-1 et H-1 sont annoncés sur la page de confirmation : ils doivent réellement être programmés (séquence automatique côté outil d'emailing, ou tâche cron). Une promesse affichée non tenue = no-show garanti.

## Ce qui a été corrigé par rapport à la page actuelle

| Défaut constaté | Correction |
|---|---|
| Aucun formulaire visible avant le bas de page | 7 CTA répartis + barre de CTA fixe en bas sur mobile (le levier n°1 : c'est là qu'arrive le trafic Instagram) |
| Rareté annoncée sans rien pour l'étayer | Jauge de places chiffrée et pilotable + compte à rebours sur la vraie date |
| Visiteur non converti = perdu à 100 % | Pop-up de sortie (desktop : intention de sortie ; mobile : 60 % de scroll + 25 s) qui capture l'email contre un contenu court. Une seule apparition, mémorisée. Jamais déclenché si la personne est déjà dans le formulaire. |
| Rien après le clic → no-show massif | Page de confirmation avec Google Calendar, fichier .ics pour les deux soirées (avec alarmes J-1 et H-1), les 3 étapes suivantes et le partage |
| Aucune FAQ → les indécis partent sans réponse | 7 questions en accordéon, placées juste avant le formulaire (une objection nommée trop tôt est une objection créée) |
| Zéro SEO / zéro aperçu au partage | title, meta description, canonical, Open Graph + Twitter Card, JSON-LD EducationEvent (date, format en ligne, organisateur, prix 0 €) + JSON-LD FAQPage, sitemap, robots |
| Impossible de savoir quelle pub convertit | UTM + fbclid capturés en champs cachés (et mémorisés en session), transmis avec le lead ; chaque CTA envoie son emplacement au dataLayer |
| Témoignages relégués | Remontés au 2e écran, avec le chiffre global (1500 / 15 ans / 4 pays) avant les cas individuels |
| Formulaire long et flou | 3 champs (prénom, email, téléphone), validation en direct, clavier mobile adapté, font-size 16px pour éviter le zoom iOS |
| Aucun consentement RGPD | Case non pré-cochée, obligatoire, liée à la politique de confidentialité |

## Le slow motion (demandé explicitement)

Quatre mécaniques distinctes, toutes coupées si `prefers-reduced-motion` est actif :

1. Hero — Ken Burns de 46 s en boucle alternée sur le visuel de fond : ça respire en continu sans jamais peser.
2. Braises — canvas de 46 particules qui montent à 0,10–0,26 px/frame (très lent, volontairement). Désactivé sous 760 px et sur les appareils à moins de 4 cœurs, mis en pause dès que le hero sort de l'écran.
3. Séquence scrubée — section « Tu n'as pas un problème de stratégie » : les 96 frames de `brand/hero-seq/` sont pilotées par le scroll, image par image. C'est le vrai ralenti : la vitesse dépend du doigt de l'utilisateur. Sur mobile, une image fixe (le poster) est affichée à la place — pas de téléchargement de 96 fichiers sur un réseau mobile.
4. Révélations — masque vertical + translation, easing cubic-bezier(0.16, 1, 0.3, 1) sur 900 ms, en cascade de 80 ms. La timeline des 5 chutes se remplit au scroll et les pastilles s'allument une par une.

## Accessibilité et performance

- Lien d'évitement, navigation clavier complète, focus ambre visible, aria-expanded sur la FAQ, aria-hidden sur le décoratif, role="dialog" + fermeture par Échap sur le pop-up.
- Texte toujours sur un voile sombre (contraste AA garanti, jamais de blanc sur image nue).
- Titre et CTA du hero affichés avant toute animation : le LCP n'attend rien.
- Visuel du hero en fetchpriority="high", le reste en loading="lazy" avec width/height (zéro décalage de mise en page).
- Cache long sur les assets, no-cache sur le HTML, ETag, en-têtes nosniff / X-Frame-Options / Referrer-Policy.

## Tracking

Le code de conversion est déjà en place : au submit, `fbq('track','Lead')` et un push `dataLayer`. Il ne reste qu'à coller le snippet Meta Pixel et/ou GA4 dans le `<head>` de `index.html` — l'événement partira tout seul.

## Points d'honnêteté (à ne pas « optimiser »)

Trois choses ont été délibérément écartées, parce qu'elles se retournent contre la marque dès qu'un visiteur les repère :

- pas de compte à rebours qui redémarre à chaque visite ;
- pas de « 37 personnes regardent cette page » inventé ;
- pas de logo de média ou de marque sans autorisation — les noms des formateurs sont cités en texte, avec une mention explicite dans les mentions légales indiquant qu'il n'y a ni partenariat ni cautionnement.

Un avertissement sur les témoignages et l'absence de garantie de résultat figure dans le pied de page et dans les mentions légales. Sur un sujet de développement personnel vendu à des entrepreneurs, c'est ce qui protège l'organisateur.
