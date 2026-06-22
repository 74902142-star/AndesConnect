import { Injectable, signal, computed, inject } from '@angular/core';
import type { UserProfile, AuthResult } from '../shared/types';
import { createClient, SupabaseClient, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IndexedDbService } from './indexeddb.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly supabase: SupabaseClient;
  private readonly http = inject(HttpClient);
  private readonly db = inject(IndexedDbService);
  private readonly currentUserSignal = signal<UserProfile | null>(this.getStoredUser());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isStudent = computed(() => this.currentUserSignal()?.role === 'student');
  readonly isTeacher = computed(() => this.currentUserSignal()?.role === 'teacher');
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === 'admin');
  readonly isGuest = computed(() => {
    const user = this.currentUserSignal();
    return user ? (user.email === 'invitado@andesconnect.org' || user.email === 'offline@andesconnect.org') : false;
  });

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

    // Escuchar el estado de autenticación de Supabase de manera reactiva
    this.supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (session) {
        const user = session.user;
        const rawRole = user.user_metadata['rol'] || user.user_metadata['role'] || 'estudiante';
        let role: 'student' | 'teacher' | 'admin' = 'student';
        
        if (rawRole === 'docente' || rawRole === 'teacher') {
          role = 'teacher';
        } else if (rawRole === 'administrador' || rawRole === 'admin') {
          role = 'admin';
        }
        
        const profile: UserProfile = {
          name: user.user_metadata['nombre'] || user.user_metadata['full_name'] || 'Usuario',
          email: user.email || '',
          location: user.user_metadata['location'] || user.user_metadata['ubicacion'] || 'Comunidad Rural',
          role: role
        };

        const oldUserJson = localStorage.getItem('rt_user');
        let shouldClear = false;
        if (oldUserJson) {
          try {
            const oldUser = JSON.parse(oldUserJson);
            if (oldUser.email !== profile.email) {
              shouldClear = true;
            }
          } catch {
            shouldClear = true;
          }
        } else {
          shouldClear = true;
        }

        if (shouldClear) {
          localStorage.removeItem('rt_notifications');
          localStorage.removeItem('rt_certificates');
          localStorage.removeItem('rt_last_sync');
          try {
            await this.db.clear('courses');
            await this.db.clear('progress');
            await this.db.clear('downloads');
            await this.db.clear('sync_queue');
            await this.db.clear('settings');
          } catch (e) {
            console.warn('Error clearing IndexedDB:', e);
          }
        }

        localStorage.setItem('rt_token', session.access_token);
        localStorage.setItem('rt_user', JSON.stringify(profile));
        this.currentUserSignal.set(profile);
      } else {
        localStorage.removeItem('rt_token');
        localStorage.removeItem('rt_user');
        localStorage.removeItem('rt_notifications');
        localStorage.removeItem('rt_certificates');
        localStorage.removeItem('rt_last_sync');
        try {
          await this.db.clear('courses');
          await this.db.clear('progress');
          await this.db.clear('downloads');
          await this.db.clear('sync_queue');
          await this.db.clear('settings');
        } catch (e) {
          console.warn('Error clearing IndexedDB:', e);
        }
        this.currentUserSignal.set(null);
      }
    });
  }

  private getStoredUser(): UserProfile | null {
    const userJson = localStorage.getItem('rt_user');
    const token = localStorage.getItem('rt_token');
    if (userJson && token) {
      try {
        return JSON.parse(userJson) as UserProfile;
      } catch {
        return null;
      }
    }
    return null;
  }

  async login(email: string, password: string): Promise<AuthResult> {
    if (!email || !password) {
      return { success: false, error: 'invalid' };
    }

    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { success: false, error: 'not_found' };
    }

    return { success: true };
  }

  async register(name: string, email: string, location: string, role: 'student' | 'teacher', password: string): Promise<AuthResult> {
    if (!name || !email || !role || !password) {
      return { success: false, error: 'invalid' };
    }

    const dbRole = role === 'teacher' ? 'docente' : 'estudiante';

    try {
      // Registrar al usuario a través del backend usando la API de administración
      await firstValueFrom(
        this.http.post<any>(`${environment.apiUrl}/auth/register`, {
          nombre: name,
          email: email,
          location: location,
          rol: dbRole,
          password: password
        })
      );

      // Si el registro en el backend tiene éxito, iniciar sesión automáticamente
      return await this.login(email, password);
    } catch (err: any) {
      console.error('Error de registro:', err);
      return { success: false, error: 'exists' };
    }
  }

  async registerAdmin(name: string, email: string, location: string, password: string, secret: string): Promise<AuthResult> {
    if (!name || !email || !password || !secret) {
      return { success: false, error: 'invalid' };
    }

    try {
      await firstValueFrom(
        this.http.post<any>(`${environment.apiUrl}/auth/register-admin`, {
          nombre: name,
          email: email,
          location: location,
          password: password,
          secreto: secret
        })
      );

      return await this.login(email, password);
    } catch (err: any) {
      console.error('Error al registrar administrador:', err);
      return { success: false, error: 'exists' };
    }
  }

  async loginAsGuest(type: 'home' | 'login'): Promise<AuthResult> {
    const guest = type === 'home'
      ? { name: 'Estudiante Rural (Invitado)', email: 'invitado@andesconnect.org', location: 'Comunidad Andina' }
      : { name: 'Usuario Invitado (Offline)', email: 'offline@andesconnect.org', location: 'Comunidad Local' };

    const mockUser: UserProfile = { name: guest.name, email: guest.email, location: guest.location, role: 'student' };
    
    const guestId = crypto.randomUUID();
    const mockPayload = {
      sub: guestId,
      email: guest.email,
      user_metadata: {
        nombre: guest.name,
        location: guest.location,
        rol: 'estudiante'
      },
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 86400,
      iat: Math.floor(Date.now() / 1000)
    };
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + btoa(JSON.stringify(mockPayload)) + '.guest-mock-signature-' + guestId;

    const oldUserJson = localStorage.getItem('rt_user');
    let shouldClear = false;
    if (oldUserJson) {
      try {
        const oldUser = JSON.parse(oldUserJson);
        if (oldUser.email !== mockUser.email) {
          shouldClear = true;
        }
      } catch {
        shouldClear = true;
      }
    } else {
      shouldClear = true;
    }

    if (shouldClear) {
      localStorage.removeItem('rt_notifications');
      localStorage.removeItem('rt_certificates');
      localStorage.removeItem('rt_last_sync');
      try {
        await this.db.clear('courses');
        await this.db.clear('progress');
        await this.db.clear('downloads');
        await this.db.clear('sync_queue');
        await this.db.clear('settings');
      } catch (e) {
        console.warn('Error clearing IndexedDB:', e);
      }
    }

    localStorage.setItem('rt_user', JSON.stringify(mockUser));
    localStorage.setItem('rt_token', mockToken);

    this.currentUserSignal.set(mockUser);
    return { success: true };
  }

  async updateProfile(name: string, email: string, location: string): Promise<void> {
    const current = this.currentUserSignal();
    if (!current) return;

    const { error } = await this.supabase.auth.updateUser({
      data: {
        nombre: name,
        location: location
      }
    });

    if (!error) {
      const updated: UserProfile = { ...current, name, email, location };
      localStorage.setItem('rt_user', JSON.stringify(updated));
      this.currentUserSignal.set(updated);
    }
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    localStorage.removeItem('rt_user');
    localStorage.removeItem('rt_token');
    localStorage.removeItem('rt_notifications');
    localStorage.removeItem('rt_certificates');
    localStorage.removeItem('rt_last_sync');
    try {
      await this.db.clear('courses');
      await this.db.clear('progress');
      await this.db.clear('downloads');
      await this.db.clear('sync_queue');
      await this.db.clear('settings');
    } catch (e) {
      console.warn('Error clearing IndexedDB:', e);
    }
    this.currentUserSignal.set(null);
  }
}
