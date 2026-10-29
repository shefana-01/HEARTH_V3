import { en } from './en';
import { bn } from './bn';

/**
 * Validates that all translation keys in the English dictionary
 * have a corresponding non-empty translation in the Bengali dictionary.
 */
export function validateTranslations(): { valid: boolean; missingKeys: string[] } {
  const missingKeys: string[] = [];

  for (const [section, keys] of Object.entries(en)) {
    const bnSection = (bn as Record<string, Record<string, string>>)[section];
    if (!bnSection) {
      missingKeys.push(section);
      continue;
    }
    for (const key of Object.keys(keys as Record<string, string>)) {
      if (!bnSection[key] || bnSection[key].trim() === '') {
        missingKeys.push(`${section}.${key}`);
      }
    }
  }

  return {
    valid: missingKeys.length === 0,
    missingKeys,
  };
}

// Self-executing verification
const result = validateTranslations();
if (!result.valid) {
  console.warn('Missing translation keys in Bengali dictionary:', result.missingKeys);
} else {
  // All translation keys match 1:1
}
