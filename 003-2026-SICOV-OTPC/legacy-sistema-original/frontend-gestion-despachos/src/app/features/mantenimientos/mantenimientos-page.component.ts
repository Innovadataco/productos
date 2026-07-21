import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PreventivosComponent } from './preventivos/preventivos.component';
import { CorrectivosComponent } from './correctivos/correctivos.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { ServicioLocalStorage } from '../../administrador/servicios/local-storage.service';
import { Usuario, Rol } from '../../core/models/auth.models';

@Component({
  selector: 'app-mantenimientos-page',
  template: `
    <div class="container-fluid py-3">
      <app-page-header [title]="'Mantenimientos'" [subtitle]="'Gestión de mantenimientos preventivos y correctivos.'" [usuarioInput]="usuario()" />

      <div class="card shadow-sm">
        <div class="card-header bg-white border-1 pb-0">
          <ul class="nav nav-tabs" role="tablist">
            <li class="nav-item" role="presentation">
              <button class="nav-link active" id="tab-preventivos" data-bs-toggle="tab" data-bs-target="#pane-preventivos" type="button" role="tab" aria-controls="pane-preventivos" aria-selected="true">
                <i class="bi bi-tools me-1"></i> Preventivos
              </button>
            </li>
            <li class="nav-item" role="presentation">
              <button class="nav-link" id="tab-correctivos" data-bs-toggle="tab" data-bs-target="#pane-correctivos" type="button" role="tab" aria-controls="pane-correctivos" aria-selected="false">
                <i class="bi bi-wrench-adjustable me-1"></i> Correctivos
              </button>
            </li>
          </ul>
        </div>
        <div class="card-body tab-content">
          <div id="pane-preventivos" class="tab-pane fade show active" role="tabpanel" aria-labelledby="tab-preventivos">
              <app-preventivos-view></app-preventivos-view>
          </div>
          <div id="pane-correctivos" class="tab-pane fade" role="tabpanel" aria-labelledby="tab-correctivos">
            <app-correctivos-view></app-correctivos-view>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `:host{display:block;}`,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PreventivosComponent, CorrectivosComponent, PageHeaderComponent],
})
export class MantenimientosPageComponent {
  private readonly storage = inject(ServicioLocalStorage);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly usuario = signal<Usuario | null>(null);
  protected readonly rol = signal<Rol | null>(null);

  constructor() {
    this.rol.set(this.storage.obtenerRol());
    this.usuario.set(this.storage.obtenerUsuario());

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const rawUsuario = params.get('usuario');
      console.log('Parametro usuario recibido en la ruta:', rawUsuario);
      if (!rawUsuario) return;
      try {
        const parsed = JSON.parse(rawUsuario) as Usuario;
        this.usuario.set(parsed);
      } catch {
        console.warn('No se pudo interpretar el usuario recibido en la ruta.');
      }
    });
  }
}
