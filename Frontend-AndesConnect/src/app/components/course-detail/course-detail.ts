import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslationService } from '../../services/translation.service';
import { CourseService } from '../../services/course.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { NavbarComponent } from '../layout/navbar';
import { FooterComponent } from '../layout/footer/footer';
import { CourseModule, CatalogCourse } from '../../shared/types';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './course-detail.html',
  styleUrls: ['./course-detail.css']
})
export class CourseDetailComponent implements OnInit {
  protected readonly ts = inject(TranslationService);
  protected readonly courseService = inject(CourseService);
  protected readonly auth = inject(AuthService);
  protected readonly notifService = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected courseId = signal<string>('');
  protected catalog = signal<CatalogCourse | null>(null);
  protected modules = signal<CourseModule[]>([]);
  protected readonly enrolled = computed(() => this.courseService.isCourseEnrolled(this.courseId()));
  protected downloading = signal<boolean>(false);
  protected enrollSuccess = signal<boolean>(false);
  protected activeTab = signal<'overview' | 'modules' | 'instructor'>('overview');

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.courseId.set(id);
    const cat = this.courseService.getCatalogCourse(id);
    this.catalog.set(cat ?? null);
    
    // Cargar módulos desde la API/caché de forma asíncrona
    const mods = await this.courseService.loadCourseModules(id);
    this.modules.set(mods);
  }

  get completedModules(): number {
    return this.modules().filter(m => m.completed).length;
  }

  get progress(): number {
    const total = this.modules().length;
    if (total === 0) return 0;
    return Math.round((this.completedModules / total) * 100);
  }

  get activeModule(): CourseModule | undefined {
    return this.modules().find(m => !m.completed && !m.locked);
  }

  getModuleIcon(type: string): string {
    if (type === 'video') return '▶';
    if (type === 'pdf') return '📄';
    return '📝';
  }

  async enroll(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    const id = this.courseId();
    await this.courseService.enrollCourse(id);
    this.enrollSuccess.set(true);
    
    const mods = await this.courseService.loadCourseModules(id);
    this.modules.set(mods);

    this.notifService.add({
      type: 'new_course',
      title: 'Inscripción exitosa',
      message: `Te inscribiste en "${this.catalog()?.title ?? id}".`,
      actionRoute: `/courses/${id}`
    });
    setTimeout(() => this.enrollSuccess.set(false), 3000);
  }

  startModule(mod: CourseModule): void {
    if (mod.locked) return;
    this.router.navigate(['/courses', this.courseId(), 'player', mod.id]);
  }

  downloadCourse(): void {
    const cat = this.catalog();
    if (!cat || this.downloading()) return;
    this.downloading.set(true);
    this.courseService.startCourseDownload(cat.id, cat.title, `${cat.modules * 50}MB`);
    setTimeout(() => this.downloading.set(false), 2000);
  }

  isCourseDownloaded(): boolean {
    return this.courseService.courses().some(c => c.id === this.courseId() && c.downloaded);
  }

  goBack(): void {
    this.router.navigate(['/courses']);
  }

  setTab(tab: 'overview' | 'modules' | 'instructor'): void {
    this.activeTab.set(tab);
  }
}
