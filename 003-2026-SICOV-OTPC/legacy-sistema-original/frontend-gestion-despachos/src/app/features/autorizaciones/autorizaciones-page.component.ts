import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

import { ServicioLocalStorage } from '../../administrador/servicios/local-storage.service';
import { Usuario, Rol } from '../../core/models/auth.models';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { AutorizacionesService } from './autorizaciones.service';
import { AutorizacionRegistro } from './autorizaciones.models';
import { AutorizacionesFormComponent, AutorizacionFormContext } from './autorizaciones-form.component';
import { AutorizacionesHistorialComponent } from './autorizaciones-historial.component';
import { PaginatorComponent } from '../../shared/ui/paginator.component';

@Component({
  selector: 'app-autorizaciones-page',
  template: `
    <div class="container-fluid py-3">
      <app-page-header [title]="'Autorizaciones'" [subtitle]="'Gestión de solicitudes y registros de autorización.'" [usuarioInput]="usuario()" />

      <section class="card border-1 shadow-sm">
        <div class="card-body d-grid gap-3">
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Vehículos</h5>
            @if (rangoActual().total) {
              <div class="text-muted small">Mostrando {{ rangoActual().desde }}–{{ rangoActual().hasta }} de {{ rangoActual().total }}</div>
            }
          </div>

          <div class="d-flex justify-content-end">
            <div class="input-group input-group-sm" style="max-width: 320px;">
              <input type="search" class="form-control" placeholder="Placa, fecha o estado" [value]="filtro()" (input)="onFilterChange($event)" />
              <button type="button" class="btn-outline-brand btn-brand--sm" (click)="limpiarFiltro()" [disabled]="!filtro()">Limpiar</button>
            </div>
          </div>

          <div class="table-responsive border rounded">
            <table class="table align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th style="width: 60px;">#</th>
                  <th>Placa</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th class="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @if (registrosLoading()) {
                  <tr>
                    <td colspan="5" class="text-center py-4">
                      <div class="spinner-border text-primary" role="status" aria-label="Cargando registros"></div>
                    </td>
                  </tr>
                } @else if (registrosError()) {
                  <tr>
                    <td colspan="5" class="text-center py-4 text-danger">{{ registrosError() }}</td>
                  </tr>
                } @else if (!registros().length && !registrosError()) {
                  <tr>
                    <td colspan="5" class="text-center text-muted py-4">No hay vehículos disponibles.</td>
                  </tr>
                } @else if (!registrosFiltrados().length) {
                  <tr>
                    <td colspan="5" class="text-center text-muted py-4">Sin resultados</td>
                  </tr>
                } @else {
                  @for (registro of registrosPaginados(); track registro.placa ?? ($index + 1); let idx = $index) {
                    <tr>
                      <td>{{ (page() - 1) * pageSize() + idx + 1 }}</td>
                      <td class="fw-semibold">{{ registro.placa }}</td>
                      <td>{{ fechaLegible(registro.fechaDiligenciamiento) }}</td>
                      <td>{{ registro.estadoMantenimiento }}</td>
                      <td class="text-end d-flex justify-content-end gap-2">
                        @if (!isSupervisor()) {
                          <button class="btn-brand btn-brand--sm" type="button" (click)="abrirFormularioNuevo(registro)">
                            <i class="bi bi-plus-lg"></i> Registrar autorización
                          </button>
                        }
                        <button class="btn-outline-brand btn-brand--sm" type="button" (click)="abrirHistorial(registro)">
                          <i class="bi bi-clock-history"></i> Historial
                        </button>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          @if (registrosFiltrados().length) {
            <div class="d-flex justify-content-between align-items-center">
              <small class="text-muted">Mostrando {{ rangoActual().desde }}–{{ rangoActual().hasta }} de {{ rangoActual().total }}</small>
              <app-paginator
                [page]="page()"
                [total]="registrosFiltrados().length"
                [pageSize]="pageSize()"
                [showSummary]="false"
                storageKey="autorizaciones_registros"
                (pageChange)="page.set($event)"
                (pageSizeChange)="pageSize.set($event)"
              />
            </div>
          }
        </div>
      </section>

      <app-modal [open]="formAbierto()" [title]="formTitulo()" size="xl" (closed)="cerrarFormulario()" [optionalData]="true">
        @if (formAbierto() && formContext()) {
          <app-autorizaciones-form
            [context]="formContext()!"
            (saved)="onFormSaved()"
            (cancel)="cerrarFormulario()"
          />
        } @else {
          <div class="py-5 text-center text-muted">Selecciona un registro para continuar.</div>
        }
      </app-modal>

      <app-modal [open]="historialAbierto()" [title]="'Historial de autorizaciones - '+ historialPlaca()" size="xxl" (closed)="cerrarHistorial()">
        <app-autorizaciones-historial
          [records]="historial()"
          [placa]="historialPlaca()"
          [loading]="historialLoading()"
          [exportUrl]="historialExport()"
        />
      </app-modal>
    </div>
  `,
  styles: [
    `:host{display:block;}`,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, ModalComponent, AutorizacionesFormComponent, AutorizacionesHistorialComponent, PaginatorComponent],
})
export class AutorizacionesPageComponent {
  private readonly storage = inject(ServicioLocalStorage);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(AutorizacionesService);

  protected readonly usuario = signal<Usuario | null>(null);
  protected readonly rol = signal<Rol | null>(null);
  protected readonly registros = signal<AutorizacionRegistro[]>([]);
  protected readonly registrosLoading = signal(false);
  protected readonly registrosError = signal<string | null>(null);
  protected readonly filtro = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(5);

