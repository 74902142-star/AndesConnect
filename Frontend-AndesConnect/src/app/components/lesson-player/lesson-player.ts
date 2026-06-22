import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslationService } from '../../services/translation.service';
import { CourseService } from '../../services/course.service';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../layout/navbar';
import { CourseModule, CatalogCourse } from '../../shared/types';
import { environment } from '../../../environments/environment';

interface Question {
  text: string;
  options: string[];
  correctAnswer: number;
}

const QUIZ_QUESTIONS: Record<string, Question[]> = {
  drones: [
    {
      text: '¿Cuál es el principal beneficio del uso de drones en la agricultura de precisión?',
      options: [
        'Reducir el consumo de agua únicamente.',
        'Mapeo rápido de terrenos y detección de estrés hídrico o plagas de forma eficiente.',
        'Eliminar la necesidad de tractores por completo.'
      ],
      correctAnswer: 1
    },
    {
      text: '¿Qué tipo de sensor montado en el dron se utiliza para calcular el índice NDVI?',
      options: [
        'Sensor térmico de alta temperatura.',
        'Cámara RGB convencional.',
        'Cámara multiespectral (cerca de infrarrojo y rojo).'
      ],
      correctAnswer: 2
    },
    {
      text: '¿Cuál es la altura recomendada para vuelos de pulverización agrícola con drones?',
      options: [
        'Entre 1.5 a 3 metros sobre el dosel del cultivo.',
        'Más de 50 metros para mayor cobertura.',
        'A ras de suelo para evitar el viento.'
      ],
      correctAnswer: 0
    }
  ],
  riego: [
    {
      text: '¿Qué protocolo de comunicación inalámbrica es ideal para sensores IoT a larga distancia en zonas rurales sin cobertura móvil?',
      options: [
        'Bluetooth convencional.',
        'LoRa / LoRaWAN.',
        'Cableado ethernet.'
      ],
      correctAnswer: 1
    },
    {
      text: '¿Cómo ayuda un sensor capacitivo de humedad a optimizar el riego?',
      options: [
        'Mide la cantidad de sales y las disuelve en el agua.',
        'Mide la constante dieléctrica del suelo para dar una lectura precisa de humedad sin corroerse.',
        'Calienta el suelo para evaporar el exceso de agua.'
      ],
      correctAnswer: 1
    },
    {
      text: '¿Cuál es el beneficio de la automatización del riego basada en evapotranspiración?',
      options: [
        'Regar únicamente cuando la planta realmente ha perdido agua según el clima local.',
        'Mantener el suelo inundado de forma permanente.',
        'Hacer que las plantas crezcan el doble de rápido sin abono.'
      ],
      correctAnswer: 0
    }
  ],
  suelos: [
    {
      text: '¿Qué técnica de muestreo asegura que una muestra de suelo sea representativa?',
      options: [
        'Tomar tierra únicamente de la entrada del campo.',
        'Muestreo en patrón de zig-zag o cuadrícula tomando varias submuestras a profundidad homogénea.',
        'Tomar tierra solo de las zonas con mejor rendimiento.'
      ],
      correctAnswer: 1
    },
    {
      text: '¿Cómo clasifica la Inteligencia Artificial las deficiencias de nutrientes en las plantas?',
      options: [
        'Mediante el análisis visual automatizado de imágenes foliares buscando patrones de clorosis o necrosis.',
        'Adivinando según el color de las flores.',
        'Midiendo el peso de la raíz de forma remota.'
      ],
      correctAnswer: 0
    },
    {
      text: '¿Qué pH del suelo se considera óptimo para la mayoría de cultivos agrícolas generales?',
      options: [
        'Extremadamente ácido (pH 4.0).',
        'Ligeramente ácido a neutro (pH 6.0 a 7.0).',
        'Altamente alcalino (pH 9.0).'
      ],
      correctAnswer: 1
    }
  ]
};

const DEFAULT_QUESTIONS: Question[] = [
  {
    text: '¿Cuál es el objetivo principal del desarrollo tecnológico sostenible en zonas rurales?',
    options: [
      'Industrializar todas las tierras agrícolas sin control.',
      'Mejorar la calidad de vida y producción local respetando el medio ambiente y los recursos.',
      'Sustituir a los agricultores locales por robots autónomos.'
    ],
    correctAnswer: 1
  },
  {
    text: '¿Por qué es importante mantener una base de datos local y sincronización offline en la app?',
    options: [
      'Para consumir más batería en el celular.',
      'Permite estudiar sin conexión en zonas rurales remotas y guardar el avance para cuando haya señal.',
      'Para evitar que los datos se suban al servidor.'
    ],
    correctAnswer: 1
  },
  {
    text: '¿Qué porcentaje es necesario para aprobar las evaluaciones en AndesConnect Educa?',
    options: [
      'Mínimo 50% de aciertos.',
      'Mínimo 70% de aciertos.',
      'Se aprueba con solo responder sin importar los aciertos.'
    ],
    correctAnswer: 1
  }
];

