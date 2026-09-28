import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, ALL_LANGS } from '../src/js/i18n/index.js';

test('every language defines the same keys as English (no missing translations)', () => {
  const en = Object.keys(STRINGS.en);
  for (const lang of ALL_LANGS) {
    const missing = en.filter((k) => !(k in STRINGS[lang]));
    assert.deepEqual(missing, [], `${lang} is missing: ${missing.join(', ')}`);
  }
});
