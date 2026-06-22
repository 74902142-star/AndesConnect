import { Injectable, signal, computed } from '@angular/core';
import { SpanishTranslations } from '../i18n/spanish';
import { QuechuaTranslations } from '../i18n/quechua';

export type LanguageCode = 'es' | 'qu';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  // Current language signal, defaults to local storage preference or 'es'
  private readonly currentLanguageSignal = signal<LanguageCode>(
    (localStorage.getItem('preferredLanguage') as LanguageCode) || 'es'
  );

  // Read-only public signal for templates/components to bind to
  readonly currentLanguage = this.currentLanguageSignal.asReadonly();

  // Computed dictionary that updates reactively when language changes
  private readonly activeDictionary = computed(() => {
    return this.currentLanguageSignal() === 'qu' ? QuechuaTranslations : SpanishTranslations;
  });

  /**
   * Sets the active language and saves the preference to LocalStorage
   * @param lang The language code ('es' or 'qu')
   */
  setLanguage(lang: LanguageCode): void {
    this.currentLanguageSignal.set(lang);
    localStorage.setItem('preferredLanguage', lang);
  }

  /**
   * Translates a given key based on the active language dictionary.
   * Because it reads a computed Signal (activeDictionary), calling this method
   * from an Angular template automatically registers the template as a consumer,
   * triggering instant UI updates when the language is changed.
   * @param key The key to look up in the translations dictionary
   * @returns The translated text or the key itself if not found
   */
  translate(key: string): string {
    const dict = this.activeDictionary();
    return dict[key as keyof typeof dict] || key;
  }
}
