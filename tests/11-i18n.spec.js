import { test, expect } from '@playwright/test';
import { STRINGS } from '../src/i18n/strings.js';

/*
  Guards the dictionaries themselves. A missing key silently falls back to
  Romanian at runtime, which is easy to ship without noticing — especially
  when adding a new language or a new screen.
*/

const LANGS = ['ro', 'en', 'hu'];

test.describe('i18n dictionaries', () => {
  test('every language is present', () => {
    for (const l of LANGS) expect(STRINGS[l], `missing dictionary: ${l}`).toBeTruthy();
  });

  test('all languages define exactly the same keys as Romanian', () => {
    const roKeys = Object.keys(STRINGS.ro).sort();
    for (const l of LANGS.filter((x) => x !== 'ro')) {
      const keys = Object.keys(STRINGS[l]).sort();
      const missing = roKeys.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !roKeys.includes(k));
      expect(missing, `${l} is missing keys`).toEqual([]);
      expect(extra, `${l} has keys Romanian doesn't`).toEqual([]);
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
