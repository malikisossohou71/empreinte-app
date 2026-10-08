// Gestion des liens publics : code court, alias personnalisé (slug), recherche.
// Un lien public peut être ouvert par TROIS codes équivalents :
//   - son "token" long d'origine (ancien format, reste valable)
//   - son "shortCode" court généré automatiquement (ex. k3x9ab)
//   - son "slug" personnalisé choisi par l'utilisateur (ex. mon-evenement)

const crypto = require('crypto');
const db = require('./db');

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // sans caractères ambigus (l, o, 0, 1)
const SHORT_LEN = 6;

// Mots interdits comme alias (pour ne jamais entrer en conflit avec le site).
const RESERVED = new Set([
  'admin', 'api', 'form', 'p', 'verify', 'uploads', 'public-assets', 'login',
  'signup', 'static', 'assets', 'www', 'null', 'undefined'
]);

function normalize(code) { return String(code || '').trim().toLowerCase(); }

// Retrouve un lien à partir de n'importe lequel de ses codes.
function findByCode(code) {
  const c = normalize(code);
  if (!c) return undefined;
  return db.find('public_links', l =>
    normalize(l.slug) === c || normalize(l.shortCode) === c || String(l.token).toLowerCase() === c
  );
}

// Un code est "pris" s'il correspond déjà à un token, shortCode ou slug (hors lien exclu).
function isTaken(code, excludeLinkId) {
  const c = normalize(code);
  return db.all('public_links').some(l =>
    l.id !== excludeLinkId &&
    (normalize(l.slug) === c || normalize(l.shortCode) === c || String(l.token).toLowerCase() === c)
  );
}

function generateShortCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    const bytes = crypto.randomBytes(SHORT_LEN);
    for (let i = 0; i < SHORT_LEN; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
    if (!isTaken(code) && !RESERVED.has(code)) return code;
  }
  // Extrêmement improbable : on allonge le code.
  return crypto.randomBytes(5).toString('hex');
}

// Vérifie un alias. Retourne { ok: true, slug } ou { ok: false, error }.
function validateSlug(raw, linkId) {
  const slug = normalize(raw);
  if (slug.length < 3 || slug.length > 50) return { ok: false, error: "L'alias doit contenir entre 3 et 50 caractères." };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, error: "L'alias ne peut contenir que des lettres minuscules, des chiffres et des tirets (sans accent, sans espace, sans tiret au début, à la fin ou doublé)." };
  }
  if (RESERVED.has(slug)) return { ok: false, error: "Cet alias est réservé, choisis-en un autre." };
  if (isTaken(slug, linkId)) return { ok: false, error: "Cet alias est déjà utilisé, choisis-en un autre." };
  return { ok: true, slug };
}

// Donne un shortCode aux anciens liens qui n'en ont pas encore (appelé au démarrage).
function backfillShortCodes() {
  const missing = db.filter('public_links', l => !l.shortCode);
  missing.forEach(l => db.update('public_links', l.id, { shortCode: generateShortCode() }));
  return missing.length;
}

module.exports = { findByCode, isTaken, generateShortCode, validateSlug, backfillShortCodes };
