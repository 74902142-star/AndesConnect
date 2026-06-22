import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { TranslationService } from '../../services/translation.service';
import { AuthService } from '../../services/auth.service';
import { SettingsService } from '../../services/settings.service';
import { NavbarComponent } from '../layout/navbar';
import { FooterComponent } from '../layout/footer/footer';
import { AppSettings } from '../../shared/types';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, NavbarComponent, FooterComponent],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css']
})
export class SettingsComponent implements OnInit {
  protected readonly ts = inject(TranslationService);
  protected readonly auth = inject(AuthService);
  protected readonly settingsService = inject(SettingsService);
  private readonly fb = inject(FormBuilder);

  protected saveSuccess = signal(false);
  protected resetDone = signal(false);

  protected form = this.fb.nonNullable.group({
    defaultLanguage: [this.settingsService.get('defaultLanguage')],
    autoSync: [this.settingsService.get('autoSync')],
    notifications: [this.settingsService.get('notifications')],
    downloadWifiOnly: [this.settingsService.get('downloadWifiOnly')],
    darkMode: [this.settingsService.get('darkMode')],
    fontSize: [this.settingsService.get('fontSize')]
  });

  ngOnInit(): void {
    const s = this.settingsService.settings();
    this.form.patchValue(s);
  }

  save(): void {
    const val = this.form.getRawValue() as AppSettings;
    this.settingsService.updateAll(val);
    // Apply language change
    this.ts.setLanguage(val.defaultLanguage);
    this.saveSuccess.set(true);
    setTimeout(() => this.saveSuccess.set(false), 3000);
  }

  reset(): void {
    this.settingsService.reset();
    const s = this.settingsService.settings();
    this.form.patchValue(s);
    this.resetDone.set(true);
    setTimeout(() => this.resetDone.set(false), 3000);
  }

  clearData(): void {
    localStorage.removeItem('rt_notifications');
    localStorage.removeItem('rt_certificates');
    localStorage.removeItem('rt_last_sync');
    this.resetDone.set(true);
    setTimeout(() => this.resetDone.set(false), 3000);
  }
}
