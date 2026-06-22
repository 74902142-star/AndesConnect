import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncService } from '../../services/sync.service';
import { CourseService } from '../../services/course.service';
import { TranslationService } from '../../services/translation.service';
import { NavbarComponent } from '../layout/navbar';
import { FooterComponent } from '../layout/footer/footer';
import { formatDate } from '../../shared/utils';

@Component({
  selector: 'app-sync-status',
  standalone: true,
  imports: [CommonModule, NavbarComponent, FooterComponent],
  templateUrl: './sync-status.html',
  styleUrls: ['./sync-status.css']
})
export class SyncStatusComponent {
  protected readonly sync = inject(SyncService);
  protected readonly courseService = inject(CourseService);
  protected readonly ts = inject(TranslationService);
  protected readonly formatDate = formatDate;

  get usedPercent(): number {
    return (this.sync.usedSpace() / this.sync.maxSpace()) * 100;
  }

  get statusLabel(): string {
    return this.sync.isOnline()
      ? this.ts.translate('sync.mode_online')
      : this.ts.translate('sync.mode_offline');
  }

  displayFileName(name: string): string {
    return name.replace(/_/g, ' ').replace('.pdf', '').replace('.mp4', '').toUpperCase();
  }

  get nodeId(): string {
    let id = localStorage.getItem('rt_node');
    if (!id) {
      id = 'RT-SEC-' + Math.floor(1000 + Math.random() * 8999);
      localStorage.setItem('rt_node', id);
    }
    return id;
  }

  triggerSync(): void {
    this.sync.syncNow();
  }

  clearStorage(): void {
    this.sync.clearCache();
  }
}
