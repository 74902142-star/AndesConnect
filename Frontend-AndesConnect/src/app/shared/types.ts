export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserProfile {
  name: string;
  email: string;
  location?: string;
  role: UserRole;
  avatar?: string;
}

export interface CatalogCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  modules: number;
  level: string;
  instructor: string;
  image: string;
  color: string;
  available: boolean;
}

export interface CourseModule {
  id: string;
  courseId: string;
  order: number;
  title: string;
  description: string;
  duration: string;
  type: 'video' | 'pdf' | 'quiz';
  completed: boolean;
  locked: boolean;
  contentUrl?: string;
  videoUrl?: string;
  pdfContent?: string;
}

export interface Certificate {
  id: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  issuedAt: number;
  instructor: string;
  category: string;
}

export interface AppNotification {
  id: string;
  type: 'course_complete' | 'download_ready' | 'sync_done' | 'new_course' | 'achievement';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionRoute?: string;
}

export interface AppSettings {
  defaultLanguage: 'es' | 'qu';
  autoSync: boolean;
  notifications: boolean;
  downloadWifiOnly: boolean;
  darkMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

export interface FaqItem {
  id: number;
  questionKey: string;
  answerKey: string;
  open: boolean;
}

export type AuthResult =
  | { success: true }
  | { success: false; error: 'invalid' | 'not_found' | 'exists' };
