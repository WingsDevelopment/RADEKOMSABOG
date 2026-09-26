import sr from './content/sr.js';
import en from './content/en.js';

export const translations = { sr, en };
export const LANGUAGE_KEY = 'rade-language';
export function savedLanguage(storage) {
  try { return storage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'sr'; } catch { return 'sr'; }
}
export function lookup(language, key) {
  const value = key.split('.').reduce((entry, part) => entry?.[part], translations[language]);
  if (value === undefined) throw new Error(`Missing translation: ${language}.${key}`);
  return value;
}
export function createI18n(storage) {
  let language = savedLanguage(storage);
  return {
    get language() { return language; },
    t: key => lookup(language, key),
    setLanguage(next) {
      if (!Object.hasOwn(translations, next)) return;
      language = next;
      try { storage.setItem(LANGUAGE_KEY, next); } catch { /* Storage is optional. */ }
    },
    format(value, decimals = 0) { return value.toLocaleString(language === 'sr' ? 'sr-Latn-RS' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); },
  };
}
