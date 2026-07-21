import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AutenticacionService } from '../../core/autenticacion.service';
import { Modulo } from '../../core/models/auth.models';

@Component({
  selector: 'app-sidebar',
  template: `
    <div class="sidebar-shell text-light">
      <div class="brand-bar d-flex align-items-center justify-content-center" aria-hidden="true">
        <img ngSrc="assets/topbar-logo.png" width="240" height="50" alt="Expreso Brasilia" priority />
      </div>
      <nav aria-label="Menú principal" class="p-2">
        <!-- Inicio (sin etiqueta) -->
        <ul class="list-unstyled d-grid gap-1 mb-2" *ngIf="moduloInicio">
          <li>
            <a [routerLink]="[moduloInicio!.ruta]" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
               class="d-flex align-items-center gap-2 text-decoration-none text-light px-2 py-2 rounded item">
              <i class="bi" [ngClass]="iconoModule(moduloInicio!.icono)"></i>
              <span class="fw-semibold">{{ moduloInicio!.nombreMostrar || moduloInicio!.nombre }}</span>
            </a>
          </li>
        </ul>

        <!-- Módulos generales (etiqueta) -->
        <div *ngIf="modulosGeneralesSinInicio.length" class="section-label text-uppercase small text-white-50 px-2 mb-1">Módulos SICOV</div>
        <ul class="list-unstyled d-grid gap-1 mb-3" *ngIf="modulosGeneralesSinInicio.length">
          <li *ngFor="let m of modulosGeneralesSinInicio">
            <a [routerLink]="[m.ruta]" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
               class="d-flex align-items-center gap-2 text-decoration-none text-light px-2 py-2 rounded item">
              <i class="bi" [ngClass]="iconoModule(m.icono)"></i>
              <span class="fw-semibold">{{ m.nombreMostrar || m.nombre }}</span>
            </a>
            <ul class="list-unstyled ps-4 mt-1" *ngIf="m.submodulos.length">
              <li *ngFor="let s of m.submodulos">
                <a [routerLink]="[s.ruta]" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
                   class="d-block text-decoration-none text-white-50 px-2 py-1 rounded subitem">
                  <i class="bi bi-chevron-right me-1"></i>{{ s.nombreMostrar || s.nombre }}
                </a>
              </li>
            </ul>
          </li>
        </ul>

        <!-- Sección de administración (solo si hay módulos admin, p. ej. Usuarios) -->
        <section *ngIf="modulosAdmin.length" aria-label="Administración" class="mt-2">
          <div class="section-label text-uppercase small text-white-50 px-2 mb-1">Administración</div>
          <ul class="list-unstyled d-grid gap-1 mb-0">
            <li *ngFor="let m of modulosAdmin">
              <a [routerLink]="[m.ruta]" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
                 class="d-flex align-items-center gap-2 text-decoration-none text-light px-2 py-2 rounded item">
                <i class="bi" [ngClass]="iconoModule(m.icono)"></i>
                <span class="fw-semibold">{{ m.nombreMostrar || m.nombre }}</span>
              </a>
              <ul class="list-unstyled ps-4 mt-1" *ngIf="m.submodulos.length">
                <li *ngFor="let s of m.submodulos">
                  <a [routerLink]="[s.ruta]" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
                     class="d-block text-decoration-none text-white-50 px-2 py-1 rounded subitem">
                    <i class="bi bi-chevron-right me-1"></i>{{ s.nombreMostrar || s.nombre }}
                  </a>
                </li>
              </ul>
            </li>
          </ul>
        </section>
      </nav>
    </div>
  `,
  styles: [
    `
    :host { display: block; }
    .sidebar-shell { height: 100dvh; background: linear-gradient(180deg, var(--brand-800), var(--brand-900)); border-radius: 0; overflow: auto; }
    .brand-bar { padding: .75rem 1rem; background: linear-gradient(90deg, var(--brand-bar-end), var(--brand-bar-start)); }
    .brand-bar img { filter: drop-shadow(0 1px 3px rgba(0,0,0,.35)); }
    .item:hover, .subitem:hover { background: rgba(255,255,255,.08); }
    .active { background: rgba(255,255,255,.12) !important; }
    @media (max-width: 991.98px) {
      .sidebar-shell { height: 100dvh; border-radius: 0; }
    }
  `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SidebarComponent implements OnInit {
  private readonly auth = inject(AutenticacionService);
  private readonly router = inject(Router);

  modulos: Modulo[] = [];
  modulosGenerales: Modulo[] = [];
  modulosAdmin: Modulo[] = [];
  moduloInicio: Modulo | null = null;
  modulosGeneralesSinInicio: Modulo[] = [];

  //iconoModulo = (icono?: string) => (icono?.startsWith('bi-') ? icono : 'bi-grid');

  ngOnInit(): void {
    this.modulos = this.auth.getModulos();
    // Si no hay módulos, garantizamos al menos el acceso a /dashboard
    if (!this.modulos?.length) {
      this.modulos = [
        {
          id: 'default',
          nombre: 'Dashboard',
          nombreMostrar: 'Dashboard',
          ruta: '/dashboard',
          icono: 'dashboard',
          estado: true,
          creacion: new Date(),
          actualizacion: new Date(),
          submodulos: [],
        },
      ];
    }

    // Ordenar módulos y submódulos por id ascendente
    this.modulos = this.sortById(this.modulos).map((m) => ({
      ...m,
      submodulos: this.sortById(m.submodulos ?? []),
    }));

    // Dividir módulos: generales vs administración
    this.modulosGenerales = this.modulos.filter((m) => !this.esModuloUsuarios(m));
    this.modulosAdmin = this.modulos.filter((m) => this.esModuloUsuarios(m));

    // Detectar módulo Inicio (ruta '/dashboard' exacta)
    this.moduloInicio = this.modulosGenerales.find(m => this.esInicio(m)) || null;
    this.modulosGeneralesSinInicio = this.sortById(
      this.modulosGenerales.filter(m => !this.esInicio(m))
    );

    // Asegurar orden en sección Administración también
    this.modulosAdmin = this.sortById(this.modulosAdmin).map((m) => ({
      ...m,
      submodulos: this.sortById(m.submodulos ?? []),
    }));
  }

  iconoModule(icono?: string): string {
    return icono?.startsWith('bi-') ? icono : 'bi-grid';
  }

  private esModuloUsuarios(m: Modulo): boolean {
    const ruta = (m.ruta || '').toLowerCase();
    const nombre = (m.nombre || m.nombreMostrar || '').toLowerCase();
    return ruta.endsWith('/usuarios') || nombre.includes('usuario');
  }

  private esInicio(m: Modulo): boolean {
    const ruta = (m.ruta || '').toLowerCase();
    return ruta === '/dashboard' || ruta === '/dashboard/inicio';
  }

  // Utilidad: convierte id string/number a número para ordenar; no numéricos al final
  private idToNumber(id: string | number): number {
    const n = typeof id === 'number' ? id : Number(id);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  }

  private sortById<T extends { id: string | number }>(arr: T[]): T[] {
    return [...arr].sort((a, b) => this.idToNumber(a.id) - this.idToNumber(b.id));
  }
}
