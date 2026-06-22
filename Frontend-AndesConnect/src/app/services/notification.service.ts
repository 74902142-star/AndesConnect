import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppNotification } from '../shared/types';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly STORAGE_KEY = 'rt_notifications';

  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCountSignal = signal<number>(0);

  get unreadCount(): number {
    return this.notifications().filter(n => !n.read).length;
  }

  constructor() {
    // Escuchar cambios de autenticación para recargar notificaciones
    effect(async () => {
      if (this.auth.isAuthenticated()) {
        await this.loadNotifications();
      } else {
        this.notifications.set([]);
        this.unreadCountSignal.set(0);
      }
    });
  }

  /**
   * Carga las notificaciones desde el backend
   */
  async loadNotifications(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      return;
    }

    if (this.auth.isGuest()) {
      const cached = this.loadFromStorage();
      if (cached.length > 0) {
        this.notifications.set(cached);
      } else {
        this.addSampleNotifications();
      }
      this.refreshUnread();
      return;
    }

    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/notificaciones/`)
      );

      const mapped: AppNotification[] = data.map(n => ({
        id: n.id,
        type: n.tipo as any,
        title: n.titulo,
        message: n.mensaje,
        timestamp: new Date(n.creado_en).getTime(),
        read: n.leido,
        actionRoute: n.ruta_accion || undefined
      }));

      this.notifications.set(mapped);
      this.refreshUnread();
    } catch (e) {
      console.warn('No se pudo cargar notificaciones de la API. Usando caché local.', e);
      // Fallback a localStorage
      const cached = this.loadFromStorage();
      if (cached.length > 0) {
        this.notifications.set(cached);
      } else {
        this.addSampleNotifications();
      }
      this.refreshUnread();
    }
  }

  private addSampleNotifications(): void {
    const samples: AppNotification[] = [
      {
        id: 'n1',
        type: 'new_course',
        title: 'Nuevo Curso Disponible',
        message: 'Certificación Orgánica ya disponible para inscripción.',
        timestamp: Date.now() - 3600000,
        read: false,
        actionRoute: '/courses/certificacion'
      },
      {
        id: 'n2',
        type: 'download_ready',
        title: 'Descarga Completada',
        message: 'Manual de Riego V2 listo para uso offline.',
        timestamp: Date.now() - 7200000,
        read: false,
        actionRoute: '/library'
      }
    ];
    this.notifications.set(samples);
    this.saveToStorage();
    this.refreshUnread();
  }

  async add(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    const newNotif: AppNotification = {
      ...notification,
      id: `n_${Date.now()}`,
      timestamp: Date.now(),
      read: false
    };
    this.notifications.update(list => [newNotif, ...list]);
    this.saveToStorage();
    this.refreshUnread();
  }

  async markAsRead(id: string): Promise<void> {
    // Si no es un ID ficticio local ni es un invitado, actualizar en backend
    if (!id.startsWith('n_') && this.auth.isAuthenticated() && navigator.onLine && !this.auth.isGuest()) {
      try {
        await firstValueFrom(
          this.http.put(`${environment.apiUrl}/notificaciones/${id}/leer`, {})
        );
      } catch (e) {
        console.warn('Error al marcar leída en el servidor:', e);
      }
    }

    this.notifications.update(list =>
      list.map(n => n.id === id ? { ...n, read: true } : n)
    );
    this.saveToStorage();
    this.refreshUnread();
  }

  async markAllRead(): Promise<void> {
    const unread = this.notifications().filter(n => !n.read);
    
    // Ejecutar llamadas HTTP en paralelo para mayor velocidad
    const promises = unread.map(n => {
      if (!n.id.startsWith('n_') && this.auth.isAuthenticated() && navigator.onLine && !this.auth.isGuest()) {
        return firstValueFrom(this.http.put(`${environment.apiUrl}/notificaciones/${n.id}/leer`, {})).catch(e => console.warn('Error:', e));
      }
      return Promise.resolve();
    });
    
    await Promise.all(promises);

    // Actualización de estado en bloque
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
    this.saveToStorage();
    this.refreshUnread();
  }

  async deleteNotification(id: string): Promise<void> {
    if (!id.startsWith('n_') && this.auth.isAuthenticated() && navigator.onLine && !this.auth.isGuest()) {
      try {
        await firstValueFrom(
          this.http.delete(`${environment.apiUrl}/notificaciones/${id}`)
        );
      } catch (e) {
        console.warn('Error al eliminar notificación en el servidor:', e);
      }
    }

    this.notifications.update(list => list.filter(n => n.id !== id));
    this.saveToStorage();
    this.refreshUnread();
  }

  async clearAll(): Promise<void> {
    const notifs = [...this.notifications()];
    
    // Ejecutar eliminaciones HTTP en paralelo
    const promises = notifs.map(n => {
      if (!n.id.startsWith('n_') && this.auth.isAuthenticated() && navigator.onLine && !this.auth.isGuest()) {
        return firstValueFrom(this.http.delete(`${environment.apiUrl}/notificaciones/${n.id}`)).catch(e => console.warn('Error:', e));
      }
      return Promise.resolve();
    });

    await Promise.all(promises);

    // Limpiar estado en bloque instantáneamente
    this.notifications.set([]);
    this.saveToStorage();
    this.refreshUnread();
  }

  private refreshUnread(): void {
    this.unreadCountSignal.set(this.notifications().filter(n => !n.read).length);
  }

  private loadFromStorage(): AppNotification[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as AppNotification[];
    } catch {
      return [];
    }
  }

  private saveToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.notifications()));
  }

  formatTime(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Ahora mismo';
    if (mins < 60) return `Hace ${mins} min`;
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${days}d`;
  }
}
