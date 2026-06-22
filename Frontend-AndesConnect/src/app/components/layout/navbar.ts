import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslationService, LanguageCode } from '../../services/translation.service';
import { SyncService } from '../../services/sync.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly ts = inject(TranslationService);
  protected readonly sync = inject(SyncService);
  protected readonly notifService = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  changeLanguage(lang: LanguageCode): void {
    this.ts.setLanguage(lang);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
