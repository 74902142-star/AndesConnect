import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IndexedDbService, SyncAction } from './indexeddb.service';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from './notification.service';
import { CourseService } from './course.service';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private readonly db = inject(IndexedDbService);
  private readonly http = inject(HttpClient);
  private readonly notifService = inject(NotificationService);
  private readonly courseService = inject(CourseService);

  // Red/Conectividad actual
  readonly isOnline = signal<boolean>(navigator.onLine);

  // Estados de sincronización
  readonly isSyncing = signal<boolean>(false);
  readonly syncQueue = signal<SyncAction[]>([]);
  readonly lastSyncTime = signal<string>(localStorage.getItem('rt_last_sync') || 'Nunca');
  
  // Señales de espacio en disco - se actualizan dinámicamente
  readonly usedSpace = signal<number>(0); // en GB
  readonly maxSpace = signal<number>(5.0);  // en GB (configurable)

  constructor() {
    this.initNetworkListeners();
    this.loadQueue();
    this.updateStorageInfo();

    // Sincronizar automáticamente al pasar a estar en línea
    effect(() => {
      if (this.isOnline()) {
        this.syncNow();
      }
    });
  }

  /**
   * Calcula el espacio usado en IndexedDB y actualiza las señales
   */
  private async updateStorageInfo(): Promise<void> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage !== undefined) {
          this.usedSpace.set(Number((estimate.usage / (1024 * 1024 * 1024)).toFixed(2)));
        }
      }
    } catch (e) {
      console.warn('No se pudo estimar el almacenamiento:', e);
      this.usedSpace.set(0);
    }
  }

  private initNetworkListeners(): void {
    window.addEventListener('online', () => this.isOnline.set(true));
    window.addEventListener('offline', () => this.isOnline.set(false));
  }

  /**
   * Lee la cola de acciones pendientes desde IndexedDB
   */
  async loadQueue(): Promise<void> {
    const queue = await this.db.getSyncQueue();
    this.syncQueue.set(queue);
  }

  /**
   * Envía la cola al backend cuando hay conexión a internet
   */
  async syncNow(): Promise<void> {
    if (!this.isOnline() || this.isSyncing() || this.syncQueue().length === 0) {
      return;
    }

    this.isSyncing.set(true);
    const queue = this.syncQueue();

    // Obtener o inicializar el nodo ID
    let nodeId = localStorage.getItem('rt_node');
    if (!nodeId) {
      nodeId = 'RT-SEC-' + Math.floor(1000 + Math.random() * 8999);
      localStorage.setItem('rt_node', nodeId);
    }

    // Mapear las acciones locales al formato requerido por la API de FastAPI
    const acciones = queue.map(item => ({
      accion: item.action,
      payload: item.data
    }));

    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${environment.apiUrl}/sincronizacion/sync`, {
          nodo_id: nodeId,
          almacenamiento_usado_gb: this.usedSpace(),
          almacenamiento_max_gb: this.maxSpace(),
          version_app: '1.0.0',
          acciones
        })
      );

      // Solo limpiar de IndexedDB las acciones que se procesaron con éxito en el servidor
      if (res && res.detalles && res.detalles.length === queue.length) {
        for (let i = 0; i < queue.length; i++) {
          const detail = res.detalles[i];
          const item = queue[i];
          if (detail && detail.estado === 'success' && item.id !== undefined) {
            await this.db.deleteSyncAction(item.id);
          }
        }
      } else if (res && res.procesados > 0) {
        for (const item of queue) {
          if (item.id !== undefined) {
            await this.db.deleteSyncAction(item.id);
          }
        }
      }
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const lastSyncStr = `Hoy a las ${timeStr}`;
      localStorage.setItem('rt_last_sync', lastSyncStr);
      this.lastSyncTime.set(lastSyncStr);
      
      // Recargar datos y notificaciones sincronizados
      await this.courseService.syncCatalogAndInscriptions();
      await this.notifService.loadNotifications();
      await this.courseService.syncLocalDownloadsToServer();
      await this.updateStorageInfo();
      
    } catch (error) {
      console.error('Error durante la sincronización con el servidor:', error);
    } finally {
      this.isSyncing.set(false);
      await this.loadQueue();
    }
  }

  /**
   * Simulación de limpieza de caché local
   */
  async clearCache(): Promise<void> {
    this.isSyncing.set(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.db.clear('courses');
    await this.db.clear('downloads');
    await this.updateStorageInfo();
    this.isSyncing.set(false);
  }
}
