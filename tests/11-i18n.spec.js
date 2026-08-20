import { test, expect } from '@playwright/test';
import { STRINGS, pluralForm, COUNTED } from '../src/i18n/strings.js';

/*
  Guards the dictionaries themselves. A missing key silently falls back to
  Romanian at runtime, which is easy to ship without noticing — especially
  when adding a new language or a new screen.
*/

const LANGS = ['ro', 'en', 'hu'];
const LOCALES = { ro: 'ro-RO', en: 'en-GB', hu: 'hu-HU' };

/*
  Counted nouns are the one place where the languages are allowed to differ in
  which keys they define: Romanian needs three forms, English two, Hungarian
  one. So they are held to a different rule below rather than compared
  key for key.
*/
const FORM = /_(one|few|two|many|other)$/;
const isCountedForm = (k) => FORM.test(k) && COUNTED.includes(k.replace(FORM, ''));
const baseKeys = (l) => [...new Set(Object.keys(STRINGS[l]).map((k) => (isCountedForm(k) ? k.replace(FORM, '') : k)))];

test.describe('i18n dictionaries', () => {
  test('every language is present', () => {
    for (const l of LANGS) expect(STRINGS[l], `missing dictionary: ${l}`).toBeTruthy();
  });

  test('all languages cover exactly the same things as Romanian', () => {
    const ro = baseKeys('ro').sort();
    for (const l of LANGS.filter((x) => x !== 'ro')) {
      const keys = baseKeys(l).sort();
      expect(ro.filter((k) => !keys.includes(k)), `${l} is missing keys`).toEqual([]);
      expect(keys.filter((k) => !ro.includes(k)), `${l} has keys Romanian doesn't`).toEqual([]);
    }
  });

  /*
    Every form a language's own rules can produce must be spelled out in that
    language's own dictionary.

    Checking the resolved word instead is not enough, and the first version of
    this test proved it: deleting the English singular still passed, because
    the lookup quietly fell back to the plural and answered "1 replies". The
    fallback exists so a gap degrades instead of crashing; the point of the
    test is that there is no gap to degrade through.
  */
  test('counted nouns spell out every plural form their language can produce', () => {
    for (const l of LANGS) {
      const forms = new Intl.PluralRules(LOCALES[l]).resolvedOptions().pluralCategories;
      for (const base of COUNTED) {
        for (const form of forms) {
          expect(STRINGS[l][`${base}_${form}`], `${l} does not define ${base}_${form}`).toBeTruthy();
        }
      }
    }
  });

  // And the lookup in front of them agrees, for numbers taken from each form.
  test('counted nouns never borrow a word from another language', () => {
    for (const l of LANGS) {
      const own = new Set(Object.values(STRINGS[l]));
      for (const base of COUNTED) {
        for (const n of [0, 1, 2, 5, 19, 20, 101, 120]) {
          const word = pluralForm(l, base, n);
          expect(own.has(word), `${l}.${base} (n=${n}) answered "${word}", which is not ${l}`).toBe(true);
        }
      }
    }
  });

  test('no empty or placeholder-looking values', () => {
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(STRINGS[l])) {
        expect(typeof v, `${l}.${k} should be a string`).toBe('string');
        expect(v.trim(), `${l}.${k} is empty`).not.toBe('');
        expect(v, `${l}.${k} looks like an untranslated marker`).not.toMatch(/^(TODO|FIXME|XXX)/i);
      }
    }
  });

  // The relative-time strings are templates; each language controls its own
  // word order, so the {n} placeholder must survive in every language.
  test('relative-time templates all contain the {n} placeholder', () => {
    for (const l of LANGS) {
      for (const k of ['time_ago_min', 'time_ago_h', 'time_ago_days']) {
        expect(STRINGS[l][k], `${l}.${k} must contain {n}`).toContain('{n}');
      }
    }
  });
});