  protected readonly historial = signal<any[]>([]);
  protected readonly historialLoading = signal(false);
  protected readonly historialPlaca = signal('');
  protected readonly historialExport = signal<string | null>(null);
  protected readonly historialAbierto = signal(false);

  protected readonly formContext = signal<AutorizacionFormContext | null>(null);
  protected readonly formAbierto = signal(false);
  protected readonly formTitulo = signal('Registrar autorización');

  private readonly fechaFormatter = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  constructor() {
    this.rol.set(this.storage.obtenerRol());
    this.usuario.set(this.storage.obtenerUsuario());

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const rawUsuario = params.get('usuario');
      if (!rawUsuario) return;
      try {
        const parsed = JSON.parse(rawUsuario) as Usuario;
        this.usuario.set(parsed);
      } catch {
        console.warn('No se pudo interpretar el usuario recibido en la ruta.');
      }
    });

    // cargar registros al tener usuario
    this.route.queryParamMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => {
          const v = this.usuario()?.usuario;
          if (!v) return of([]);
          this.registrosLoading.set(true);
          return this.service
            .listarRegistros(v, this.rol()?.id)
            .pipe(finalize(() => this.registrosLoading.set(false)));
        })
      )
      .subscribe({
        next: (lista) => {
          this.registrosError.set(null);
          this.registros.set(Array.isArray(lista) ? lista : []);
        },
        error: (err) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            const msg = (err.error?.mensaje ?? err.message ?? 'Acceso no autorizado').toString();
            this.registrosError.set(msg);
            this.registros.set([]);
          } else {
            this.registrosError.set(null);
          }
        }
      });
  }

  protected readonly isSupervisor = computed(() => this.rol()?.id === 1);
  protected readonly registrosFiltrados = computed(() => {
    const term = this.filtro().trim().toLowerCase();
    const lista = this.registros();
    if (!term) return lista;
    const toText = (v: unknown) => String(v ?? '').toLowerCase();
    return lista.filter((r) => [r.placa, this.fechaLegible(r.fechaDiligenciamiento), r.estadoMantenimiento].some((f) => toText(f).includes(term)));
  });
  protected readonly registrosPaginados = computed(() => {
    const size = Math.max(1, this.pageSize());
    const start = (this.page() - 1) * size;
    return this.registrosFiltrados().slice(start, start + size);
  });
  protected readonly totalPaginas = computed(() => {
    const size = Math.max(1, this.pageSize());
    return Math.max(1, Math.ceil(this.registrosFiltrados().length / size));
  });
  protected readonly rangoActual = computed(() => {
    const total = this.registrosFiltrados().length;
    if (!total) return { desde: 0, hasta: 0, total };
    const size = Math.max(1, this.pageSize());
    const desde = (this.page() - 1) * size + 1;
    const hasta = Math.min(desde + size - 1, total);
    return { desde, hasta, total };
  });

  onFilterChange(e: Event) { this.filtro.set((e.target as HTMLInputElement).value ?? ''); this.page.set(1); }
  limpiarFiltro() { this.filtro.set(''); this.page.set(1); }
  paginaAnterior() { if (this.page() > 1) this.page.set(this.page() - 1); }
  paginaSiguiente() { if (this.page() < this.totalPaginas()) this.page.set(this.page() + 1); }

  fechaLegible(d?: string) { return d ? this.fechaFormatter.format(new Date(d)) : '-'; }

  abrirFormularioNuevo(registro: AutorizacionRegistro) {
    const v = this.usuario()?.usuario;
    if (!v) return;
    this.formContext.set({ vigiladoId: v, placa: registro.placa ?? '', editar: false });
    this.formTitulo.set('Registrar autorización');
    this.formAbierto.set(true);
  }

  cerrarFormulario() { this.formAbierto.set(false); this.formContext.set(null); }

  onFormSaved() {
    this.cerrarFormulario();
    this.refrescarRegistros();
  }

  abrirHistorial(registro: AutorizacionRegistro) {
    const v = this.usuario()?.usuario; if (!v) return;
    this.historialPlaca.set(registro.placa ?? '');
    this.historialExport.set(this.service.exportarHistorial(v, registro.placa ?? ''));
    this.historialLoading.set(true);
    this.service.listarHistorial(v, registro.placa ?? '').pipe(finalize(() => this.historialLoading.set(false))).subscribe((res) => {
      this.historial.set(Array.isArray(res) ? res : []);
      this.historialAbierto.set(true);
    });
  }

  cerrarHistorial() { this.historialAbierto.set(false); this.historial.set([]); this.historialPlaca.set(''); this.historialExport.set(null); }

  private refrescarRegistros() {
    const v = this.usuario()?.usuario; if (!v) return;
    this.registrosLoading.set(true);
    this.service
      .listarRegistros(v, this.rol()?.id)
      .pipe(finalize(() => this.registrosLoading.set(false)))
      .subscribe({
        next: (lista) => {
          this.registrosError.set(null);
          this.registros.set(Array.isArray(lista) ? lista : []);
        },
        error: (err) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            const msg = (err.error?.mensaje ?? err.message ?? 'Acceso no autorizado').toString();
            this.registrosError.set(msg);
            this.registros.set([]);
          } else {
            this.registrosError.set(null);
          }
        }
      });
  }
}
