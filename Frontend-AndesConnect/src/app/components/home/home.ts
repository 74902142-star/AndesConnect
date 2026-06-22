import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslationService } from '../../services/translation.service';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../layout/navbar';
import { FooterComponent } from '../layout/footer/footer';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent {
  protected readonly ts = inject(TranslationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async startOffline(): Promise<void> {
    const result = await this.auth.loginAsGuest('home');
    if (result.success) {
      this.router.navigate(['/dashboard']);
    }
  }

  startNow(): void {
    this.router.navigate(['/login']);
  }

  /** Navigate to courses filtered by category */
  exploreCourses(category: string): void {
    this.router.navigate(['/courses'], { queryParams: { category } });
  }
}
