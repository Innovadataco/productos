import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';

import { DatePipe } from '@angular/common';

import { HttpErrorResponse } from '@angular/common/http';

import { ActivatedRoute } from '@angular/router';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { finalize } from 'rxjs/operators';

import { ServicioLocalStorage } from '../../administrador/servicios/local-storage.service';

import { Usuario, Rol } from '../../core/models/auth.models';

import { PageHeaderComponent } from '../../shared/ui/page-header.component';

import { PaginatorComponent } from '../../shared/ui/paginator.component';

import { ModalComponent } from '../../shared/ui/modal.component';

import { LlegadasRegistroService } from './llegadas-registro.service';

import { LlegadasRegistroModalComponent } from './llegadas-registro-modal.component';

import { Llegadas } from '../../despachos/models/Llegadas';

import { etiquetaFuenteDato } from '../../shared/fuente-dato.util';



@Component({

  selector: 'app-llegadas-page',

  template: `

    <div class="container-fluid py-3">

      <app-page-header [title]="'Llegadas'" [subtitle]="'Registro y cierre de despachos en terminal de destino.'" [usuarioInput]="usuario()" />



      <section class="card border-1 shadow-sm">

        <div class="card-body d-grid gap-3">

          <div class="d-flex justify-content-between align-items-center">

            <h5 class="mb-0">Listado de llegadas</h5>

          </div>



          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">

            <button class="btn-brand btn-brand--sm" type="button" (click)="abrirRegistro()">

              <i class="bi bi-plus-lg"></i> Registrar nueva llegada

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

                <label class="form-label form-label-sm mb-1" for="filtroLlegadas">Buscar</label>

                <input

                  id="filtroLlegadas"

                  type="search"

                  class="form-control form-control-sm"

                  placeholder="Placa, terminal o NIT"

                  [value]="filtro()"

                  (input)="onFiltro($event)"

                />

              </div>

              <div class="col-6 col-md-3 col-lg-2">

                <label class="form-label form-label-sm mb-1" for="filtroFechaLlegadas">Fecha llegada</label>

                <input

                  id="filtroFechaLlegadas"

                  type="date"

                  class="form-control form-control-sm"

                  [value]="filtroFecha()"

                  (input)="onFiltroFecha($event)"

                />

              </div>

              <div class="col-6 col-md-auto">

                <button

                  type="button"

                  class="btn btn-outline-secondary btn-sm w-100 w-md-auto"

                  (click)="limpiarFiltro()"

                  [disabled]="!filtro() && !filtroFecha()"

                >

                  <i class="bi bi-x-lg me-1"></i> Limpiar

                </button>

              </div>

            </div>

          </div>



          <div class="table-responsive border rounded">

            <table class="table align-middle mb-0">

              <thead class="table-light">

                <tr>

                  <th style="width:60px;">#</th>

                  <th>Placa</th>

                  <th>Fecha</th>

                  <th>Hora</th>

                  <th>NIT</th>

                  <th>Pasajeros</th>

                  <th>Fuente</th>

                </tr>

              </thead>

              <tbody>

                @if (loading()) {

                  <tr><td colspan="9" class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></td></tr>

                } @else if (errorMensaje()) {

                  <tr><td colspan="9" class="text-center py-4 text-danger">{{ errorMensaje() }}</td></tr>

                } @else if (!totalRegistros()) {

                  <tr><td colspan="9" class="text-center text-muted py-4">No hay llegadas registradas.</td></tr>

                } @else if (!registrosFiltrados().length) {

                  <tr><td colspan="9" class="text-center text-muted py-4">Sin resultados en esta página</td></tr>

                } @else {

                  @for (r of registrosFiltrados(); track r.id ?? $index; let i = $index) {

                    <tr>

                      <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>

                      <td>{{ r.placa || '-' }}</td>

                      <td>{{ r.fechaLlegada ? (r.fechaLlegada.split('T')[0] | date : 'dd/MM/yyyy') : '-' }}</td>

                      <td>{{ r.horaLlegada || '-' }}</td>

                      <td>{{ r.nitEmpresaTransporte || '-' }}</td>

                      <td>{{ r.numeroPasajero ?? '-' }}</td>

                      <td>{{ etiquetaFuenteDato(r.fuenteDato) }}</td>

                    </tr>

                  }

                }

              </tbody>

            </table>

          </div>



          @if (totalRegistros() > 0) {

            <div class="d-flex justify-content-end">

              <app-paginator

                [page]="page()"

                [total]="totalRegistros()"

                [pageSize]="pageSize()"

                storageKey="llegadas_registros"

                (pageChange)="onPageChange($event)"

                (pageSizeChange)="onPageSizeChange($event)"

              />

            </div>

          }

        </div>

      </section>



      <app-modal [open]="modalAbierto()" title="Registrar llegada" size="lg" (closed)="cerrarModal()">

        @if (modalAbierto()) {

          <app-llegadas-registro-modal

            [nit]="nitEmpresa()"

            (cerrar)="cerrarModal()"

            (guardado)="onGuardado()"

          />

        }

      </app-modal>

    </div>

  `,

  styles: [

    `:host{display:block;}`,

    `.filtros-panel{background:var(--bs-light-bg-subtle,#f8f9fa);}`,

    `.filtros-panel__label{font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--bs-secondary-color);}`,

    `.form-label-sm{font-size:.8125rem;}`,

  ],

  changeDetection: ChangeDetectionStrategy.OnPush,

  imports: [PageHeaderComponent, PaginatorComponent, ModalComponent, LlegadasRegistroModalComponent, DatePipe],

})

