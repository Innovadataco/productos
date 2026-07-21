import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { ServicioLocalStorage } from '../../administrador/servicios/local-storage.service';
import { extraerNombreUsuario } from '../../core/usuario.util';
import { Usuario, Rol } from '../../core/models/auth.models';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { PaginatorComponent } from '../../shared/ui/paginator.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { SalidasNovedadModalComponent } from './salidas-novedad-modal.component';
import { SalidasNovedadesHistorialComponent } from './salidas-novedades-historial.component';
import { SalidasContinuarRegistroModalComponent } from './salidas-continuar-registro-modal.component';
import Swal from 'sweetalert2';
import { SalidasService } from './salidas.service';
import { Salida } from './salidas.models';
import { etiquetaFuenteDato } from '../../shared/fuente-dato.util';

@Component({
  selector: 'app-salidas-page',
  template: `
    <div class="container-fluid py-3">
      <app-page-header [title]="'Salidas'" [subtitle]="'Gestión de despachos, novedades y registro de salidas.'" [usuarioInput]="usuario()" />

      <section class="card border-1 shadow-sm">
        <div class="card-body d-grid gap-3">
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Listado de salidas</h5>
            <!-- @if (rangoActual().total) {
              <div class="text-muted small">Mostrando {{ rangoActual().desde }}–{{ rangoActual().hasta }} de {{ rangoActual().total }}</div>
            } -->
          </div>

          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <button class="btn-brand btn-brand--sm" type="button" (click)="nuevoRegistro()">
              <i class="bi bi-plus-lg"></i> Registrar salida
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="refrescar()" [disabled]="loading()">
              <i class="bi bi-arrow-clockwise me-1"></i> Actualizar listado
            </button>
          </div>

          <div class="filtros-panel border rounded p-3 d-grid gap-3 bg-light-subtle">

            <div class="row g-2 align-items-end">
              <div class="col-12">
                <span class="filtros-panel__label">Filtros</span>
              </div>
              <div class="col-12 col-md-5 col-lg-4">
                <label class="form-label form-label-sm mb-1" for="filtroLocal">Buscar</label>
                <input
                  id="filtroLocal"
                  type="search"
                  class="form-control form-control-sm"
                  placeholder="Placa, estado o fuente dato"
                  [value]="filtroLocal()"
                  (input)="onFiltroLocal($event)"
                />
              </div>
              <div class="col-6 col-md-3 col-lg-2">
                <label class="form-label form-label-sm mb-1" for="filtroFechaLocal">Fecha salida</label>
                <input
                  id="filtroFechaLocal"
                  type="date"
                  class="form-control form-control-sm"
                  [value]="filtroFechaLocal()"
                  (input)="onFiltroFechaLocal($event)"
                />
              </div>
              <div class="col-6 col-md-auto">
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm w-100 w-md-auto"
                  (click)="limpiarFiltros()"
                  [disabled]="!filtroLocal() && !filtroFechaLocal()"
                >
                  <i class="bi bi-x-lg me-1"></i> Limpiar
                </button>
              </div>
            </div>
          </div>

          @if (empresaResumen().nit || empresaResumen().razonSocial) {
            <div class="empresa-resumen border rounded px-3 py-2 d-flex flex-wrap gap-3 align-items-center bg-white">
              @if (empresaResumen().razonSocial) {
                <div>
                  <span class="text-muted small d-block">Razón social</span>
                  <span class="fw-semibold">{{ empresaResumen().razonSocial }}</span>
                </div>
              }
              @if (empresaResumen().nit) {
                <div>
                  <span class="text-muted small d-block">NIT</span>
                  <span class="fw-semibold">{{ empresaResumen().nit }}</span>
                </div>
              }
            </div>
          }

          <div class="table-responsive border rounded">
            <table class="table align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th style="width:60px;">#</th>
                  <th>Placa</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Pasajeros</th>
                  <th>Fuente dato</th>
                  <th>Estado</th>
                  <th class="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @if (loading()) {
                  <tr>
                    <td colspan="8" class="text-center py-4">
                      <div class="spinner-border text-primary" role="status" aria-label="Cargando"></div>
                    </td>
                  </tr>
                } @else if (errorMensaje()) {
                  <tr>
                    <td colspan="8" class="text-center py-4 text-danger">{{ errorMensaje() }}</td>
                  </tr>
                } @else if (!registros().length) {
                  <tr>
                    <td colspan="8" class="text-center text-muted py-4">No hay salidas registradas.</td>
                  </tr>
                } @else if (!registrosFiltrados().length) {
                  <tr>
                    <td colspan="8" class="text-center text-muted py-4">Sin resultados</td>
                  </tr>
                } @else {
                  @for (r of registrosPaginados(); track r.id ?? $index; let i = $index) {
                    <tr>
                      <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
                      <td>{{ r.placa || '-' }}</td>
                      <td>{{ r.fechaSalida!.split('T')[0] | date : 'dd/MM/yyyy' }}</td>
                      <td>{{ r.horaSalida || '-' }}</td>
                      <td>{{ r.numeroPasajero ?? '-' }}</td>
                      <td>{{ etiquetaFuenteDato(r.fuenteDato) }}</td>
                      <td>
                        <span class="badge" [class.text-bg-success]="(r['llegadas']?.length ?? 0) > 0" [class.text-bg-warning]="!(r['llegadas']?.length ?? 0)">{{ (r['llegadas']?.length ?? 0) > 0 ? 'Finalizado' : 'Iniciado' }}</span>
                      </td>
                      <td class="text-end align-middle">
                        <div class="d-flex gap-2 justify-content-end align-items-center">
                          <button class="btn btn-brand btn-sm" type="button" [disabled]="!r.id" (click)="abrirNovedad(r)">
                            <i class="bi bi-clipboard2-plus"></i> Registrar novedad
                          </button>
                          <button class="btn btn-outline-brand btn-sm" type="button" [disabled]="!r.id" (click)="abrirHistorial(r)">
                            <i class="bi bi-card-list"></i> Historial
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          @if (registrosFiltrados().length) {
            <div class="d-flex justify-content-between align-items-center">
              <div></div>
              <!-- <small class="text-muted">Mostrando {{ rangoActual().desde }}–{{ rangoActual().hasta }} de {{ rangoActual().total }}</small> -->
              <app-paginator
                [page]="page()"
                [total]="registrosFiltrados().length"
                [pageSize]="pageSize()"
                storageKey="salidas_registros"
                (pageChange)="page.set($event)"
                (pageSizeChange)="pageSize.set($event)"
              />
            </div>
          }
        </div>
      </section>

      <app-modal [open]="registroAbierto()" title="Registrar salida completa" size="xl" (closed)="cerrarRegistro()">
        @if (registroAbierto()) {
          <app-salidas-continuar-registro-modal
            [nit]="nitEmpresa()"
            [razonSocial]="razonSocialUsuario()"
            [placaInicial]="consultaPlaca()"
            (cerrar)="cerrarRegistro()"
            (finalizado)="onRegistroFinalizado($event)"
          />
        }
      </app-modal>

      <app-modal [open]="novedadAbierta()" title="Registrar novedad" size="xl" (closed)="onModalNovedadClosed()">
        @if (novedadAbierta() && salidaFocusId()) {
          <app-salidas-novedad-modal
            [idSalida]="salidaFocusId()!"
            [placaSalida]="salidaFocusPlaca() || ''"
            [nit]="nitEmpresa()"
            (guardado)="onNovedadGuardada()"
            (cerrar)="cerrarNovedad()"
          />
        } @else {
          <div class="py-5 text-center text-muted">Selecciona un despacho para continuar.</div>
        }
      </app-modal>

      <app-modal [open]="historialAbierto()" title="Historial de novedades" size="xl" (closed)="cerrarHistorial()">
        @if (historialAbierto() && salidaFocusId()) {
          <app-salidas-novedades-historial [idSalida]="salidaFocusId()!" />
        } @else {
          <div class="py-5 text-center text-muted">Selecciona un despacho para continuar.</div>
        }
      </app-modal>
    </div>
  `,
  styles: [
    `:host{display:block;}`,
    `.filtros-panel{background:var(--bs-light-bg-subtle,#f8f9fa);}`,
    `.filtros-panel__label{font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--bs-secondary-color);}`,
    `.form-label-sm{font-size:.8125rem;margin-bottom:.25rem;}`,
    `.empresa-resumen{border-color:var(--bs-border-color-translucent)!important;}`,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, PaginatorComponent, ModalComponent, SalidasNovedadModalComponent, SalidasNovedadesHistorialComponent, SalidasContinuarRegistroModalComponent, DatePipe],
})
export class SalidasPageComponent {
  private readonly storage = inject(ServicioLocalStorage);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(SalidasService);

