import { Injectable, signal } from '@angular/core';
import { AppSettings } from '../shared/types';

const DEFAULT_SETTINGS: AppSettings = {
  defaultLanguage: 'es',
  autoSync: true,
  notifications: true,
  downloadWifiOnly: false,
  darkMode: false,
  fontSize: 'medium'
};

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly STORAGE_KEY = 'rt_settings';

  readonly settings = signal<AppSettings>(this.loadFromStorage());

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings()[key];
  }

  update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings.update(s => ({ ...s, [key]: value }));
    this.saveToStorage();
  }

  updateAll(newSettings: Partial<AppSettings>): void {
    this.settings.update(s => ({ ...s, ...newSettings }));
    this.saveToStorage();
  }

  reset(): void {
    this.settings.set({ ...DEFAULT_SETTINGS });
    this.saveToStorage();
  }

  private loadFromStorage(): AppSettings {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private saveToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings()));
  }
}
