import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';
import { adminGuard } from './services/admin.guard';

export const routes: Routes = [
  {
    path: 'admin-register',
    loadComponent: () => import('./components/admin/register').then(m => m.AdminRegisterComponent)
  },
  {
    path: 'admin/courses',
    loadComponent: () => import('./components/admin/courses').then(m => m.AdminCoursesComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'home',
    loadComponent: () => import('./components/home/home').then(m => m.HomeComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./components/auth/login').then(m => m.LoginComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./components/forgot-password/forgot-password').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'sync-status',
    loadComponent: () => import('./components/sync/sync-status').then(m => m.SyncStatusComponent),
    canActivate: [authGuard]
  },
  {
    path: 'courses',
    loadComponent: () => import('./components/courses/courses').then(m => m.CoursesComponent)
  },
  {
    path: 'courses/:id',
    loadComponent: () => import('./components/course-detail/course-detail').then(m => m.CourseDetailComponent)
  },
  {
    path: 'courses/:id/player/:moduleId',
    loadComponent: () => import('./components/lesson-player/lesson-player').then(m => m.LessonPlayerComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./components/profile/profile').then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'library',
    loadComponent: () => import('./components/library/library').then(m => m.LibraryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'help-center',
    loadComponent: () => import('./components/help-center/help-center').then(m => m.HelpCenterComponent)
  },
  {
    path: 'certificates',
    loadComponent: () => import('./components/certificates/certificates').then(m => m.CertificatesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'notifications',
    loadComponent: () => import('./components/notifications/notifications').then(m => m.NotificationsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./components/settings/settings').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];
