import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { TranslationService } from '../../services/translation.service';
import { AuthService } from '../../services/auth.service';
import { CourseService } from '../../services/course.service';
import { NavbarComponent } from '../layout/navbar';
import { FooterComponent } from '../layout/footer/footer';
import { CatalogCourse } from '../../shared/types';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './courses.html',
  styleUrls: ['./courses.css']
})
export class CoursesComponent implements OnInit {
  protected readonly ts = inject(TranslationService);
  protected readonly auth = inject(AuthService);
  protected readonly courseService = inject(CourseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly activeFilter = signal<string>('all');
  protected readonly downloadingId = signal<string>('');
  protected readonly enrollingId = signal<string>('');

  ngOnInit(): void {
    // Apply category from query param if provided
    const cat = this.route.snapshot.queryParamMap.get('category');
    if (cat) this.activeFilter.set(cat);

    // Load catalog if not already loaded
    if (!this.courseService.catalogLoaded()) {
      this.courseService.loadCatalog();
    }
  }

  get allCourses(): CatalogCourse[] {
    return this.courseService.catalogCourses;
  }

  get filteredCourses(): CatalogCourse[] {
    const filter = this.activeFilter();
    if (filter === 'all') return this.allCourses;
    return this.allCourses.filter(c => c.category === filter);
  }

  setFilter(filter: string): void {
    this.activeFilter.set(filter);
  }

  isCourseActive(courseId: string): boolean {
    return this.courseService.isCourseEnrolled(courseId);
  }

  isCourseDownloaded(courseId: string): boolean {
    const course = this.courseService.courses().find(c => c.id === courseId);
    return course?.downloaded ?? false;
  }

  getCourseProgress(courseId: string): number {
    const course = this.courseService.courses().find(c => c.id === courseId);
    return course?.progress ?? 0;
  }

  getButtonLabel(course: CatalogCourse): string {
    if (!course.available) return this.ts.translate('courses.coming_soon_badge');
    if (this.isCourseActive(course.id)) return this.ts.translate('courses.view');
    return this.ts.translate('courses.enroll');
  }

  /** Navigate to course detail */
  goToDetail(courseId: string): void {
    this.router.navigate(['/courses', courseId]);
  }

  /** Enroll directly from catalog */
  async enrollCourse(event: Event, courseId: string): Promise<void> {
    event.stopPropagation();
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    if (this.enrollingId()) return;
    this.enrollingId.set(courseId);
    await this.courseService.enrollCourse(courseId);
    setTimeout(() => this.enrollingId.set(''), 1500);
  }

  /** Start a download for a course */
  downloadCourse(event: Event, course: CatalogCourse): void {
    event.stopPropagation();
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    if (this.downloadingId()) return;
    this.downloadingId.set(course.id);
    this.courseService.startCourseDownload(course.id, course.title, `${course.modules * 50}MB`);
    setTimeout(() => this.downloadingId.set(''), 2000);
  }
}
