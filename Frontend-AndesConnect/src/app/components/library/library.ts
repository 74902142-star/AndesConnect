import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslationService } from '../../services/translation.service';
import { CourseService } from '../../services/course.service';
import { SyncService } from '../../services/sync.service';
import { NavbarComponent } from '../layout/navbar';
import { FooterComponent } from '../layout/footer/footer';

import { IndexedDbService } from '../../services/indexeddb.service';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './library.html',
  styleUrls: ['./library.css']
})
export class LibraryComponent {
  protected readonly ts = inject(TranslationService);
  protected readonly courseService = inject(CourseService);
  protected readonly sync = inject(SyncService);
  protected readonly indexedDb = inject(IndexedDbService);
  private readonly router = inject(Router);

  protected readonly deleteMessage = signal<string>('');
  protected readonly openMessage = signal<string>('');

  get usedPercent(): number {
    return (this.sync.usedSpace() / this.sync.maxSpace()) * 100;
  }

  get offlineCourses() {
    return this.courseService.courses().filter(c => c.downloaded);
  }

  formatDate(ts: number): string {
    const d = new Date(ts);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  getFileTypeLabel(type: string): string {
    return type === 'pdf' ? this.ts.translate('library.type_pdf') : this.ts.translate('library.type_video');
  }

  getFileIcon(type: string): string {
    return type === 'pdf' ? '📄' : '🎬';
  }

  async openFile(name: string): Promise<void> {
    // Para evitar que el navegador bloquee la ventana emergente por ser asíncrono,
    // abrimos la pestaña inmediatamente y luego le inyectamos el PDF.
    let newWindow: Window | null = null;
    if (name.endsWith('.pdf') || name.endsWith('.txt')) {
      newWindow = window.open('about:blank', '_blank');
    }

    const blob = await this.indexedDb.getFileBlob(name);

    if (blob) {
      const url = URL.createObjectURL(blob);
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      
      this.openMessage.set(this.ts.translate('library.opening') + ' ' + name + '...');
      setTimeout(() => this.openMessage.set(''), 3000);
    } else {
      if (newWindow) newWindow.close();
      this.openMessage.set('Error: Archivo no encontrado en la memoria.');
      setTimeout(() => this.openMessage.set(''), 3000);
    }
  }

  deleteFile(fileName: string): void {
    this.courseService.deleteLocalFile(fileName);
    this.deleteMessage.set(this.ts.translate('library.deleted'));
    setTimeout(() => this.deleteMessage.set(''), 3000);
  }

  goToCourses(): void {
    this.router.navigate(['/courses']);
  }

  goToSync(): void {
    this.router.navigate(['/sync-status']);
  }
}
