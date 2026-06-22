import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslationService } from '../../services/translation.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css']
})
export class ForgotPasswordComponent {
  protected readonly ts = inject(TranslationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly step = signal<'email' | 'code' | 'newpass' | 'done'>('email');
  protected readonly loading = signal<boolean>(false);
  protected readonly errorMsg = signal<string>('');

  protected emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  protected codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
  });

  protected newPassForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]]
  });

  submitEmail(): void {
    if (this.emailForm.invalid) { this.emailForm.markAllAsTouched(); return; }
    this.loading.set(true);
    // Simulate API call
    setTimeout(() => {
      this.loading.set(false);
      this.step.set('code');
    }, 1500);
  }

  submitCode(): void {
    if (this.codeForm.invalid) { this.codeForm.markAllAsTouched(); return; }
    const code = this.codeForm.controls.code.value;
    // Mock: any 6-digit code works
    if (code.length === 6) {
      this.step.set('newpass');
      this.errorMsg.set('');
    } else {
      this.errorMsg.set('Código inválido. Ingrese los 6 dígitos.');
    }
  }

  submitNewPass(): void {
    const { password, confirm } = this.newPassForm.getRawValue();
    if (password !== confirm) { this.errorMsg.set('Las contraseñas no coinciden.'); return; }
    this.loading.set(true);
    setTimeout(() => {
      this.loading.set(false);
      this.step.set('done');
    }, 1200);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
