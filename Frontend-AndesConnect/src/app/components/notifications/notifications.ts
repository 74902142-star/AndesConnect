import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslationService } from '../../services/translation.service';
import { NotificationService } from '../../services/notification.service';
import { NavbarComponent } from '../layout/navbar';
import { FooterComponent } from '../layout/footer/footer';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './notifications.html',
  styleUrls: ['./notifications.css']
})
export class NotificationsComponent {
  protected readonly ts = inject(TranslationService);
  protected readonly notifService = inject(NotificationService);
  private readonly router = inject(Router);

  getTypeIcon(type: string): string {
    const map: Record<string, string> = {
      course_complete: '🎓',
      download_ready: '⬇',
      sync_done: '✓',
      new_course: '📚',
      achievement: '🏆'
    };
    return map[type] ?? '🔔';
  }

  getTypeColor(type: string): string {
    const map: Record<string, string> = {
      course_complete: '#16a34a',
      download_ready: '#4f46e5',
      sync_done: '#1e3a5f',
      new_course: '#ebd047',
      achievement: '#c2410c'
    };
    return map[type] ?? '#1a1a1a';
  }

  handleClick(notif: { id: string; read: boolean; actionRoute?: string }): void {
    if (!notif.read) {
      this.notifService.markAsRead(notif.id);
    }
    if (notif.actionRoute) {
      this.router.navigate([notif.actionRoute]);
    }
  }

  markAllRead(): void {
    this.notifService.markAllRead();
  }

  deleteNotif(id: string, event: Event): void {
    event.stopPropagation();
    this.notifService.deleteNotification(id);
  }

  clearAll(): void {
    this.notifService.clearAll();
  }
}