export class LlegadasPageComponent {

  private readonly storage = inject(ServicioLocalStorage);

  private readonly route = inject(ActivatedRoute);

  private readonly destroyRef = inject(DestroyRef);

  private readonly service = inject(LlegadasRegistroService);



  protected readonly usuario = signal<Usuario | null>(null);

  protected readonly rol = signal<Rol | null>(null);

  protected readonly registros = signal<Llegadas[]>([]);

  protected readonly totalRegistros = signal(0);

  protected readonly loading = signal(false);

  protected readonly errorMensaje = signal<string | null>(null);

  protected readonly filtro = signal('');

  protected readonly filtroFecha = signal('');

  protected readonly page = signal(1);

  protected readonly pageSize = signal(5);

  protected readonly modalAbierto = signal(false);

  protected readonly modoEdicion = signal(false);

  protected readonly llegadaFocus = signal<Llegadas | null>(null);

  private readonly recargarTrigger = signal(0);



  constructor() {

    this.rol.set(this.storage.obtenerRol());

    this.usuario.set(this.storage.obtenerUsuario());



    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {

      const rawUsuario = params.get('usuario');

      if (!rawUsuario) return;

      try {

        this.usuario.set(JSON.parse(rawUsuario) as Usuario);

      } catch {

        console.warn('No se pudo interpretar el usuario recibido en la ruta.');

      }

    });



    effect((onCleanup) => {

      this.page();

      this.pageSize();

      this.recargarTrigger();



      const nit = this.storage.obtenerNitEmpresa();

      if (!nit) {

        this.registros.set([]);

        this.totalRegistros.set(0);

        return;

      }



      this.loading.set(true);

      const sub = this.service

        .listar(nit, this.page(), this.pageSize())

        .pipe(finalize(() => this.loading.set(false)))

        .subscribe({

          next: (res) => {

            this.errorMensaje.set(null);

            this.registros.set(res.data ?? []);

            this.totalRegistros.set(res.meta?.total ?? 0);

          },

          error: (err) => {

            this.registros.set([]);

            this.totalRegistros.set(0);

            if (err instanceof HttpErrorResponse && err.status === 401) {

              this.errorMensaje.set((err.error?.mensaje ?? err.message ?? 'Acceso no autorizado').toString());

            } else {

              this.errorMensaje.set(

                (err?.error?.mensaje ?? err?.error?.mensajes ?? err?.message ?? 'No se pudo cargar el listado de llegadas').toString()

              );

            }

          },

        });



      onCleanup(() => sub.unsubscribe());

    });

  }



  protected readonly registrosFiltrados = computed(() => {

    const term = this.filtro().trim().toLowerCase();

    const fechaFiltro = this.filtroFecha().trim();

    const toText = (v: unknown) => String(v ?? '').toLowerCase();

    let lista = this.registros();

    if (term) {

      lista = lista.filter((r) => [

        r.placa,

        r.terminalLlegada,

        r.nitEmpresaTransporte,

        r.horaLlegada,

        etiquetaFuenteDato(r.fuenteDato),

      ].some((f) => toText(f).includes(term)));

    }

    if (fechaFiltro) {

      lista = lista.filter((r) => String(r.fechaLlegada ?? '').split('T')[0] === fechaFiltro);

    }

    return lista;

  });



  onFiltro(e: Event) { this.filtro.set((e.target as HTMLInputElement).value ?? ''); }

  onFiltroFecha(e: Event) { this.filtroFecha.set((e.target as HTMLInputElement).value ?? ''); }

  limpiarFiltro() { this.filtro.set(''); this.filtroFecha.set(''); }



  onPageChange(page: number) {

    this.page.set(page);

  }



  onPageSizeChange(size: number) {

    this.pageSize.set(size);

    this.page.set(1);

  }



  abrirRegistro() {

    this.modoEdicion.set(false);

    this.llegadaFocus.set(null);

    this.modalAbierto.set(true);

  }



  editarRegistro(r: Llegadas) {

    this.modoEdicion.set(true);

    this.llegadaFocus.set(r);

    this.modalAbierto.set(true);

  }



  cerrarModal() {

    this.modalAbierto.set(false);

    this.llegadaFocus.set(null);

    this.modoEdicion.set(false);

  }



  onGuardado() {

    this.refrescar();

  }



  nitEmpresa(): string {

    return this.storage.obtenerNitEmpresa();

  }



  protected readonly etiquetaFuenteDato = etiquetaFuenteDato;



  refrescar() {

    this.recargarTrigger.update((v) => v + 1);

  }

}