  protected readonly usuario = signal<Usuario | null>(null);
  protected readonly rol = signal<Rol | null>(null);
  protected readonly registros = signal<Salida[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMensaje = signal<string | null>(null);
  protected readonly consultaPlaca = signal('');
  protected readonly consultaFechaSalida = signal('');
  protected readonly filtroLocal = signal('');
  protected readonly filtroFechaLocal = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(5);
  protected readonly registroAbierto = signal(false);
  protected readonly buscandoPlaca = signal(false);
  protected readonly novedadAbierta = signal(false);
  protected readonly historialAbierto = signal(false);
  protected readonly salidaFocusId = signal<number | null>(null);
  protected readonly salidaFocusPlaca = signal<string | null>(null);
  protected readonly novedadRegistrada = signal(false);

  private readonly fecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

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

    // Cargar salidas al tener usuario
    this.route.queryParamMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => {
          const nit = this.nitEmpresa();
          if (!nit) return of({ array_data: [] as Salida[] });
          this.loading.set(true);
          return this.service.listar(nit).pipe(finalize(() => this.loading.set(false)));
        })
      )
      .subscribe({
        next: (res) => {
          const lista = (res as { array_data?: Salida[] })?.array_data ?? [];
          this.errorMensaje.set(null);
          this.registros.set(lista);
        },
        error: (err) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            const msg = (err.error?.mensaje ?? err.message ?? 'Acceso no autorizado').toString();
            this.errorMensaje.set(msg);
            this.registros.set([]);
          } else {
            this.errorMensaje.set((err?.error?.mensaje ?? err?.message ?? 'No se pudo cargar el listado de salidas').toString());
            this.registros.set([]);
          }
        }
      });
  }

  protected readonly registrosFiltrados = computed(() => {
    const term = this.filtroLocal().trim().toLowerCase();
    const fechaFiltro = this.filtroFechaLocal().trim();
    const lista = this.registros();
    const toText = (v: unknown) => String(v ?? '').toLowerCase();

    const estadoTexto = (r: Salida) => ((r as any)['llegadas']?.length ?? 0) > 0 ? 'finalizado' : 'iniciado';
    const filtradosPorTexto = term
      ? lista.filter((r) => [
          r.placa,
          this.fechaLegible(r.fechaSalida),
          r.horaSalida,
          etiquetaFuenteDato(r.fuenteDato),
          estadoTexto(r),
          r.estado === false ? 'inactivo' : 'activo'
        ].some((f) => toText(f).includes(term)))
      : lista;

    if (!fechaFiltro) return filtradosPorTexto;
    const fechaSalidaISO = (v?: string | null) => (v ?? '').toString().split('T')[0];
    return filtradosPorTexto.filter((r) => fechaSalidaISO(r.fechaSalida) === fechaFiltro);
  });

  protected readonly registrosPaginados = computed(() => {
    const size = Math.max(1, this.pageSize());
    const start = (this.page() - 1) * size;
    return this.registrosFiltrados().slice(start, start + size);
  });

  protected readonly empresaResumen = computed(() => {
    const nit = this.nitEmpresa();
    const razonSocial =
      this.registros().find((r) => String(r.razonSocial ?? '').trim())?.razonSocial?.trim() ?? '';
    return { nit, razonSocial };
  });

  protected readonly rangoActual = computed(() => {
    const total = this.registrosFiltrados().length;
    if (!total) return { desde: 0, hasta: 0, total };
    const size = Math.max(1, this.pageSize());
    const desde = (this.page() - 1) * size + 1;
    const hasta = Math.min(desde + size - 1, total);
    return { desde, hasta, total };
  });

  fechaLegible(d?: string) { return d ? this.fecha.format(new Date(d)) : '-'; }
  protected readonly etiquetaFuenteDato = etiquetaFuenteDato;
  nitEmpresa(): string {
    return this.storage.obtenerNitEmpresa();
  }
  razonSocialUsuario(): string {
    return extraerNombreUsuario(this.usuario());
  }
  onConsultaPlaca(e: Event) {
    this.consultaPlaca.set(((e.target as HTMLInputElement).value ?? '').toUpperCase());
  }
  onConsultaFecha(e: Event) {
    this.consultaFechaSalida.set((e.target as HTMLInputElement).value ?? '');
  }
  onFiltroLocal(e: Event) {
    this.filtroLocal.set((e.target as HTMLInputElement).value ?? '');
    this.page.set(1);
  }
  onFiltroFechaLocal(e: Event) {
    this.filtroFechaLocal.set((e.target as HTMLInputElement).value ?? '');
    this.page.set(1);
  }
  limpiarFiltros() {
    this.filtroLocal.set('');
    this.filtroFechaLocal.set('');
    this.page.set(1);
  }
  verDetalle(_r: Salida) {/* se implementará en próxima iteración */}
  cerrarRegistro() { this.registroAbierto.set(false); localStorage.removeItem('respuestaApiIntegradora'); }
  onRegistroFinalizado(_salida: Salida) {
    this.cerrarRegistro();
    this.refrescar();
  }
  nuevoRegistro() {
    localStorage.removeItem('respuestaApiIntegradora');
    this.registroAbierto.set(true);
  }

  consultarEnServidor() {
    const placa = this.consultaPlaca().trim();
    if (!placa) return;
    this.buscandoPlaca.set(true);
    const fecha = this.consultaFechaSalida() || undefined;
    this.service.buscarPorPlaca(placa, fecha).pipe(finalize(() => this.buscandoPlaca.set(false))).subscribe({
      next: (resp: any) => {
        const obj = resp?.obj ?? resp?.data ?? resp;
        if (!obj?.id && !obj?.idDespachoExterno) {
          Swal.fire({ icon: 'warning', title: 'Sin resultados', text: 'No se encontró despacho para esa placa.' });
          return;
        }
        this.filtroLocal.set(placa.toUpperCase());
        this.page.set(1);
        this.refrescar();
        Swal.fire({ icon: 'success', title: 'Despacho encontrado', text: 'Listado actualizado.', timer: 1200, showConfirmButton: false });
      },
      error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo consultar la placa.' }),
    });
  }

  abrirNovedad(r: any) {
    this.salidaFocusId.set(r?.id ?? null);
    this.salidaFocusPlaca.set(r?.placa ?? null);
    // Reset helpers used by legacy logic
    localStorage.setItem('numeroConductores', '0');
    localStorage.setItem('vehiculoRegistrado', '0');
    localStorage.removeItem('identificacionConductor');
    this.novedadAbierta.set(true);
    this.novedadRegistrada.set(false);
  }
  cerrarNovedad() {
    localStorage.removeItem('numeroConductores');
    localStorage.removeItem('vehiculoRegistrado');
    localStorage.removeItem('identificacionConductor');
    this.novedadAbierta.set(false);
  }
  onNovedadGuardada() {
    // Novedad registrada; refrescar listado y bloquear cierre por backdrop
    this.novedadRegistrada.set(true);
    this.refrescar();
  }
  onModalNovedadClosed() {
    // Ignorar cierre por backdrop si ya hay novedad registrada
    if (!this.novedadRegistrada()) {
      this.cerrarNovedad();
    }
  }

  abrirHistorial(r: any) {
    this.salidaFocusId.set(r?.id ?? null);
    this.historialAbierto.set(true);
  }
  cerrarHistorial() { this.historialAbierto.set(false); }

  refrescar() {
    const nit = this.nitEmpresa();
    if (!nit) return;
    this.loading.set(true);
    this.service.listar(nit).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (res) => {
        const lista = (res as { array_data?: Salida[] })?.array_data ?? [];
        this.errorMensaje.set(null);
        this.registros.set(lista);
      },
      error: (err) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          const msg = (err.error?.mensaje ?? err.message ?? 'Acceso no autorizado').toString();
          this.errorMensaje.set(msg);
          this.registros.set([]);
        } else {
          this.errorMensaje.set((err?.error?.mensaje ?? err?.message ?? 'No se pudo cargar el listado de salidas').toString());
          this.registros.set([]);
        }
      }
    });
  }
}
