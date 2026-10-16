// Tiny i18n layer. Every module registers its own strings with a key prefix
// (e.g. "game.*", "shop.*") so modules stay independent of each other.

const dicts = { de: {}, en: {} };
export const LANGS = ['de', 'en'];
let lang = 'de';
const listeners = new Set();

export function registerStrings(table) {
  for (const l of Object.keys(table)) {
    if (!dicts[l]) dicts[l] = {};
    Object.assign(dicts[l], table[l]);
  }
}

// t('shop.buy') or t('game.plus', { n: 12 }) → "{n}" placeholders are replaced.
export function t(key, params) {
  let s = dicts[lang]?.[key] ?? dicts.de[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
  return s;
}

export function hasString(key, l = lang) {
  return dicts[l] !== undefined && dicts[l][key] !== undefined;
}

export function getLang() {
  return lang;
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) {
    if (LANGS.includes(next)) syncDocumentLang();
    return;
  }
  lang = next;
  syncDocumentLang();
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function detectLang() {
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('de') ? 'de' : 'en';
}

// Exposed for tests: every key registered in one language but missing in another.
export function missingKeys() {
  const all = new Set([...Object.keys(dicts.de), ...Object.keys(dicts.en)]);
  const out = [];
  for (const k of all) for (const l of LANGS) if (dicts[l][k] === undefined) out.push(`${l}:${k}`);
  return out;
}

function syncDocumentLang() {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
