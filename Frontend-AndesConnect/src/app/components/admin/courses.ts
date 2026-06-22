import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormArray, FormControl } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { CatalogCourse, CourseModule } from '../../shared/types';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-admin-courses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './courses.html',
  styleUrls: ['./courses.css']
})
export class AdminCoursesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  protected readonly ts = inject(TranslationService);

  // Estados de la vista
  protected readonly currentView = signal<'list' | 'course-form' | 'modules'>('list');
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  // Datos
  protected readonly coursesList = signal<CatalogCourse[]>([]);
  protected readonly selectedCourse = signal<CatalogCourse | null>(null);
  protected readonly modulesList = signal<CourseModule[]>([]);

  // Modos de formulario
  protected isEditingCourse = false;
  protected editingModuleId: string | null = null;
  protected showModuleForm = signal(false);

  // Formularios
  protected courseForm!: FormGroup;
  protected moduleForm!: FormGroup;

  // Variables para subida de archivo PDF
  protected selectedPdfFile: File | null = null;
  protected uploadingFile = signal(false);

  ngOnInit(): void {
    this.initForms();
    this.loadCourses();
  }

  private initForms(): void {
    this.courseForm = this.fb.group({
      id: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      titulo: ['', [Validators.required, Validators.minLength(5)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]],
      categoria: ['technology', [Validators.required]],
      duracion: ['', [Validators.required]],
      modulos: [0, [Validators.required, Validators.min(0)]],
      nivel: ['courses.beginner', [Validators.required]],
      instructor: ['', [Validators.required]],
      imagen: ['agro', [Validators.required]],
      color: ['#16a34a', [Validators.required]],
      disponible: [true]
    });

    this.moduleForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: [''],
      orden: [1, [Validators.required, Validators.min(1)]],
      tipo_contenido: ['video', [Validators.required]],
      contenido_url: [''],
      duracion_minutos: [15, [Validators.required, Validators.min(1)]],
      quizQuestions: this.fb.array([])
    });

    // Detectar cambios en tipo_contenido
    this.moduleForm.get('tipo_contenido')?.valueChanges.subscribe(tipo => {
      if (tipo === 'quiz' && this.quizQuestions.length === 0) {
        this.addQuestion();
      }
    });
  }

  // Getters para el cuestionario
  get quizQuestions(): FormArray {
    return this.moduleForm.get('quizQuestions') as FormArray;
  }

  newQuestion(): FormGroup {
    return this.fb.group({
      text: ['', Validators.required],
      options: this.fb.array([
        this.fb.control('', Validators.required),
        this.fb.control('', Validators.required)
      ]),
      correctAnswer: [0, Validators.required]
    });
  }

  addQuestion() {
    this.quizQuestions.push(this.newQuestion());
  }

  removeQuestion(index: number) {
    this.quizQuestions.removeAt(index);
  }

  getOptions(qIndex: number): FormArray {
    return this.quizQuestions.at(qIndex).get('options') as FormArray;
  }

  addOption(qIndex: number) {
    this.getOptions(qIndex).push(this.fb.control('', Validators.required));
  }

  removeOption(qIndex: number, optIndex: number) {
    this.getOptions(qIndex).removeAt(optIndex);
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.selectedPdfFile = file;
    }
  }

  async loadCourses(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      // Admin carga TODOS los cursos incluyendo ocultos
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/cursos/?all=true`)
      );
      
      const mapped: CatalogCourse[] = (data || []).map(c => ({
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

      this.coursesList.set(mapped);
    } catch (err: any) {
      console.error('Error al cargar cursos:', err);
      this.errorMessage.set('No se pudieron cargar los cursos del servidor.');
    } finally {
      this.loading.set(false);
    }
  }

  // ACCIONES DE CURSO
  openCreateCourse(): void {
    this.isEditingCourse = false;
    this.courseForm.reset({
      categoria: 'technology',
      nivel: 'courses.beginner',
      imagen: 'agro',
      color: '#16a34a',
      disponible: true,
      modulos: 0
    });
    this.courseForm.get('id')?.enable();
    this.currentView.set('course-form');
  }

  openEditCourse(course: CatalogCourse): void {
    this.isEditingCourse = true;
    this.courseForm.patchValue({
      id: course.id,
      titulo: course.title,
      descripcion: course.description,
      categoria: course.category,
      duracion: course.duration,
      modulos: course.modules,
      nivel: course.level,
      instructor: course.instructor,
      imagen: course.image,
      color: course.color,
      disponible: course.available
    });
    this.courseForm.get('id')?.disable(); // ID no editable
    this.currentView.set('course-form');
  }

  async saveCourse(): Promise<void> {
    if (this.courseForm.invalid) {
      this.courseForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const rawValue = this.courseForm.getRawValue();
    const payload = {
      id: rawValue.id,
      titulo: rawValue.titulo,
      descripcion: rawValue.descripcion,
      categoria: rawValue.categoria,
      duracion: rawValue.duracion,
      modulos: Number(rawValue.modulos),
      nivel: rawValue.nivel,
      instructor: rawValue.instructor,
      imagen: rawValue.imagen,
      color: rawValue.color,
      disponible: rawValue.disponible
    };

    try {
      if (this.isEditingCourse) {
        await firstValueFrom(
          this.http.put(`${environment.apiUrl}/cursos/${rawValue.id}`, payload)
        );
        this.successMessage.set('Curso actualizado con éxito.');
      } else {
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/cursos/`, payload)
        );
        this.successMessage.set('Curso creado con éxito.');
      }
      
      await this.loadCourses();
      setTimeout(() => this.currentView.set('list'), 1000);
    } catch (err: any) {
      console.error('Error al guardar curso:', err);
      this.errorMessage.set(err.error?.detail || 'Error al guardar el curso.');
    } finally {
      this.loading.set(false);
    }
  }

  async deleteCourse(courseId: string): Promise<void> {
    if (!confirm('¿Está seguro de que desea eliminar este curso? Esta acción no se puede deshacer.')) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/cursos/${courseId}`)
      );
      this.successMessage.set('Curso eliminado correctamente.');
      await this.loadCourses();
    } catch (err: any) {
      console.error('Error al eliminar curso:', err);
      this.errorMessage.set(err.error?.detail || 'Error al eliminar el curso.');
    } finally {
      this.loading.set(false);
    }
  }

  // ACCIONES DE MÓDULOS
  async openManageModules(course: CatalogCourse): Promise<void> {
    this.selectedCourse.set(course);
    this.currentView.set('modules');
    this.showModuleForm.set(false);
    await this.loadModules(course.id);
  }

  async loadModules(courseId: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const detail = await firstValueFrom(
        this.http.get<any>(`${environment.apiUrl}/cursos/${courseId}`)
      );
      
      const mapped: CourseModule[] = (detail.modulo_list || []).map((m: any) => ({
        id: m.id,
        courseId: m.curso_id,
        order: m.orden,
        title: m.titulo,
        description: m.descripcion || m.titulo,
        duration: m.duracion_minutos ? `${m.duracion_minutos} min` : '15 min',
        type: (m.tipo_contenido || 'video').toLowerCase() as any,
        completed: false,
        locked: false,
        contentUrl: m.contenido_url || ''
      }));

      this.modulesList.set(mapped);
    } catch (err: any) {
      console.error('Error al cargar módulos:', err);
      this.errorMessage.set('No se pudieron obtener los módulos de este curso.');
    } finally {
      this.loading.set(false);
    }
  }

  openCreateModule(): void {
    this.editingModuleId = null;
    const nextOrder = this.modulesList().length + 1;
    this.moduleForm.reset({
      orden: nextOrder,
      tipo_contenido: 'video',
      duracion_minutos: 15,
      descripcion: '',
      contenido_url: ''
    });
    this.quizQuestions.clear();
    this.selectedPdfFile = null;
    this.showModuleForm.set(true);
  }

  openEditModule(mod: CourseModule): void {
    this.editingModuleId = mod.id;
    const durationNum = parseInt(mod.duration) || 15;
    this.moduleForm.patchValue({
      titulo: mod.title,
      descripcion: mod.description || '',
      orden: mod.order,
      tipo_contenido: mod.type,
      contenido_url: mod.contentUrl || '',
      duracion_minutos: durationNum
    });
    this.selectedPdfFile = null;
    this.quizQuestions.clear();
    if (mod.type === 'quiz' && mod.contentUrl) {
      try {
        const questions = JSON.parse(mod.contentUrl);
        if (Array.isArray(questions)) {
          questions.forEach((q: any) => {
            const optionsArray = this.fb.array(q.options.map((opt: string) => this.fb.control(opt, Validators.required)));
            this.quizQuestions.push(this.fb.group({
              text: [q.text, Validators.required],
              options: optionsArray,
              correctAnswer: [q.correctAnswer, Validators.required]
            }));
          });
        }
      } catch (e) {
        console.error('Error parseando preguntas', e);
      }
    }
    if (mod.type === 'quiz' && this.quizQuestions.length === 0) {
      this.addQuestion();
    }
    this.showModuleForm.set(true);
  }

  async saveModule(): Promise<void> {
    if (this.moduleForm.invalid) {
      this.moduleForm.markAllAsTouched();
      return;
    }

    const course = this.selectedCourse();
    if (!course) return;

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const rawValue = this.moduleForm.getRawValue();
    let finalUrl = rawValue.contenido_url || '';

    // Si es PDF y hay archivo, subimos
    if (rawValue.tipo_contenido === 'pdf' && this.selectedPdfFile) {
      this.uploadingFile.set(true);
      const formData = new FormData();
      formData.append('file', this.selectedPdfFile);
      try {
        const res = await firstValueFrom(this.http.post<any>(`${environment.apiUrl}/uploads/`, formData));
        finalUrl = res.url;
      } catch (err: any) {
        console.error('Error uploading file', err);
        this.errorMessage.set('Error al subir el archivo PDF.');
        this.loading.set(false);
        this.uploadingFile.set(false);
        return;
      }
      this.uploadingFile.set(false);
    } else if (rawValue.tipo_contenido === 'quiz') {
      finalUrl = JSON.stringify(rawValue.quizQuestions);
    }

    const payload = {
      titulo: rawValue.titulo,
      descripcion: rawValue.descripcion || '',
      orden: Number(rawValue.orden),
      tipo_contenido: rawValue.tipo_contenido,
      contenido_url: finalUrl,
      duracion_minutos: Number(rawValue.duracion_minutos)
    };

    try {
      if (this.editingModuleId) {
        await firstValueFrom(
          this.http.put(`${environment.apiUrl}/cursos/${course.id}/modulos/${this.editingModuleId}`, payload)
        );
        this.successMessage.set('Módulo actualizado.');
      } else {
        await firstValueFrom(
          this.http.post(`${environment.apiUrl}/cursos/${course.id}/modulos`, payload)
        );
        this.successMessage.set('Módulo creado.');
      }

      this.showModuleForm.set(false);
      await this.loadModules(course.id);
      
      // Actualizamos automáticamente el contador de módulos del curso
      await firstValueFrom(
        this.http.put(`${environment.apiUrl}/cursos/${course.id}`, {
          modulos: this.modulesList().length
        })
      );
      
    } catch (err: any) {
      console.error('Error al guardar módulo:', err);
      this.errorMessage.set(err.error?.detail || 'Error al procesar el módulo.');
    } finally {
      this.loading.set(false);
    }
  }

  async deleteModule(modId: string): Promise<void> {
    const course = this.selectedCourse();
    if (!course || !confirm('¿Desea eliminar este módulo?')) return;

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/cursos/${course.id}/modulos/${modId}`)
      );
      this.successMessage.set('Módulo eliminado.');
      await this.loadModules(course.id);
      
      // Actualizamos el contador de módulos del curso
      await firstValueFrom(
        this.http.put(`${environment.apiUrl}/cursos/${course.id}`, {
          modulos: this.modulesList().length
        })
      );
      
    } catch (err: any) {
      console.error('Error al eliminar módulo:', err);
      this.errorMessage.set(err.error?.detail || 'Error al eliminar el módulo.');
    } finally {
      this.loading.set(false);
    }
  }

  cancelCourseForm(): void {
    this.currentView.set('list');
  }

  cancelModuleForm(): void {
    this.showModuleForm.set(false);
  }

  backToList(): void {
    this.currentView.set('list');
    this.selectedCourse.set(null);
  }

  getContentTypeIcon(type: string): string {
    switch (type) {
      case 'video': return '🎥';
      case 'pdf': return '📄';
      case 'quiz': return '📝';
      default: return '📁';
    }
  }

  getFullUrl(path?: string): string {
    if (!path) return '';
    if (path.startsWith('/uploads/')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${path}`;
    }
    return path;
  }
}
