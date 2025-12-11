import { en } from "./en"
import { ko } from "./ko"

export const locales = {
  en,
  ko,
} as const

export type LocaleKey = keyof typeof locales

// Default locale
export const defaultLocale: LocaleKey = "en"

// Get translation for a specific locale
export function getTranslations(locale: LocaleKey = defaultLocale) {
  return locales[locale]
}

// Re-export types
export type { Locale } from "./en"
