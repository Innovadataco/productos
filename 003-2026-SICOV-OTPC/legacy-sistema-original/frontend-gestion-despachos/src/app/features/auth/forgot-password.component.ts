import { ChangeDetectionStrategy, Component, inject, signal, effect, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-forgot-password',
  template: `
    <section class="login-wrapper">
      <div class="panel">
        <div class="brand-bar" aria-hidden="true">
          <img ngSrc="assets/topbar-logo.png" width="180" height="45" alt="Expreso Brasilia" />
        </div>
        <div class="header">
          <h1 class="title">Recuperar contraseña</h1>
          @if (!sent()) {
            <p class="subtitle">Ingresa tu usuario (identificación/NIT) y tu correo; te enviaremos una clave temporal para que puedas ingresar y cambiar tu contraseña desde la opción "Cambio de contraseña"</p>
          }
        </div>

        @if (!sent()) {
          <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate class="form">
            <label class="field">
              <span class="label">Usuario (Identificación/NIT)</span>
              <input type="text" formControlName="usuario" placeholder="usuario o NIT" autocomplete="username" required (input)="onUsuarioInput($event)" />
            </label>
            @if (form.controls.usuario.touched && form.controls.usuario.invalid) {
              <p class="error">Ingresa tu usuario (solo dígitos).</p>
            }
            <label class="field">
              <span class="label">Email</span>
              <input type="email" formControlName="email" placeholder="email@example.com" autocomplete="email" required />
            </label>
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <p class="error">Ingresa un correo válido.</p>
            }

            <div class="actions">
              <a [routerLink]="['/login']" class="link">Volver al inicio de sesión</a>
              <button type="submit" class="btn-brand btn-brand--lg btn-brand--block" [disabled]="form.invalid || loading()">
                Generar clave temporal
              </button>
            </div>

            @if (error()) {
              <p class="error" aria-live="assertive">{{ error() }}</p>
            }
          </form>
        } @else {
          <div class="form">
            <p>Te enviamos una clave temporal a tu correo. Inicia sesión con esa clave y luego cámbiala desde el menú en la opción <strong>Cambio de contraseña</strong>.</p>
            <a [routerLink]="['/login']" class="btn-brand btn-brand--lg back">Ir a iniciar sesión</a>
          </div>
        }
      </div>
    </section>
  `,
  styles: [
    `
    :host { display: contents; }
    .login-wrapper { min-height: 100dvh; display: grid; place-items: center; padding: 1rem; background: var(--page-bg, #f6f8fb); }
  .panel { width: min(560px, 100%); background: #fff; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,.06); padding: 1.5rem; }
  .brand-bar { margin: -1.5rem -1.5rem 1rem; padding: .9rem 1.5rem; border-radius: 20px 20px 0 0; background: linear-gradient(90deg, var(--brand-700), var(--brand-900)); display: flex; align-items: center; justify-content: center; }
    .header { text-align: left; margin-top: .25rem; }
    .title { margin: 0; font-size: 1.5rem; color: var(--brand-800); font-weight: 800; }
    .subtitle { margin: .25rem 0 0; color: #4b5563; }
    .form { display: grid; gap: 1rem; margin-top: 1.25rem; }
    .field { display: grid; gap: .5rem; }
    .label { font-weight: 600; color: #0f172a; }
    input[type="email"] {
      height: 48px; border-radius: 999px; border: 1px solid #e5e7eb; padding: 0 1rem; font-size: 1rem; background: #f8fafc; outline: none; transition: border-color .2s, box-shadow .2s, background .2s;
    }
    input[type="text"] {
      height: 48px; border-radius: 999px; border: 1px solid #e5e7eb; padding: 0 1rem; font-size: 1rem; background: #f8fafc; outline: none; transition: border-color .2s, box-shadow .2s, background .2s;
    }
    input[type="text"]:focus, input[type="email"]:focus { border-color: var(--brand-500); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-500) 20%, transparent); background: #fff; }
    input::placeholder { color: #cbd5e1; }
    input:focus { border-color: var(--brand-500); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-500) 20%, transparent); background: #fff; }
    .actions { display: grid; gap: .75rem; }
  .link { color: var(--brand-700); text-decoration: none; font-weight: 600; justify-self: start; }
  .link:hover { text-decoration: underline; }
  /* Button styles come from global .btn-brand */
    .back { justify-self: start; text-decoration: none; }
    .error { color: #b00020; font-size: .9rem; margin: 0; }
  `,
  ],
  // Module-based: directives and modules are provided via AppModule imports
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ForgotPasswordComponent {
  // token para limpiar el formulario cuando se reutiliza el componente
  resetToken = input<number>(0);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly sent = signal(false);

  readonly form = this.fb.nonNullable.group({
    usuario: ['', [Validators.required, Validators.pattern(/^\S+$/)]],
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    // Reiniciar el formulario cada vez que cambie resetToken
    effect(() => {
      const t = this.resetToken();
      void t;
      this.resetForm();
    });
  }

  onUsuarioInput(e: Event) {
    const el = e.target as HTMLInputElement;
    // sin espacios: elimina espacios en cualquier posición
    const cleaned = el.value.replace(/\s+/g, '');
    if (cleaned !== el.value) this.form.controls.usuario.setValue(cleaned);
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    const { usuario, email } = this.form.getRawValue();
    const ok = await this.auth.recover(usuario, email);
    this.loading.set(false);
    if (ok) {
      this.sent.set(true);
    } else {
      this.error.set('No pudimos procesar tu solicitud.');
    }
  }

  private resetForm() {
    this.form.reset({ usuario: '', email: '' });
    this.loading.set(false);
    this.error.set('');
    this.sent.set(false);
  }
}
