import { describe, expect, it } from 'vitest';
import { en } from './en';
import { bn } from './bn';

/** Every key in a section: "section.key". */
const keys = (dict: Record<string, Record<string, string>>) => Object.entries(dict).flatMap(([section, entries]) => Object.keys(entries).map((key) => `${section}.${key}`));

describe('translations', () => {
  it('Bengali has exactly the same keys as English', () => {
    expect(keys(bn as Record<string, Record<string, string>>).sort()).toEqual(keys(en).sort());
  });

  it('no Bengali text is empty or left in English by mistake', () => {
    const allowedSame = new Set(['common.appName', 'common.bengali', 'common.english']);
    for (const [section, entries] of Object.entries(en)) {
      for (const [key, english] of Object.entries(entries)) {
        const bengali = (bn as Record<string, Record<string, string>>)[section][key];
        expect(bengali.trim(), `${section}.${key}`).not.toBe('');
        if (!allowedSame.has(`${section}.${key}`)) expect(bengali, `${section}.${key} is still English`).not.toBe(english);
      }
    }
  });
});
