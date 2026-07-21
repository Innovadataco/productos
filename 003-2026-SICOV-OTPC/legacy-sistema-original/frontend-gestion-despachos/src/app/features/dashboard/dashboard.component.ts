import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ChangePasswordComponent } from '../auth/change-password.component';
import { AuthService } from '../../core/auth.service';
import { AutenticacionService } from '../../core/autenticacion.service';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="layout">
      <aside class="sidebar" [class.open]="sidebarOpen()">
        <app-sidebar></app-sidebar>
      </aside>
      <main class="content">
        <header class="topbar d-flex align-items-center justify-content-between mb-3">
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-outline-secondary d-lg-none" (click)="toggleSidebar()" aria-label="Abrir menú">
              <i class="bi bi-list"></i>
            </button>
            <!-- <h2 class="m-0">Dashboard</h2> -->
          </div>
          <div class="d-flex align-items-center gap-2 ms-auto">
            <div class="text-end d-none d-sm-block">
              <div class="fw-semibold">{{ nombreUsuario() }}</div>
              <small class="text-muted">{{ nombreRol() }}</small>
            </div>
            <div class="dropdown">
              <button class="btn btn-light rounded-circle d-inline-flex align-items-center justify-content-center" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Menú de usuario" style="width:40px;height:40px">
                <i class="bi bi-person-circle fs-5"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                <li>
                  <button class="dropdown-item" (click)="cambiarContrasena()">
                    <i class="bi bi-key me-2"></i>Cambio de contraseña
                  </button>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <button class="dropdown-item text-danger" (click)="logout()">
                    <i class="bi bi-box-arrow-right me-2"></i>Cerrar sesión
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </header>
        <section class="inner">
          <router-outlet></router-outlet>
        </section>
      </main>
      <button class="backdrop d-lg-none" *ngIf="sidebarOpen()" (click)="toggleSidebar()" aria-label="Cerrar menú"></button>
    </div>
    <app-change-password [open]="changePwdOpen()" (closed)="closeChangePassword()"></app-change-password>
  `,
  styles: [
    `
  .layout { display: grid; grid-template-columns: 260px 1fr; min-height: 100dvh; }
  .sidebar { padding: 0; position: sticky; top: 0; align-self: start; height: 100dvh; }
    .content { padding: 1rem; }
    .topbar { border-bottom: 2px solid #e9ecef; border-radius: 16px; background: #fff; }
    .inner { background: #fff; border-radius: 12px; padding: 1rem; box-shadow: 0 6px 18px rgba(0,0,0,.06); }

    /* Responsive: mostrar sidebar como offcanvas en móvil */
    @media (max-width: 991.98px) {
      .layout { grid-template-columns: 1fr; }
  .sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 280px; height: 100dvh; z-index: 1040; transform: translateX(-100%); transition: transform .2s ease; padding: 0; }
      .sidebar.open { transform: translateX(0); }
      .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); border: 0; padding: 0; margin: 0; z-index: 1030; }
    }
  `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AutenticacionService);
  protected readonly sidebarOpen = signal(false);
  protected readonly changePwdOpen = signal(false);

  protected readonly nombreUsuario = computed(() => {
    const u = this.authApi.getUsuario();
    return u ? `${u.nombre}`.trim() || u.usuario : '';
  });

  protected readonly nombreRol = computed(() => this.authApi.getRol()?.nombre ?? '');

  logout() {
    this.auth.logout();
  }

  cambiarContrasena() { this.changePwdOpen.set(true); }
  closeChangePassword() { this.changePwdOpen.set(false); }

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }
}
