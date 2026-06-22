import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IndexedDbService, DownloadedFile } from './indexeddb.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { CourseModule, Certificate, CatalogCourse } from '../shared/types';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  progress: number;
  downloaded: boolean;
  image: string;
  theme: 'yellow' | 'blue' | 'red' | 'grey';
  enrolled: boolean;
}

export interface ActiveDownload {
  id: string;
  title: string;
  progress: number;
  sizeDownloaded: string;
  sizeTotal: string;
  badge: string;
}

@Injectable({
  providedIn: 'root'
})
export class CourseService {
  private readonly db = inject(IndexedDbService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly notifService = inject(NotificationService);

  readonly courses = signal<Course[]>([]);
  readonly downloadsInProgress = signal<ActiveDownload[]>([]);
  readonly downloadedFiles = signal<DownloadedFile[]>([]);
  readonly certificates = signal<Certificate[]>([]);
  readonly catalogLoading = signal<boolean>(false);
  readonly catalogLoaded = signal<boolean>(false);

  // Cache local en memoria para los módulos cargados
  private readonly modulesCache = new Map<string, CourseModule[]>();

  // Catálogo inicial de respaldo (si la API falla o estamos offline)
  catalogCourses: CatalogCourse[] = [
    {
      id: 'drones',
      title: 'INTRODUCCIÓN A DRONES AGRÍCOLAS',
      description: 'Aprende a utilizar drones para monitoreo de cultivos, mapeo de terrenos y aplicación precisa de insumos.',
      category: 'technology',
      duration: '24h',
      modules: 6,
      level: 'courses.intermediate',
      instructor: 'Ing. David Condori',
      image: 'drones',
      color: '#1e3a5f',
      available: true
    },
    {
      id: 'riego',
      title: 'SISTEMAS DE RIEGO IOT',
      description: 'Diseña e implementa sistemas de riego inteligente con sensores IoT para optimizar el uso del agua.',
      category: 'technology',
      duration: '18h',
      modules: 4,
      level: 'courses.intermediate',
      instructor: 'María Quispe T.',
      image: 'riego',
      color: '#4f46e5',
      available: true
    },
    {
      id: 'suelos',
      title: 'ANÁLISIS DE SUELOS CON IA',
      description: 'Utiliza inteligencia artificial para clasificar nutrientes del suelo y recomendar cultivos óptimos.',
      category: 'technology',
      duration: '30h',
      modules: 8,
      level: 'courses.advanced',
      instructor: 'Dr. Hugo Mamani',
      image: 'suelos',
      color: '#7a1a1a',
      available: true
    },
    {
      id: 'emprendimiento',
      title: 'EMPRENDIMIENTO RURAL',
      description: 'Estrategias comerciales, finanzas básicas y creación de cooperativas para potenciar la economía local.',
      category: 'business',
      duration: '20h',
      modules: 5,
      level: 'courses.beginner',
      instructor: 'Lic. Elena Vargas',
      image: 'business',
      color: '#d4d0c9',
      available: true
    },
    {
      id: 'agroecologia',
      title: 'AGROECOLOGÍA SOSTENIBLE',
      description: 'Prácticas agrícolas sostenibles, conservación de suelos y biodiversidad para comunidades rurales.',
      category: 'agriculture',
      duration: '16h',
      modules: 4,
      level: 'courses.beginner',
      instructor: 'Téc. Juan Pérez',
      image: 'agro',
      color: '#16a34a',
      available: true
    },
    {
      id: 'certificacion',
      title: 'CERTIFICACIÓN ORGÁNICA',
      description: 'Procesos y normativas para obtener certificación orgánica de tus productos agrícolas.',
      category: 'agriculture',
      duration: '12h',
      modules: 3,
      level: 'courses.intermediate',
      instructor: 'Ing. Rosa Sarmiento',
      image: 'cert',
      color: '#8a7a00',
      available: false
    }
  ];

  // Datos mock para fallback de módulos
  private readonly fallbackModules: Record<string, CourseModule[]> = {
    drones: [
      { id: 'drones_m1', courseId: 'drones', order: 1, title: 'Introducción a la Tecnología de Drones', description: 'Historia, tipos de drones y regulaciones vigentes en el sector agrícola.', duration: '3h', type: 'video', completed: false, locked: false },
      { id: 'drones_m2', courseId: 'drones', order: 2, title: 'Sensores Multiespectrales', description: 'Funcionamiento y calibración de sensores NDVI para análisis de cultivos.', duration: '4h', type: 'video', completed: false, locked: true },
      { id: 'drones_m3', courseId: 'drones', order: 3, title: 'Planificación de Vuelo', description: 'Software de planificación, waypoints y cobertura de terrenos.', duration: '4h', type: 'pdf', completed: false, locked: true },
      { id: 'drones_m4', courseId: 'drones', order: 4, title: 'Análisis de Imágenes', description: 'Procesamiento de imágenes aéreas con herramientas de IA.', duration: '5h', type: 'video', completed: false, locked: true },
      { id: 'drones_m5', courseId: 'drones', order: 5, title: 'Aplicación de Insumos', description: 'Drones para pulverización de fertilizantes y pesticidas de forma precisa.', duration: '4h', type: 'pdf', completed: false, locked: true },
      { id: 'drones_m6', courseId: 'drones', order: 6, title: 'Evaluación Final', description: 'Proyecto integrador y evaluación para certificación.', duration: '4h', type: 'quiz', completed: false, locked: true }
    ],
    riego: [
      { id: 'riego_m1', courseId: 'riego', order: 1, title: 'Sensores de Humedad del Suelo', description: 'Tipos de sensores capacitivos y de tensión para monitoreo de humedad.', duration: '4h', type: 'video', completed: false, locked: false },
      { id: 'riego_m2', courseId: 'riego', order: 2, title: 'Conectividad IoT Rural', description: 'Protocolos LoRa, Zigbee y WiFi para zonas con baja conectividad.', duration: '5h', type: 'video', completed: false, locked: true },
      { id: 'riego_m3', courseId: 'riego', order: 3, title: 'Programación de Controladores', description: 'Arduino y Raspberry Pi para automatizar sistemas de riego.', duration: '5h', type: 'pdf', completed: false, locked: true },
      { id: 'riego_m4', courseId: 'riego', order: 4, title: 'Evaluación y Certificación', description: 'Diseño de sistema IoT completo y evaluación final.', duration: '4h', type: 'quiz', completed: false, locked: true }
    ],
    suelos: [
      { id: 'suelos_m1', courseId: 'suelos', order: 1, title: 'Composición Química del Suelo', description: 'Análisis de macronutrientes, pH y conductividad eléctrica.', duration: '4h', type: 'video', completed: false, locked: false },
      { id: 'suelos_m2', courseId: 'suelos', order: 2, title: 'Técnicas de Muestreo', description: 'Métodos de toma de muestras representativas para análisis de laboratorio.', duration: '3h', type: 'video', completed: false, locked: true },
      { id: 'suelos_m3', courseId: 'suelos', order: 3, title: 'Clasificación de Nutrientes con IA', description: 'Modelos de ML para clasificar deficiencias y recomendar enmiendas.', duration: '5h', type: 'pdf', completed: false, locked: true },
      { id: 'suelos_m4', courseId: 'suelos', order: 4, title: 'Interpretación de Resultados', description: 'Cómo leer informes de análisis y tomar decisiones agronómicas.', duration: '4h', type: 'video', completed: false, locked: true },
      { id: 'suelos_m5', courseId: 'suelos', order: 5, title: 'Planes de Fertilización', description: 'Diseño de planes de fertilización basados en análisis de suelo.', duration: '5h', type: 'pdf', completed: false, locked: true },
      { id: 'suelos_m6', courseId: 'suelos', order: 6, title: 'Herramientas Digitales', description: 'Plataformas online y apps para análisis y seguimiento de suelos.', duration: '4h', type: 'video', completed: false, locked: true },
      { id: 'suelos_m7', courseId: 'suelos', order: 7, title: 'Conservación de Suelos', description: 'Prácticas de labranza de conservación y cubiertas vegetales.', duration: '3h', type: 'pdf', completed: false, locked: true },
      { id: 'suelos_m8', courseId: 'suelos', order: 8, title: 'Evaluación Final', description: 'Proyecto de análisis integral y obtención de certificado.', duration: '2h', type: 'quiz', completed: false, locked: true }
    ]
  };

  constructor() {
    this.loadDownloadedFiles();
    this.loadCertificates();

    // Reaccionar ante cambios de sesión
    effect(async () => {
      if (this.auth.isAuthenticated()) {
        await this.syncCatalogAndInscriptions();
        await this.syncCertificates();
      } else {
        this.courses.set([]);
      }
    });
  }

  /**
   * Carga el catálogo completo desde la API
   */
  async loadCatalog(): Promise<void> {
    this.catalogLoading.set(true);
    if (this.auth.isGuest()) {
      this.catalogLoaded.set(true);
      this.catalogLoading.set(false);
      return;
    }
    try {
      const apiCourses = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/cursos/`)
      );
      if (apiCourses && apiCourses.length > 0) {
        this.catalogCourses = apiCourses.map(c => ({
          id: c.id,
          title: c.titulo || c.title || '',
          description: c.descripcion || c.description || '',
          category: c.categoria || c.category || '',
          duration: c.duracion || c.duration || '',
          modules: c.modulos !== undefined ? c.modulos : (c.modules !== undefined ? c.modules : 0),
          level: c.nivel || c.level || '',
          instructor: c.instructor || '',
          image: c.imagen || c.image || '',
          color: c.color || '#16a34a',
          available: c.disponible !== undefined ? c.disponible : (c.available !== undefined ? c.available : true)
        }));
      }
      this.catalogLoaded.set(true);
    } catch (e) {
      console.warn('No se pudo cargar el catálogo desde la API. Usando respaldo local.', e);
      this.catalogLoaded.set(true);
    } finally {
      this.catalogLoading.set(false);
    }
  }

  /**
   * Sincroniza el catálogo general y las inscripciones del usuario actual
   */
  async syncCatalogAndInscriptions(): Promise<void> {
    if (this.auth.isGuest()) {
      const cached = await this.db.getAll('courses');
      if (cached && cached.length > 0) {
        this.courses.set(cached);
      } else {
        const defaultCourses: Course[] = this.catalogCourses.slice(0, 3).map((c, index) => {
          const themes: ('yellow' | 'blue' | 'red' | 'grey')[] = ['blue', 'red', 'yellow'];
          return {
            id: c.id,
            title: c.title,
            subtitle: `${c.modules} módulos • ${c.duration}`,
            progress: 0,
            downloaded: false,
            image: c.image + '.jpg',
            theme: themes[index % themes.length],
            enrolled: true
          };
        });
        this.courses.set(defaultCourses);
        for (const c of defaultCourses) {
          await this.db.put('courses', c);
        }
      }
      return;
    }

    // 1. Cargar catálogo
    await this.loadCatalog();

    try {
      // 2. Cargar inscripciones del usuario actual con datos del curso
      const activeInscriptions = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/inscripciones/mis-cursos/detalle`)
      );

      const mapped: Course[] = activeInscriptions.map(ins => {
        // Usar datos del curso del backend si están disponibles
        const cursoData = ins.curso;
        const cat = cursoData ? {
          title: cursoData.titulo,
          modules: cursoData.modulos,
          duration: cursoData.duracion,
          image: cursoData.imagen
        } : this.getCatalogCourse(ins.curso_id);

        return {
          id: ins.curso_id,
          title: (cursoData?.titulo || (cat as any)?.title) ?? ins.curso_id.toUpperCase(),
          subtitle: cat ? `${(cat as any).modules || cat.modules} módulos • ${(cat as any).duration || cat.duration}` : 'En curso',
          progress: ins.progreso,
          downloaded: ins.descargado,
          image: ((cursoData?.imagen || (cat as any)?.image) ?? 'agro') + '.jpg',
          theme: ins.tema_ui as any,
          enrolled: true
        };
      });

      // Obtener cursos inscritos localmente que están pendientes de sincronizar en la cola
      const queue = await this.db.getSyncQueue();
      const pendingEnrolls = queue.filter(item => item.action === 'ENROLL_COURSE');
      
      for (const p of pendingEnrolls) {
        const courseId = p.data.courseId;
        if (!mapped.some(c => c.id === courseId)) {
          const localCourse = await this.db.get('courses', courseId);
          if (localCourse) {
            mapped.push(localCourse);
          }
        }
      }

      this.courses.set(mapped);
      // Limpiar y guardar localmente en IndexedDB para persistencia offline
      await this.db.clear('courses');
      for (const c of mapped) {
        await this.db.put('courses', c);
      }

      // 3. Sincronizar el progreso detallado de módulos
      try {
        const progressList = await firstValueFrom(
          this.http.get<any[]>(`${environment.apiUrl}/inscripciones/progreso-lecciones`)
        );
        if (progressList && progressList.length > 0) {
          for (const item of progressList) {
            const key = `${item.courseId}_${item.moduleId}`;
            await this.db.put('progress', {
              id: key,
              courseId: item.courseId,
              moduleId: item.moduleId,
              completed: item.completed,
              score: item.score ?? 100,
              timestamp: item.completedAt ? new Date(item.completedAt).getTime() : Date.now()
            });
          }
        }
      } catch (err) {
        console.warn('No se pudo sincronizar el progreso detallado de lecciones desde la API.', err);
      }
    } catch (e) {
      console.warn('No se pudo cargar las inscripciones desde la API. Cargando desde caché offline.', e);
      // Fallback a IndexedDB local si está desconectado
      const cached = await this.db.getAll('courses');
      if (cached && cached.length > 0) {
        this.courses.set(cached);
      }
    }
  }

  getCatalogCourse(id: string): CatalogCourse | undefined {
    return this.catalogCourses.find(c => c.id === id);
  }

  /**
   * Obtiene los cursos del catálogo en los que el usuario NO está inscrito
   */
  getAvailableCoursesForEnrollment(): CatalogCourse[] {
    const enrolledIds = new Set(this.courses().map(c => c.id));
    return this.catalogCourses.filter(c => c.available && !enrolledIds.has(c.id));
  }

  /**
   * Obtiene la lista de módulos de un curso cargándola asíncronamente si es posible
   */
  async loadCourseModules(courseId: string): Promise<CourseModule[]> {
    let modules: CourseModule[] = [];

    if (navigator.onLine && !this.auth.isGuest()) {
      try {
        const detail = await firstValueFrom(
          this.http.get<any>(`${environment.apiUrl}/cursos/${courseId}`)
        );

        if (detail && detail.modulo_list) {
          modules = detail.modulo_list.map((m: any) => ({
            id: m.id,
            courseId: m.curso_id,
            order: m.orden,
            title: m.titulo,
            description: m.descripcion || m.titulo,
            duration: m.duracion_minutos ? `${m.duracion_minutos} min` : '10 min',
            type: (m.tipo_contenido || 'video').toLowerCase() as any,
            completed: false,
            locked: false,
            contentUrl: m.contenido_url || undefined
          }));
        }
      } catch (e) {
        console.warn('Error al cargar módulos de API, intentando fallback.', e);
      }
    }

    // Si falló la API o estamos offline, usar fallback local
    if (modules.length === 0) {
      modules = this.fallbackModules[courseId] || [];
    }

    // Mezclar con el estado de completados local
    const progressKeys = await this.db.getAll('progress');
    const completedIds = new Set(
      progressKeys
        .filter((p: any) => p.courseId === courseId && p.completed)
        .map((p: any) => p.moduleId)
    );

    // Actualizar estados completados y bloqueados
    modules = modules.map((m, idx) => {
      const completed = completedIds.has(m.id);
      return {
        ...m,
        completed,
        locked: idx === 0 ? false : !modules[idx - 1].completed && !completedIds.has(modules[idx - 1].id)
      };
    });

    this.modulesCache.set(courseId, modules);
    return modules;
  }

  getModules(courseId: string): CourseModule[] {
    // Retorna desde caché en memoria de manera síncrona
    return this.modulesCache.get(courseId) || this.fallbackModules[courseId] || [];
  }

  getCurrentModule(courseId: string): CourseModule | undefined {
    const modules = this.getModules(courseId);
    return modules.find(m => !m.completed && !m.locked) || modules.find(m => !m.completed) || modules[0];
  }

  /**
   * Completa un módulo de manera local y en el backend
   */
  async completeModule(courseId: string, moduleId: string): Promise<void> {
    const key = `${courseId}_${moduleId}`;
    
    // Guardar progreso local en IndexedDB inmediatamente
    await this.db.put('progress', {
      id: key,
      courseId,
      moduleId,
      completed: true,
      timestamp: Date.now()
    });

    // Actualizar caché local
    const modules = this.getModules(courseId);
    const idx = modules.findIndex(m => m.id === moduleId);
    if (idx !== -1) {
      modules[idx] = { ...modules[idx], completed: true };
      if (idx + 1 < modules.length) {
        modules[idx + 1] = { ...modules[idx + 1], locked: false };
      }
      this.modulesCache.set(courseId, modules);
    }

    // Calcular nuevo progreso en porcentaje
    const done = modules.filter(m => m.completed).length;
    const progress = Math.round((done / modules.length) * 100);

    this.courses.update(list => list.map(c =>
      c.id === courseId ? { ...c, progress } : c
    ));

    // Si está conectado y no es invitado, enviar al backend. Si no, encolar acción para sincronizar si no es invitado.
    if (navigator.onLine && this.auth.isAuthenticated() && !this.auth.isGuest()) {
      try {
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/inscripciones/progreso-leccion`, {
            modulo_id: moduleId,
            completado: true,
            puntaje_evaluacion: 100
          }, {
            params: {
              curso_id: courseId
            }
          })
        );
        await this.notifService.loadNotifications();
      } catch (e) {
        console.warn('No se pudo enviar progreso en vivo. Encolando acción de sincronización.', e);
        await this.db.addSyncAction({
          action: 'COMPLETE_LESSON',
          data: { courseId, moduleId },
          timestamp: Date.now()
        });
      }
    } else if (!this.auth.isGuest()) {
      await this.db.addSyncAction({
        action: 'COMPLETE_LESSON',
        data: { courseId, moduleId },
        timestamp: Date.now()
      });
    }

    if (progress === 100) {
      this.issueCertificate(courseId);
    }
  }

  /**
   * Envía el resultado de una evaluación (quiz) localmente y al servidor
   */
  async submitAssessment(courseId: string, moduleId: string, score: number): Promise<void> {
    const key = `${courseId}_${moduleId}`;
    
    // Guardar progreso local en IndexedDB inmediatamente
    await this.db.put('progress', {
      id: key,
      courseId,
      moduleId,
      completed: score >= 70,
      score,
      timestamp: Date.now()
    });

    // Actualizar caché local
    const modules = this.getModules(courseId);
    const idx = modules.findIndex(m => m.id === moduleId);
    if (idx !== -1 && score >= 70) {
      modules[idx] = { ...modules[idx], completed: true };
      if (idx + 1 < modules.length) {
        modules[idx + 1] = { ...modules[idx + 1], locked: false };
      }
      this.modulesCache.set(courseId, modules);
    }

    // Calcular nuevo progreso en porcentaje
    const done = modules.filter(m => m.completed).length;
    const progress = Math.round((done / modules.length) * 100);

    this.courses.update(list => list.map(c =>
      c.id === courseId ? { ...c, progress } : c
    ));

    // Si está conectado y no es invitado, enviar al backend. Si no, encolar acción de sincronización si no es invitado.
    if (navigator.onLine && this.auth.isAuthenticated() && !this.auth.isGuest()) {
      try {
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/inscripciones/progreso-leccion`, {
            modulo_id: moduleId,
            completado: score >= 70,
            puntaje_evaluacion: score
          }, {
            params: {
              curso_id: courseId
            }
          })
        );
        await this.notifService.loadNotifications();
      } catch (e) {
        console.warn('No se pudo enviar progreso de evaluación en vivo. Encolando acción de sincronización.', e);
        await this.db.addSyncAction({
          action: 'SUBMIT_ASSESSMENT',
          data: { courseId, moduleId, score },
          timestamp: Date.now()
        });
      }
    } else if (!this.auth.isGuest()) {
      await this.db.addSyncAction({
        action: 'SUBMIT_ASSESSMENT',
        data: { courseId, moduleId, score },
        timestamp: Date.now()
      });
    }

    if (progress === 100 && score >= 70) {
      this.issueCertificate(courseId);
    }
  }

  /**
   * Inscribe a un usuario en un curso
   */
  async enrollCourse(courseId: string): Promise<void> {
    const catalog = this.getCatalogCourse(courseId);
    if (!catalog) return;

    const themeMap: Record<string, 'yellow' | 'blue' | 'red' | 'grey'> = {
      technology: 'blue',
      agriculture: 'red',
      business: 'grey'
    };
    const theme = themeMap[catalog.category] || 'yellow';

    const newCourse: Course = {
      id: catalog.id,
      title: catalog.title,
      subtitle: `${catalog.modules} módulos • ${catalog.duration}`,
      progress: 0,
      downloaded: false,
      image: catalog.image + '.jpg',
      theme,
      enrolled: true
    };

    // Agregar localmente
    this.courses.update(list => [...list, newCourse]);
    await this.db.put('courses', newCourse);

    // Enviar a la API o encolar acción para sincronizar si no es invitado
    if (navigator.onLine && this.auth.isAuthenticated() && !this.auth.isGuest()) {
      try {
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/inscripciones/inscribir`, {
            curso_id: courseId,
            tema_ui: theme
          })
        );
      } catch (e) {
        console.warn('Error al inscribir en la API, se encola la acción de sincronización.', e);
        await this.db.addSyncAction({
          action: 'ENROLL_COURSE',
          data: { courseId, theme },
          timestamp: Date.now()
        });
      }
    } else if (this.auth.isAuthenticated() && !this.auth.isGuest()) {
      await this.db.addSyncAction({
        action: 'ENROLL_COURSE',
        data: { courseId, theme },
        timestamp: Date.now()
      });
    }
  }

  /**
   * Desinscribe a un usuario de un curso
   */
  async unenrollCourse(courseId: string): Promise<void> {
    // Quitar localmente
    this.courses.update(list => list.filter(c => c.id !== courseId));
    await this.db.delete('courses', courseId);

    // Enviar a la API
    if (navigator.onLine && this.auth.isAuthenticated() && !this.auth.isGuest()) {
      try {
        await firstValueFrom(
          this.http.delete(`${environment.apiUrl}/inscripciones/desinscribir/${courseId}`)
        );
      } catch (e) {
        console.warn('Error al desinscribir de la API.', e);
      }
    }
  }

  isCourseEnrolled(courseId: string): boolean {
    return this.courses().some(c => c.id === courseId);
  }

  async startCourseDownload(courseId: string, title: string, totalSize: string): Promise<void> {
    const active = this.downloadsInProgress().find(d => d.id === courseId);
    if (active) return;

    const newDownload: ActiveDownload = {
      id: courseId,
      title: title.toUpperCase(),
      progress: 0,
      sizeDownloaded: '0MB',
      sizeTotal: totalSize,
      badge: 'DESCARGA'
    };

    this.downloadsInProgress.update(list => [...list, newDownload]);

    try {
      const modules = await this.loadCourseModules(courseId);
      // Solo descargar si tiene URL y comienza con http (ignoramos JSONs de quizzes)
      const modulesWithUrl = modules.filter(m => m.contentUrl && m.contentUrl.startsWith('http'));
      
      let progressStep = 0;

      if (modulesWithUrl.length > 0) {
        for (const mod of modulesWithUrl) {
          if (!mod.contentUrl) continue;

          progressStep += (90 / modulesWithUrl.length);
          this.downloadsInProgress.update(list => list.map(item => 
             item.id === courseId ? { ...item, progress: progressStep } : item
          ));

          try {
             const blob = await firstValueFrom(this.http.get(mod.contentUrl, { responseType: 'blob' }));
             const fileExtension = mod.contentUrl.split('.').pop() || 'pdf';
             const cleanTitle = mod.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
             const fileName = `${cleanTitle}_${courseId}.${fileExtension}`;
             
             await this.db.saveFileBlob(fileName, blob);
             
             const mbSize = (blob.size / (1024 * 1024)).toFixed(2);
             const newFile: DownloadedFile = {
               name: fileName,
               size: mbSize + 'MB',
               type: 'pdf',
               downloadedAt: Date.now(),
               courseId: courseId
             };
             await this.db.saveDownloadedFile(newFile);
             
             if (navigator.onLine && this.auth.isAuthenticated() && !this.auth.isGuest()) {
               try {
                 await firstValueFrom(
                   this.http.post(`${environment.apiUrl}/archivos-descargados/`, {
                     curso_id: courseId,
                     nombre_archivo: fileName,
                     tamano: newFile.size,
                     tipo: 'pdf'
                   })
                 );
               } catch (e) {}
             }
          } catch(e) {
             console.error('Error descargando archivo:', mod.contentUrl, e);
          }
        }
      } else {
        const mockBlob = new Blob(['No hay archivos reales en este curso.'], { type: 'text/plain' });
        const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_Offline.txt`;
        await this.db.saveFileBlob(fileName, mockBlob);
        
        const newFile: DownloadedFile = {
           name: fileName,
           size: '0.01MB',
           type: 'pdf',
           downloadedAt: Date.now(),
           courseId: courseId
        };
        await this.db.saveDownloadedFile(newFile);
      }

      this.downloadsInProgress.update(list => list.map(item => 
         item.id === courseId ? { ...item, progress: 100 } : item
      ));

      setTimeout(() => this.completeDownloadState(courseId, title), 500);

    } catch (e) {
       console.error(e);
       this.downloadsInProgress.update(list => list.filter(item => item.id !== courseId));
    }
  }

  private async completeDownloadState(courseId: string, title: string): Promise<void> {
    this.downloadsInProgress.update(list => list.filter(item => item.id !== courseId));
    
    this.courses.update(list => list.map(course => {
      if (course.id === courseId) {
        const updated = { ...course, downloaded: true };
        this.db.put('courses', updated);
        return updated;
      }
      return course;
    }));

    if (navigator.onLine && this.auth.isAuthenticated() && !this.auth.isGuest()) {
      try {
        await firstValueFrom(
          this.http.put(`${environment.apiUrl}/inscripciones/descargado/${courseId}`, {}, {
            params: { descargado: true }
          })
        );
      } catch (e) {
        console.warn('Error al marcar curso como descargado en el servidor:', e);
      }
    }

    await this.loadDownloadedFiles();
  }

  async deleteLocalFile(fileName: string): Promise<void> {
    const file = this.downloadedFiles().find(f => f.name === fileName);
    const courseId = file?.courseId;

    await this.db.deleteDownloadedFile(fileName);
    await this.db.deleteFileBlob(fileName);

    if (navigator.onLine && this.auth.isAuthenticated() && !this.auth.isGuest()) {
      try {
        await firstValueFrom(
          this.http.delete(`${environment.apiUrl}/archivos-descargados/${fileName}`)
        );
      } catch (e) {
        console.warn('Error al eliminar descarga en el servidor:', e);
      }
    }

    if (courseId) {
      const remaining = await this.db.getDownloadedFiles();
      const hasMore = remaining.some(f => f.courseId === courseId);
      if (!hasMore) {
        this.courses.update(list => list.map(c => {
          if (c.id === courseId) {
            const updated = { ...c, downloaded: false };
            this.db.put('courses', updated);
            
            if (navigator.onLine && this.auth.isAuthenticated() && !this.auth.isGuest()) {
              firstValueFrom(
                this.http.put(`${environment.apiUrl}/inscripciones/descargado/${courseId}`, {}, {
                  params: { descargado: false }
                })
              ).catch(err => console.warn(err));
            }
            return updated;
          }
          return c;
        }));
      }
    }

    await this.loadDownloadedFiles();
  }

  async loadDownloadedFiles(): Promise<void> {
    if (navigator.onLine && this.auth.isAuthenticated() && !this.auth.isGuest()) {
      try {
        const serverFiles = await firstValueFrom(
          this.http.get<any[]>(`${environment.apiUrl}/archivos-descargados/`)
        );
        if (serverFiles) {
          for (const f of serverFiles) {
            const localFile: DownloadedFile = {
              name: f.nombre_archivo,
              size: f.tamano,
              type: f.tipo,
              downloadedAt: new Date(f.descargado_en).getTime(),
              courseId: f.curso_id
            };
            await this.db.saveDownloadedFile(localFile);
          }
        }
      } catch (e) {
        console.warn('Error al obtener descargas del servidor:', e);
      }
    }

    let files = await this.db.getDownloadedFiles();
    this.downloadedFiles.set(files);
  }

  async syncLocalDownloadsToServer(): Promise<void> {
    if (!navigator.onLine || !this.auth.isAuthenticated() || this.auth.isGuest()) {
      return;
    }
    try {
      const localFiles = await this.db.getDownloadedFiles();
      const localCourses = await this.db.getAll('courses');
      
      const serverFiles = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/archivos-descargados/`)
      );
      const serverFileNames = new Set(serverFiles.map(f => f.nombre_archivo));

      for (const file of localFiles) {
        if (!serverFileNames.has(file.name)) {
          const courseId = file.courseId || 'drones';
          try {
            await firstValueFrom(
              this.http.post(`${environment.apiUrl}/archivos-descargados/`, {
                curso_id: courseId,
                nombre_archivo: file.name,
                tamano: file.size,
                tipo: file.type
              })
            );
          } catch (err) {
            console.warn(`Error al subir archivo descargado ${file.name} al servidor:`, err);
          }
        }
      }

      const downloadedCourses = localCourses.filter(c => c.downloaded);
      for (const c of downloadedCourses) {
        try {
          await firstValueFrom(
            this.http.put(`${environment.apiUrl}/inscripciones/descargado/${c.id}`, {}, {
              params: { descargado: true }
            })
          );
        } catch (err) {
          console.warn(`Error al actualizar estado de descarga del curso ${c.id} en el servidor:`, err);
        }
      }
      
      // Volver a cargar descargas actualizadas
      const updatedServerFiles = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/archivos-descargados/`)
      );
      if (updatedServerFiles) {
        for (const f of updatedServerFiles) {
          const localFile: DownloadedFile = {
            name: f.nombre_archivo,
            size: f.tamano,
            type: f.tipo,
            downloadedAt: new Date(f.descargado_en).getTime(),
            courseId: f.curso_id
          };
          await this.db.saveDownloadedFile(localFile);
        }
      }
    } catch (e) {
      console.warn('Error durante la sincronización de descargas con el servidor:', e);
    }
  }

  private issueCertificate(courseId: string): void {
    const catalog = this.getCatalogCourse(courseId);
    if (!catalog) return;
    const alreadyIssued = this.certificates().some(c => c.courseId === courseId);
    if (alreadyIssued) return;
    const cert: Certificate = {
      id: `cert_${courseId}_${Date.now()}`,
      courseId,
      courseTitle: catalog.title,
      studentName: localStorage.getItem('rt_user')
        ? JSON.parse(localStorage.getItem('rt_user')!).name : 'Estudiante',
      issuedAt: Date.now(),
      instructor: catalog.instructor,
      category: catalog.category
    };
    this.certificates.update(list => [...list, cert]);
    this.saveCertificates();
  }

  private saveCertificates(): void {
    const certs = this.certificates();
    localStorage.setItem('rt_certificates', JSON.stringify(certs));
  }

  loadCertificates(): void {
    const stored = localStorage.getItem('rt_certificates');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Certificate[];
        this.certificates.set(parsed);
      } catch { /* ignore */ }
    }
  }

  async syncCertificates(): Promise<void> {
    if (this.auth.isGuest()) {
      this.loadCertificates();
      return;
    }

    if (navigator.onLine && this.auth.isAuthenticated()) {
      try {
        const backendCerts = await firstValueFrom(
          this.http.get<any[]>(`${environment.apiUrl}/certificados/`)
        );
        const mapped: Certificate[] = backendCerts.map(c => {
          const catalog = this.getCatalogCourse(c.curso_id);
          return {
            id: c.codigo_certificado,
            courseId: c.curso_id,
            courseTitle: catalog?.title || c.curso_id.toUpperCase(),
            studentName: this.auth.currentUser()?.name || 'Estudiante',
            issuedAt: new Date(c.emitido_en).getTime(),
            instructor: catalog?.instructor || 'Instructor AndesConnect',
            category: catalog?.category || 'technology'
          };
        });
        this.certificates.set(mapped);
        this.saveCertificates();
      } catch (e) {
        console.warn('Error al sincronizar certificados desde el servidor:', e);
        this.loadCertificates();
      }
    } else {
      this.loadCertificates();
    }
  }

  async downloadCertificateFile(codigo: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${environment.apiUrl}/certificados/descargar/${codigo}`, {
        responseType: 'blob'
      })
    );
  }
}