@Component({
  selector: 'app-lesson-player',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  templateUrl: './lesson-player.html',
  styleUrls: ['./lesson-player.css']
})
export class LessonPlayerComponent implements OnInit, OnDestroy {
  protected readonly ts = inject(TranslationService);
  protected readonly courseService = inject(CourseService);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  protected courseId = signal<string>('');
  protected moduleId = signal<string>('');
  protected catalog = signal<CatalogCourse | null>(null);
  protected currentModule = signal<CourseModule | null>(null);
  protected allModules = signal<CourseModule[]>([]);
  protected completed = signal<boolean>(false);
  protected videoProgress = signal<number>(0);
  protected notes = signal<string>('');
  protected showNotes = signal<boolean>(false);
  protected safeContentUrl = signal<SafeResourceUrl | null>(null);

  // Estados de la evaluación interactiva
  protected quizStarted = signal<boolean>(false);
  protected currentQuestionIndex = signal<number>(0);
  protected selectedAnswers = signal<number[]>([]);
  protected quizFinished = signal<boolean>(false);
  protected quizScore = signal<number>(0);
  protected quizApproved = signal<boolean>(false);

  private videoInterval: any = null;

  protected isLoading = signal<boolean>(true);

  ngOnInit(): void {
    this.route.paramMap.subscribe(async params => {
      this.isLoading.set(true);
      const cId = params.get('id') ?? '';
      const mId = params.get('moduleId') ?? '';
      this.courseId.set(cId);
      this.moduleId.set(mId);
      this.catalog.set(this.courseService.getCatalogCourse(cId) ?? null);
      
      const mods = await this.courseService.loadCourseModules(cId);
      this.allModules.set(mods);
      const mod = mods.find(m => m.id === mId) ?? mods.find(m => !m.locked) ?? mods[0] ?? null;
      this.currentModule.set(mod);
      
      // Reset quiz states when changing module
      this.quizStarted.set(false);
      this.quizFinished.set(false);

      if (mod) {
        this.completed.set(mod.completed);
        this.moduleId.set(mod.id);
        this.loadNotes(mod.id);
        this.prepareContentUrl(mod);
      }
      this.simulateVideoProgress();

      // Pequeña pantalla de carga para mejorar la experiencia de transición
      setTimeout(() => {
        this.isLoading.set(false);
      }, 600);
    });
  }

  ngOnDestroy(): void {
    if (this.videoInterval) {
      clearInterval(this.videoInterval);
    }
  }

