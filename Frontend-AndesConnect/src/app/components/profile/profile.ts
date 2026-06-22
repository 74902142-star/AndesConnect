import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { CourseService } from '../../services/course.service';
import { PdfGeneratorService } from '../../services/pdf-generator.service';
import { NavbarComponent } from '../layout/navbar';
import { FooterComponent } from '../layout/footer/footer';
import { Certificate } from '../../shared/types';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css']
})
export class ProfileComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly ts = inject(TranslationService);
  protected readonly courseService = inject(CourseService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly pdfGen = inject(PdfGeneratorService);

  protected readonly saveSuccess = signal(false);
  protected readonly userAchievements = signal<any[]>([]);

  protected profileForm = this.fb.nonNullable.group({
    name: [this.auth.currentUser()?.name ?? '', Validators.required],
    email: [this.auth.currentUser()?.email ?? '', [Validators.required, Validators.email]],
    location: [this.auth.currentUser()?.location ?? '']
  });

  async ngOnInit(): Promise<void> {
    this.courseService.syncCertificates();
    if (this.auth.isAuthenticated() && !this.auth.isGuest()) {
      try {
        const logros = await firstValueFrom(
          this.http.get<any[]>(`${environment.apiUrl}/logros/mis-logros`)
        );
        this.userAchievements.set(logros || []);
      } catch (err) {
        console.warn('Error fetching achievements from database, computing locally.', err);
        this.computeLocalAchievements();
      }
    } else {
      this.computeLocalAchievements();
    }
  }

  private computeLocalAchievements(): void {
    const localLogros = [];
    if (this.completedCourses >= 1) {
      localLogros.push({
        id: 'first_course',
        titulo_clave: 'profile.achievement_first_course',
        icono: '🎓'
      });
    }
    if (this.totalProgress > 50) {
      localLogros.push({
        id: 'half_progress',
        titulo_clave: 'profile.achievement_50_percent',
        icono: '🔥'
      });
    }
    this.userAchievements.set(localLogros);
  }

  get userInitial(): string {
    return (this.auth.currentUser()?.name ?? 'U')[0];
  }

  get totalProgress(): number {
    const courses = this.courseService.courses();
    if (courses.length === 0) return 0;
    const total = courses.reduce((sum, c) => sum + c.progress, 0);
    return Math.round(total / courses.length);
  }

  get completedCourses(): number {
    return this.courseService.courses().filter(c => c.progress >= 100).length;
  }

  get totalStudyHours(): string {
    const total = this.courseService.courses().reduce((sum, c) => sum + c.progress, 0);
    return Math.round(total * 0.12) + 'h';
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;
    const { name, email, location } = this.profileForm.getRawValue();
    this.auth.updateProfile(name, email, location);
    this.saveSuccess.set(true);
    setTimeout(() => this.saveSuccess.set(false), 3000);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  getRoleLabel(): string {
    const role = this.auth.currentUser()?.role ?? 'student';
    return role === 'teacher'
      ? this.ts.translate('auth.role_teacher')
      : this.ts.translate('auth.role_student');
  }

  get certificates(): Certificate[] {
    return this.courseService.certificates();
  }

  async downloadCertificate(cert: Certificate): Promise<void> {
    await this.pdfGen.generateCertificatePdf(cert);
  }
}
