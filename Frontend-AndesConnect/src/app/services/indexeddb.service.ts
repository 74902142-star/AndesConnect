import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';

export interface SyncAction {
  id?: number;
  action: 'COMPLETE_LESSON' | 'SUBMIT_ASSESSMENT' | 'ENROLL_COURSE';
  data: any;
  timestamp: number;
}

export interface DownloadedFile {
  name: string;
  size: string;
  type: 'pdf' | 'video';
  downloadedAt: number;
  courseId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class IndexedDbService {
  private readonly DB_NAME = 'rural_tech_db';
  private readonly DB_VERSION = 2;
  private dbPromise: Promise<IDBPDatabase> | null = null;

  constructor() {
    this.initDb();
  }

  private initDb(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Store downloaded courses
          if (!db.objectStoreNames.contains('courses')) {
            db.createObjectStore('courses', { keyPath: 'id' });
          }
          // Store user progress locally
          if (!db.objectStoreNames.contains('progress')) {
            db.createObjectStore('progress', { keyPath: 'id' }); // key: courseId + '_' + lessonId
          }
          // Store local downloaded files list
          if (!db.objectStoreNames.contains('downloads')) {
            db.createObjectStore('downloads', { keyPath: 'name' });
          }
          // Store raw file blobs
          if (!db.objectStoreNames.contains('files_data')) {
            db.createObjectStore('files_data');
          }
          // Store actions to sync with server later
          if (!db.objectStoreNames.contains('sync_queue')) {
            db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
          }
          // Store app settings / metadata
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }
        }
      });
    }
    return this.dbPromise;
  }

  // --- GENERAL STORAGE METHODS ---

  async get(storeName: string, key: any): Promise<any> {
    const db = await this.initDb();
    return db.get(storeName, key);
  }

  async getAll(storeName: string): Promise<any[]> {
    const db = await this.initDb();
    return db.getAll(storeName);
  }

  async put(storeName: string, value: any, key?: any): Promise<any> {
    const db = await this.initDb();
    return db.put(storeName, value, key);
  }

  async delete(storeName: string, key: any): Promise<void> {
    const db = await this.initDb();
    return db.delete(storeName, key);
  }

  async clear(storeName: string): Promise<void> {
    const db = await this.initDb();
    return db.clear(storeName);
  }

  // --- DOWNLOADED FILES HELPERS ---

  async getDownloadedFiles(): Promise<DownloadedFile[]> {
    return this.getAll('downloads');
  }

  async saveDownloadedFile(file: DownloadedFile): Promise<void> {
    await this.put('downloads', file);
  }

  async deleteDownloadedFile(name: string): Promise<void> {
    await this.delete('downloads', name);
  }

  // --- SYNC QUEUE HELPERS ---

  async getSyncQueue(): Promise<SyncAction[]> {
    return this.getAll('sync_queue');
  }

  async addSyncAction(action: Omit<SyncAction, 'id'>): Promise<IDBValidKey> {
    const db = await this.initDb();
    return db.add('sync_queue', action);
  }

  async deleteSyncAction(id: number): Promise<void> {
    await this.delete('sync_queue', id);
  }

  // --- RAW BLOBS HELPERS ---

  async getFileBlob(fileName: string): Promise<Blob | undefined> {
    const db = await this.initDb();
    return db.get('files_data', fileName);
  }

  async saveFileBlob(fileName: string, blob: Blob): Promise<void> {
    const db = await this.initDb();
    await db.put('files_data', blob, fileName);
  }

  async deleteFileBlob(fileName: string): Promise<void> {
    const db = await this.initDb();
    await db.delete('files_data', fileName);
  }
}
