import { Injectable, inject } from '@angular/core';
import { AutenticacionService } from '../../core/autenticacion.service';
import { extraerNitEmpresa } from '../../core/usuario.util';
import { Usuario, Rol } from '../../core/models/auth.models';

@Injectable({ providedIn: 'root' })
export class ServicioLocalStorage {
  private readonly auth = inject(AutenticacionService);

  obtenerUsuario(): Usuario | null {
    return this.auth.getUsuario();
  }

  /** NIT de la empresa transporte (campo `nit` del login, no el usuario de acceso). */
  obtenerNitEmpresa(): string {
    return extraerNitEmpresa(this.obtenerUsuario());
  }

  obtenerRol(): Rol | null {
    return this.auth.getRol();
  }
}
