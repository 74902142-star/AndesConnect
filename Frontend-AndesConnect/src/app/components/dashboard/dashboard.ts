import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { CourseService } from '../../services/course.service';
import { SyncService } from '../../services/sync.service';
import { NavbarComponent } from '../layout/navbar';
import { FooterComponent } from '../layout/footer/footer';
import { getProgressWidth } from '../../shared/utils';
import { CatalogCourse } from '../../shared/types';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
  protected readonly ts = inject(TranslationService);
  protected readonly courseService = inject(CourseService);
  protected readonly sync = inject(SyncService);
  protected readonly getProgressWidth = getProgressWidth;
  private readonly router = inject(Router);

  /** Courses the user hasn't enrolled in yet */
  protected readonly recommendedCourses = computed(() => {
    return this.courseService.getAvailableCoursesForEnrollment().slice(0, 4);
  });

  /** Whether user has enrolled courses */
  protected readonly hasEnrolledCourses = computed(() => {
    return this.courseService.courses().length > 0;
  });

  get onlineLabel(): string {
    return this.sync.isOnline()
      ? this.ts.translate('dash.mode_online')
      : this.ts.translate('dash.mode_offline');
  }

  get totalStudyHours(): string {
    const total = this.courseService.courses().reduce((sum, c) => sum + c.progress, 0);
    return Math.round(total * 0.12) + 'h';
  }

  get certificatesCount(): string {
    const count = this.courseService.courses().filter(c => c.progress >= 100).length;
    return count.toString().padStart(2, '0');
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  async quickEnroll(courseId: string): Promise<void> {
    await this.courseService.enrollCourse(courseId);
  }

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'technology': return '💻';
      case 'agriculture': return '🌱';
      case 'business': return '📊';
      default: return '📚';
    }
  }
}
