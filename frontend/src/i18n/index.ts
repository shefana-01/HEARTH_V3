import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { en, type TranslationKeys } from './en';
import { bn } from './bn';

export type Language = 'en' | 'bn';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: TranslationKeys;
}

const dictionaries: Record<Language, TranslationKeys> = { en, bn };

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'hearth_lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'bn' ? 'bn' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // ignore in SSR / restricted storage
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'bn' : 'en');
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t: dictionaries[language],
  };

  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: en,
    };
  }
  return context;
}
