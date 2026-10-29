import { useTranslation } from '@/i18n';
import { Languages } from 'lucide-react';

export function LanguageToggle() {
  const { language, toggleLanguage } = useTranslation();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
      title={language === 'en' ? 'Switch to বাংলা' : 'Switch to English'}
      aria-label="Toggle language"
    >
      <Languages className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
      <span className="font-semibold text-stone-800 dark:text-stone-200">
        {language === 'en' ? 'EN' : 'বাং'}
      </span>
    </button>
  );
}
