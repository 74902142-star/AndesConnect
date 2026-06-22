import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslationService, LanguageCode } from '../../services/translation.service';
import { AuthService } from '../../services/auth.service';
import { mustMatch, passwordStrength, computePasswordScore, computePasswordErrors } from '../../shared/utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent implements OnInit {
  protected readonly ts = inject(TranslationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly isRegisterMode = signal(false);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  protected readonly registerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    location: ['', [Validators.required]],
    role: ['student' as 'student' | 'teacher', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8), passwordStrength]],
    confirmPassword: ['', [Validators.required, mustMatch]]
  });

  private readonly passwordValue = toSignal(
    this.registerForm.controls.password.valueChanges,
    { initialValue: '' }
  );

  protected readonly passwordScore = computed(() =>
    computePasswordScore(this.passwordValue())
  );

  protected readonly passwordErrors = computed(() =>
    computePasswordErrors(this.passwordValue())
  );

  setRegisterMode(mode: boolean): void {
    this.isRegisterMode.set(mode);
    this.errorMessage.set('');
    this.loginForm.reset();
    this.registerForm.reset({ role: 'student' });
  }

  changeLanguage(lang: LanguageCode): void {
    this.ts.setLanguage(lang);
  }

  async onLogin(): Promise<void> {
    this.errorMessage.set('');
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.getRawValue();
    const result = await this.auth.login(email, password);

    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMessage.set(this.ts.translate('auth.error_login'));
    }
  }

  async onRegister(): Promise<void> {
    this.errorMessage.set('');
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { name, email, location, role, password } = this.registerForm.getRawValue();
    const result = await this.auth.register(name, email, location, role, password);

    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMessage.set(this.ts.translate('auth.error_register'));
    }
  }

  goToHelp(): void {
    this.router.navigate(['/help-center']);
  }

  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }

  async accessOffline(): Promise<void> {
    const result = await this.auth.loginAsGuest('login');
    if (result.success) {
      this.router.navigate(['/dashboard']);
    }
  }
}
