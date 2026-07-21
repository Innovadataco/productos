import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AutenticacionService } from '../../core/autenticacion.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  template: `
    <section class="login-wrapper">
      <div class="panel">
        <div class="brand-bar" aria-hidden="true">
          <img
            ngSrc="assets/logo-login.png"
            width="320"
            height="80"
            priority
            class="login-logo"
          />
        </div>
        <div class="header">
          <h1 class="title">¡Bienvenido!</h1>
          <p class="subtitle">Ingresa tu usuario para iniciar sesión en tu cuenta</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate class="form">
          <label class="field">
            <span class="label">Usuario</span>
            <input
              type="text"
              formControlName="usuario"
              inputmode="text"
              placeholder="Ingresa tu usuario"
              autocomplete="username"
              required
            />
          </label>
          @if (form.controls.usuario.touched && form.controls.usuario.invalid) {
            <p class="error">Ingresa un usuario válido.</p>
          }

          <label class="field">
            <span class="label">Contraseña</span>
            <input
              type="password"
              formControlName="password"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
          </label>
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <p class="error">La contraseña es requerida.</p>
          }

          <div class="actions">
            <a [routerLink]="['/recuperar']" class="link">¿Olvidaste tu contraseña?</a>
            <button type="submit" class="btn-brand btn-brand--lg btn-brand--block" [disabled]="form.invalid || loading()">
              Iniciar sesión
            </button>
          </div>

          @if (error()) {
            <p class="error" aria-live="assertive">{{ error() }}</p>
          }
        </form>
      </div>
    </section>
  `,
  styles: [
    `
    :host { display: contents; }
    .login-wrapper {
      position: relative;
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 1rem;
      background-image: url('/assets/bg-login.jpg');
      background-size: cover;
      background-position: center;
    }
    .login-wrapper::before {
      position: fixed;
      inset: 0;
      background-image: url('/assets/bg-login.jpg');
      background-size: cover;
      background-position: center;
      filter: blur(10px); /* Blur only the background layer */
      z-index: -1;
      transform: scale(1.05); /* reduce edge cropping from blur */
    }
    .panel {
      width: min(560px, 100%);
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 10px 25px rgba(0,0,0,.06);
      padding: 1.5rem;
      /* filter: blur(20px);
      backdrop-filter: blur(10px) saturate(180%);
      border: 1px solid rgba(255,255,255,.3); */
    }
    .brand-bar {
      margin: -1.5rem -1.5rem 1rem;
      padding: .9rem 1.5rem;
      border-radius: 20px 20px 0 0;
      background: linear-gradient(90deg, var(--brand-bar-end), var(--brand-bar-start));
      display: flex; align-items: center; justify-content: center;
    }
    .login-logo { filter: drop-shadow(0 1px 3px rgba(0,0,0,.35)); }

    .header { text-align: left; margin-top: 1.25rem; }
    .title { margin: 0; font-size: 1.5rem; color: var(--brand-800); font-weight: 800; }
    .subtitle { margin: .25rem 0 0; color: #4b5563; }

    .form { display: grid; gap: 1rem; margin-top: 1.25rem; }
    .field { display: grid; gap: .5rem; }
    .label { font-weight: 600; color: #0f172a; }
    input[type="text"], input[type="password"] {
      height: 48px;
      border-radius: 999px;
      border: 1px solid #e5e7eb;
      padding: 0 1rem;
      font-size: 1rem;
      background: #f8fafc;
      outline: none;
      transition: border-color .2s, box-shadow .2s, background .2s;
    }
    input::placeholder { color: #cbd5e1; }
    input:focus { border-color: var(--brand-500); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-500) 20%, transparent); background: #fff; }

    .actions { display: grid; gap: .75rem; }
    .link { color: var(--brand-700); text-decoration: none; font-weight: 600; justify-self: start; }
    .link:hover { text-decoration: underline; }
    /* Button styles now provided globally via .btn-brand */

    .error { color: #b00020; font-size: .9rem; margin: 0; }
  `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly authApi = inject(AutenticacionService);

  protected readonly loading = signal(false);
  protected readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    usuario: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      const { usuario, password } = this.form.value;
      void usuario; void password;
      if (this.error()) this.error.set('');
    });
  }

  async onSubmit() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    const { usuario, password } = this.form.getRawValue();

    void Swal.fire({
      title: 'Iniciando sesión',
      text: 'Por favor espera...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const result = await this.auth.login(usuario, password);
      Swal.close();
      this.loading.set(false);
      if (result.ok) {
        const ruta = this.authApi.getRutaInicialPorRol();
        this.router.navigateByUrl(ruta || '/dashboard');
      } else {
        const message = result.message || 'No se pudo iniciar sesión. Intenta de nuevo.';
        this.error.set(message);
        await Swal.fire({
          icon: 'error',
          title: 'No se pudo iniciar sesión',
          text: message,
          confirmButtonText: 'Entendido',
        });
      }
    } catch {
      Swal.close();
      this.loading.set(false);
      const message = 'No se pudo iniciar sesión. Intenta de nuevo.';
      this.error.set(message);
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo iniciar sesión',
        text: message,
        confirmButtonText: 'Entendido',
      });
    }
  }
}
