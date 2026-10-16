import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  t, registerStrings, setLang, getLang, onLangChange, hasString, missingKeys, detectLang, LANGS, formatNumber,
} from '../js/i18n.js';
import '../js/data.js';

// Keys registered by this file only – excluded from the missingKeys() check.
const P = 'i18ntest.';

describe('i18n', () => {
  beforeEach(() => setLang('de'));

  test('starts in German with both languages available', () => {
    assert.deepEqual(LANGS, ['de', 'en']);
    assert.equal(getLang(), 'de');
  });

  test('every string registered by data.js exists in German and English', () => {
    assert.deepEqual(missingKeys().filter((k) => !k.includes(P)), []);
  });

  test('formatNumber() uses the locale of the current language', () => {
    assert.equal(formatNumber(1534), '1.534');
    assert.equal(formatNumber(2.5, 1), '2,5');
    assert.equal(formatNumber(2.54), '3');
    setLang('en');
    assert.equal(formatNumber(1534), '1,534');
    assert.equal(formatNumber(2.5, 1), '2.5');
    assert.equal(formatNumber('x'), '0');
  });

  test('t() translates and interpolates {placeholders}', () => {
    registerStrings({
      de: { [`${P}coins`]: '{name} hat {n} Münzen – {n}!' },
      en: { [`${P}coins`]: '{name} has {n} coins – {n}!' },
    });
    assert.equal(t(`${P}coins`, { name: 'Ana', n: 12 }), 'Ana hat 12 Münzen – 12!');
    setLang('en');
    assert.equal(t(`${P}coins`, { name: 'Ana', n: 0 }), 'Ana has 0 coins – 0!');
  });

  test('unknown placeholders stay visible, extra params are ignored', () => {
    registerStrings({ de: { [`${P}partial`]: 'A {a} B {b}' }, en: { [`${P}partial`]: 'A {a} B {b}' } });
    assert.equal(t(`${P}partial`, { a: 1, z: 9 }), 'A 1 B {b}');
    assert.equal(t(`${P}partial`), 'A {a} B {b}');
  });

  test('falls back to German, then to the key itself', () => {
    registerStrings({ de: { [`${P}onlyDe`]: 'Nur Deutsch' } });
    setLang('en');
    assert.equal(t(`${P}onlyDe`), 'Nur Deutsch');
    assert.equal(t(`${P}nowhere`), `${P}nowhere`);
    assert.equal(t(`${P}nowhere.{n}`, { n: 3 }), `${P}nowhere.3`);
  });

  test('registerStrings merges and later registrations win', () => {
    registerStrings({ de: { [`${P}a`]: 'A1', [`${P}b`]: 'B1' }, en: { [`${P}a`]: 'A1', [`${P}b`]: 'B1' } });
    registerStrings({ de: { [`${P}a`]: 'A2' } });
    assert.equal(t(`${P}a`), 'A2');
    assert.equal(t(`${P}b`), 'B1');
  });

  test('hasString checks the current or a given language', () => {
    registerStrings({ de: { [`${P}has`]: 'ja' } });
    assert.equal(hasString(`${P}has`), true);
    assert.equal(hasString(`${P}has`, 'en'), false);
    assert.equal(hasString(`${P}has`, 'fr'), false);
    setLang('en');
    assert.equal(hasString(`${P}has`), false);
  });

  test('setLang notifies listeners only on real changes', () => {
    const calls = [];
    const off = onLangChange((l) => calls.push(l));
    setLang('en');
    setLang('en');
    setLang('fr');
    assert.equal(getLang(), 'en');
    setLang('de');
    assert.deepEqual(calls, ['en', 'de']);
    off();
    setLang('en');
    assert.deepEqual(calls, ['en', 'de']);
  });

  test('setLang updates <html lang> when a document exists', () => {
    const fake = { documentElement: { lang: '' } };
    globalThis.document = fake;
    try {
      setLang('en');
      assert.equal(fake.documentElement.lang, 'en');
      setLang('de');
      assert.equal(fake.documentElement.lang, 'de');
    } finally {
      delete globalThis.document;
    }
  });

  test('detectLang picks German only for German browsers', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const withLang = (language) => {
      Object.defineProperty(globalThis, 'navigator', { value: { language }, configurable: true, writable: true });
      return detectLang();
    };
    try {
      assert.equal(withLang('de-AT'), 'de');
      assert.equal(withLang('DE'), 'de');
      assert.equal(withLang('en-US'), 'en');
      assert.equal(withLang('fr-FR'), 'en');
      assert.equal(withLang(''), 'en');
    } finally {
      if (original) Object.defineProperty(globalThis, 'navigator', original);
      else delete globalThis.navigator;
    }
  });
});
