import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${year}`;
}

export function getProgressWidth(progress: number): string {
  return Math.min(100, Math.max(0, progress)) + '%';
}

export function mustMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('password')?.value;
  return control.value === password ? null : { mustMatch: true };
}

export function passwordStrength(control: AbstractControl): ValidationErrors | null {
  const v: string = control.value || '';
  if (!v || v.length < 8) return null;

  const hasUpper = /[A-Z]/.test(v);
  const hasDigit = /\d/.test(v);
  const hasSpecial = /[^A-Za-z0-9]/.test(v);

  return hasUpper && hasDigit && hasSpecial ? null : { weak: true };
}

export function computePasswordStrength(v: string): 'none' | 'weak' | 'medium' | 'strong' {
  const score = computePasswordScore(v);
  if (score === 0) return 'none';
  if (score < 40) return 'weak';
  if (score < 70) return 'medium';
  return 'strong';
}

export function computePasswordScore(v: string): number {
  if (!v) return 0;
  let score = 0;

  // Length: 1 point per char, max 25
  score += Math.min(v.length, 25);

  // Has uppercase
  if (/[A-Z]/.test(v)) score += 15;

  // Has lowercase
  if (/[a-z]/.test(v)) score += 15;

  // Has digit
  if (/\d/.test(v)) score += 15;

  // Has special
  if (/[^A-Za-z0-9]/.test(v)) score += 15;

  // Bonus for having 3+ character types
  const types = [/[A-Z]/.test(v), /[a-z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
  if (types >= 3) score += 15;

  return Math.min(score, 100);
}

export function computePasswordErrors(v: string): { minLength: boolean; hasUpper: boolean; hasLower: boolean; hasDigit: boolean; hasSpecial: boolean } {
  return {
    minLength: v.length >= 8,
    hasUpper: /[A-Z]/.test(v),
    hasLower: /[a-z]/.test(v),
    hasDigit: /\d/.test(v),
    hasSpecial: /[^A-Za-z0-9]/.test(v)
  };
}