  get questions(): Question[] {
    const mod = this.currentModule();
    if (mod && mod.type === 'quiz' && mod.contentUrl) {
      try {
        const parsed = JSON.parse(mod.contentUrl);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as Question[];
        }
      } catch (e) {
        console.error('Error parseando preguntas del módulo:', e);
      }
    }
    return QUIZ_QUESTIONS[this.courseId()] || DEFAULT_QUESTIONS;
  }

  get currentQuestion(): Question {
    return this.questions[this.currentQuestionIndex()];
  }

  startQuiz(): void {
    this.quizStarted.set(true);
    this.currentQuestionIndex.set(0);
    this.selectedAnswers.set(new Array(this.questions.length).fill(-1));
    this.quizFinished.set(false);
    this.quizScore.set(0);
    this.quizApproved.set(false);
  }

  selectOption(optionIndex: number): void {
    this.selectedAnswers.update(arr => {
      const copy = [...arr];
      copy[this.currentQuestionIndex()] = optionIndex;
      return copy;
    });
  }

  nextQuestion(): void {
    if (this.currentQuestionIndex() + 1 < this.questions.length) {
      this.currentQuestionIndex.update(idx => idx + 1);
    } else {
      this.finishQuiz();
    }
  }

  prevQuestion(): void {
    if (this.currentQuestionIndex() > 0) {
      this.currentQuestionIndex.update(idx => idx - 1);
    }
  }

  async finishQuiz(): Promise<void> {
    const answers = this.selectedAnswers();
    const qList = this.questions;
    let correctCount = 0;
    for (let i = 0; i < qList.length; i++) {
      if (answers[i] === qList[i].correctAnswer) {
        correctCount++;
      }
    }
    const score = Math.round((correctCount / qList.length) * 100);
    this.quizScore.set(score);
    const approved = score >= 70;
    this.quizApproved.set(approved);
    this.quizFinished.set(true);

    if (approved) {
      const mod = this.currentModule();
      if (mod) {
        await this.courseService.submitAssessment(this.courseId(), mod.id, score);
        this.completed.set(true);
        const mods = await this.courseService.loadCourseModules(this.courseId());
        this.allModules.set(mods);
      }
    }
  }

  private prepareContentUrl(mod: CourseModule): void {
    const url = mod.contentUrl;
    if (!url) {
      this.safeContentUrl.set(null);
      return;
    }

    let embedUrl = url;

    if (url.includes('youtube.com/watch')) {
      const videoId = new URL(url).searchParams.get('v');
      if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
      }
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
      }
    } else if (url.includes('vimeo.com/')) {
      const vimeoId = url.split('vimeo.com/')[1]?.split('?')[0];
      if (vimeoId) {
        embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
      }
    } else if (embedUrl.startsWith('/uploads/')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      embedUrl = `${baseUrl}${embedUrl}`;
    }

    this.safeContentUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl));
  }

  isVideoEmbed(): boolean {
    const url = this.currentModule()?.contentUrl;
    if (!url) return false;
    return url.includes('youtube') || url.includes('youtu.be') || url.includes('vimeo');
  }

  isPdfUrl(): boolean {
    const url = this.currentModule()?.contentUrl;
    if (!url) return false;
    return url.toLowerCase().endsWith('.pdf') || url.includes('/pdf');
  }

  private simulateVideoProgress(): void {
    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }
    this.videoProgress.set(0);

    if (this.currentModule()?.contentUrl) return;
    if (this.currentModule()?.type !== 'video') return;

    this.videoInterval = setInterval(() => {
      this.videoProgress.update(p => {
        if (p >= 100) {
          clearInterval(this.videoInterval);
          this.videoInterval = null;
          return 100;
        }
        return p + 2;
      });
    }, 300);
  }

  async markComplete(): Promise<void> {
    const mod = this.currentModule();
    if (!mod) return;
    await this.courseService.completeModule(this.courseId(), mod.id);
    this.completed.set(true);
    
    const mods = await this.courseService.loadCourseModules(this.courseId());
    this.allModules.set(mods);
    this.saveNotes(mod.id);
  }

  goToNextModule(): void {
    const mods = this.allModules();
    const idx = mods.findIndex(m => m.id === this.currentModule()?.id);
    if (idx !== -1 && idx + 1 < mods.length && !mods[idx + 1].locked) {
      const next = mods[idx + 1];
      this.router.navigate(['/courses', this.courseId(), 'player', next.id]);
    } else {
      this.router.navigate(['/courses', this.courseId()]);
    }
  }

  selectModule(mod: CourseModule): void {
    if (mod.locked) return;
    this.saveNotes(this.currentModule()?.id ?? '');
    this.router.navigate(['/courses', this.courseId(), 'player', mod.id]);
  }

  toggleNotes(): void {
    this.showNotes.update(v => !v);
  }

  updateNotes(event: Event): void {
    const val = (event.target as HTMLTextAreaElement).value;
    this.notes.set(val);
  }

  private saveNotes(moduleId: string): void {
    if (!moduleId) return;
    localStorage.setItem(`rt_notes_${moduleId}`, this.notes());
  }

  private loadNotes(moduleId: string): void {
    const saved = localStorage.getItem(`rt_notes_${moduleId}`) ?? '';
    this.notes.set(saved);
  }

  get hasNext(): boolean {
    const mods = this.allModules();
    const idx = mods.findIndex(m => m.id === this.currentModule()?.id);
    return idx !== -1 && idx + 1 < mods.length && !mods[idx + 1].locked;
  }

  get hasPrev(): boolean {
    const mods = this.allModules();
    const idx = mods.findIndex(m => m.id === this.currentModule()?.id);
    return idx > 0;
  }

  goToPrevModule(): void {
    const mods = this.allModules();
    const idx = mods.findIndex(m => m.id === this.currentModule()?.id);
    if (idx > 0) {
      const prev = mods[idx - 1];
      this.router.navigate(['/courses', this.courseId(), 'player', prev.id]);
    }
  }

  getModuleIcon(type: string): string {
    if (type === 'video') return '▶';
    if (type === 'pdf') return '📄';
    return '📝';
  }

  goBack(): void {
    this.router.navigate(['/courses', this.courseId()]);
  }

  getFullUrl(path?: string): string {
    if (!path) return '';
    if (path.startsWith('/uploads/')) {
      // environment.apiUrl es 'http://127.0.0.1:8000/api', queremos la base
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${path}`;
    }
    return path;
  }
}
