import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AutenticacionService } from './autenticacion.service';
import { IniciarSesionRespuesta } from './models/auth.models';
import { normalizarUsuarioSesion } from './usuario.util';
import { firstValueFrom } from 'rxjs';

export type User = { username: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly authApi = inject(AutenticacionService);

  private readonly userSig = signal<User | null>(null);
  readonly user: Signal<User | null> = this.userSig.asReadonly();
  readonly isAuthenticated = computed(() => this.userSig() !== null);

  constructor() {
    const raw = localStorage.getItem('auth:user');
    if (raw) {
      try {
        const stored = JSON.parse(raw) as Partial<User> & { email?: string };
        const username = stored?.username ?? stored?.email;
        if (username) {
          this.userSig.set({ username });
          if (!stored.username) {
            localStorage.setItem('auth:user', JSON.stringify({ username } satisfies User));
          }
        } else {
          localStorage.removeItem('auth:user');
        }
      } catch {
        localStorage.removeItem('auth:user');
      }
    }
  }

  async login(username: string, password: string): Promise<{ ok: boolean; message?: string }> {
    if (!username || !password) {
      return { ok: false, message: 'Debes ingresar usuario y contraseña.' };
    }
    let resp: IniciarSesionRespuesta | null = null;
    try {
      resp = await firstValueFrom(this.authApi.iniciarSesion(username, password));
    } catch (error) {
      return { ok: false, message: this.getErrorMessage(error) };
    }
    if (!resp || !resp.token) {
      return { ok: false, message: 'No se pudo iniciar sesión. Intenta de nuevo.' };
    }
    // Guardar información en storage para Sidebar/rutas
    const usuarioNormalizado = normalizarUsuarioSesion(resp.usuario as object);
    this.authApi.guardarInformacionInicioSesion(
      resp.token,
      resp.tokenExterno,
      resp.rol as unknown as object,
      usuarioNormalizado,
      resp.aplicativos as unknown as object,
      (resp.modulos && resp.modulos.length ? resp.modulos : resp.rol?.modulos) as unknown as object
    );
    const u = { username: usuarioNormalizado.usuario } satisfies User;
    this.userSig.set(u);
    localStorage.setItem('auth:user', JSON.stringify(u));
    return { ok: true };
  }

  async recover(usuario: string, correo: string): Promise<boolean> {
    if (!usuario || !correo) return false;
    try {
      await firstValueFrom(this.authApi.recuperarContrasena({ usuario: String(usuario).trim(), correo: String(correo).trim() }));
      return true;
    } catch {
      return false;
    }
  }

  logout(): void {
    this.userSig.set(null);
    localStorage.removeItem('auth:user');
    this.authApi.cerrarSesion();
    this.router.navigate(['/login']);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error;
      if (typeof payload === 'string' && payload.trim()) {
        return payload.trim();
      }
      if (payload && typeof payload === 'object' && 'message' in payload) {
        const maybeMessage = (payload as { message?: unknown }).message;
        if (maybeMessage) return String(maybeMessage);
      }
      if (error.message) return error.message;
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }
}
