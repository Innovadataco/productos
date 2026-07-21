import { ChangeDetectionStrategy, Component, effect, inject, input, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { SalidasRegistroService } from './salidas-registro.service';
import { PaginatorComponent } from '../../shared/ui/paginator.component';

@Component({
  selector: 'app-salidas-novedades-historial',
  standalone: true,
  imports: [CommonModule, PaginatorComponent, DatePipe],
  template: `
    <div class="d-grid gap-3">
      <!-- <h6 class="mb-0">Historial de novedades</h6> -->
      @if (loading()) {
        <div class="text-center py-4"><div class="spinner-border" role="status"></div></div>
      } @else if (!novedades().length) {
        <div class="text-center text-muted py-4">Sin novedades registradas.</div>
      } @else {
        <div class="d-flex justify-content-end gap-2 flex-wrap">
          <div class="input-group input-group-sm" style="max-width: 320px;">
            <input
              type="search"
              class="form-control"
              placeholder="Buscar descripción o tipo"
              [value]="filtroTerm()"
              (input)="onFiltroTerm($event)"
            />
          </div>
          <div class="input-group input-group-sm" style="max-width: 170px;">
            <input
              type="date"
              class="form-control"
              [value]="filtroFecha()"
              (input)="onFiltroFecha($event)"
            />
          </div>
          <button type="button" class="btn-outline-brand btn-brand--sm" (click)="limpiarFiltros()" [disabled]="!filtroTerm() && !filtroFecha()">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="table-responsive border rounded">
          <table class="table align-middle mb-0">
            <thead class="table-light"><tr>
              <th style="width:60px;">#</th>
              <th>Descripción</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Otros</th>
            </tr></thead>
            <tbody>
              @for (n of paginados(); track n.id ?? $index; let i = $index) {
                <tr (click)="toggleExpand(n)" class="registro">
                  <td>{{ (page() - 1) * pageSize() + i + 1 }}</td>
                  <td>{{ n.descripcion || '-' }}</td>
                  <td>{{ n.idTipoNovedad === 1 ? 'Conductor / Vehículo' : n.idTipoNovedad === 2 ? 'Otra' : '-' }}</td>
                  <td>{{ (n.fechaNovedad?.split('T')[0] | date : 'dd/MM/yyyy') || '-' }}</td>
                  <td>{{ n.horaNovedad || '-' }}</td>
                  <td>{{ n.otros || '-' }}</td>
                </tr>
                @if (n.idTipoNovedad === 1 && expandedId() === (n.id ?? null)) {
                  <tr class="detail-row">
                    <td colspan="6" class="p-0">
                      <div class="detail-wrapper border-top bg-white">
                        <div class="p-2 fw-semibold d-flex justify-content-between align-items-center">
                          <span>Detalle de novedad #{{ n.id ?? '-' }}</span>
                          <small class="text-muted">Click nuevamente para cerrar</small>
                        </div>
                        <div class="px-2 pb-3 d-grid gap-3">
                          <div class="table-responsive">
                            <table class="table table-sm mb-0">
                              <thead class="table-light">
                                <tr>
                                  <th style="width:40px;">#</th>
                                  <th>Nombre completo</th>
                                  <th>Número de Identificación</th>
                                  <th>Licencia</th>
                                  <th>Prueba de Alcoholimetría</th>
                                  <th>Observaciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                @if (!conductores().length) {
                                  <tr><td colspan="6" class="text-center text-muted">No hay conductor registrado</td></tr>
                                } @else {
                                  @for (c of conductores(); track c.id ?? $index; let j = $index) {
                                    <tr>
                                      <td>{{ j + 1 }}</td>
                                      <td>{{ (c.primerNombreConductor || '') + ' ' + (c.segundoNombreConductor || '') + ' ' + (c.primerApellidoConductor || '') + ' ' + (c.segundoApellidoConductor || '') }}</td>
                                      <td>{{ c.numeroIdentificacion || '-' }}</td>
                                      <td>{{ c.licenciaConduccion || '-' }}</td>
                                      <td>{{ c.resultadoPruebaAlcoholimetria || '-' }}</td>
                                      <td>{{ c.observaciones || '-' }}</td>
                                    </tr>
                                  }
                                }
                              </tbody>
                            </table>
                          </div>
                          <div class="table-responsive">
                            <table class="table table-sm mb-0">
                              <thead class="table-light">
                                <tr>
                                  <th style="width:40px;">#</th>
                                  <th>Placa</th>
                                  <th>SOAT</th>
                                  <th>Tarjeta de operación</th>
                                  <th>Póliza contractual</th>
                                  <th>Póliza extracontractual</th>
                                  <th>Observaciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                @if (!vehiculos().length) {
                                  <tr><td colspan="7" class="text-center text-muted">No hay vehículo registrado</td></tr>
                                } @else {
                                  @for (v of vehiculos(); track v.id ?? $index; let k = $index) {
                                    <tr>
                                      <td>{{ k + 1 }}</td>
                                      <td>{{ v.placa || '-' }}</td>
                                      <td>{{ v.soat || '-' }}</td>
                                      <td>{{ v.tarjetaOperacion || '-' }}</td>
                                      <td>{{ v.idPolizaContractual || '-' }}</td>
                                      <td>{{ v.idPolizaExtracontractual || '-' }}</td>
                                      <td>{{ v.observaciones || '-' }}</td>
                                    </tr>
                                  }
                                }
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
        <div class="d-flex justify-content-end">
          <app-paginator
            [page]="page()"
            [total]="novedadesFiltradas().length"
            [pageSize]="pageSize()"
            (pageChange)="page.set($event)"
            (pageSizeChange)="pageSize.set($event)"
          />
        </div>
      }
    </div>
  `,
  styles: [`
  :host{display:block}
  .registro{
    cursor:pointer;
    transition: background-color .2s;
  }
  .registro:hover{background-color: #598dc2ff}
  .detail-wrapper{animation: expandIn .2s ease-out}
  @keyframes expandIn{from{opacity:0;max-height:0}to{opacity:1;max-height:800px}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalidasNovedadesHistorialComponent {
  private readonly registro = inject(SalidasRegistroService);

  private conductoresGlobal: any[] = [];
  private vehiculosGlobal: any[] = [];

  idSalida = input<number | null>();

  loading = signal(false);
  novedades = signal<any[]>([]);
  filtroTerm = signal('');
  filtroFecha = signal('');
  page = signal(1);
  pageSize = signal(5);
  expandedId = signal<number | null>(null);
  conductores = signal<any[]>([]);
  vehiculos = signal<any[]>([]);

  constructor() {
    effect((onCleanup) => {
      const id = this.idSalida();
      this.expandedId.set(null);
      this.conductores.set([]);
      this.vehiculos.set([]);
      this.filtroTerm.set('');
      this.filtroFecha.set('');
      this.page.set(1);
      if (!id) {
        this.novedades.set([]);
        return;
      }
      this.loading.set(true);
      const sub = this.registro
        .obtenerDespacho(id)
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: (resp: unknown) => {
            const root = (resp as { obj?: Record<string, unknown> })?.obj ?? (resp as Record<string, unknown>) ?? {};
            const list = Array.isArray(root['novedades']) ? (root['novedades'] as unknown[]) : [];
            this.novedades.set(list);
            this.conductoresGlobal = list.flatMap((n) => {
              const item = n as Record<string, unknown>;
              const nested = item['novedadesConductores'] ?? item['novedades_conductores'] ?? item['conductores'];
              return Array.isArray(nested) ? nested : [];
            });
            this.vehiculosGlobal = list.flatMap((n) => {
              const item = n as Record<string, unknown>;
              const nested = item['novedadesVehiculos'] ?? item['novedades_vehiculos'] ?? item['vehiculos'];
              return Array.isArray(nested) ? nested : [];
            });
          },
          error: () => {
            this.novedades.set([]);
          },
        });
      onCleanup(() => sub.unsubscribe());
    });
  }

  novedadesFiltradas = computed(() => {
    const term = this.filtroTerm().trim().toLowerCase();
    const fechaFiltro = this.filtroFecha().trim();
    const lista = this.novedades();
    const toText = (v: unknown) => String(v ?? '').toLowerCase();
    const fechaOk = (n: any) => {
      if (!fechaFiltro) return true;
      const raw = n?.fechaNovedad ?? n?.fecha_creacion;
      if (!raw) return false;
      const iso = String(raw).split('T')[0];
      return iso === fechaFiltro;
    };
    return lista.filter((n) => {
      const textoCoincide = !term || [
        n.descripcion,
        this.tipoLegible(n.idTipoNovedad),
        n.fecha_creacion ?? n.fechaNovedad,
        n.horaNovedad,
      ].some((v) => toText(v).includes(term));
      return textoCoincide && fechaOk(n);
    });
  });

  paginados = computed(() => {
    const size = Math.max(1, this.pageSize());
    const total = this.novedadesFiltradas().length;
    const maxPage = Math.max(1, Math.ceil(total / size));
    const currentPage = Math.min(this.page(), maxPage);
    const start = (currentPage - 1) * size;
    return this.novedadesFiltradas().slice(start, start + size);
  });

  tipoLegible(tipo: any): string {
    return Number(tipo) === 1 ? 'Conductor / Vehículo' : 'Otro';
  }

  toggleExpand(n: any) {
    const id = n?.id;
    if (!id || n.idTipoNovedad !== 1) return; // solo expandir tipo 1
    if (this.expandedId() === id) {
      this.expandedId.set(null);
      this.conductores.set([]);
      this.vehiculos.set([]);
      return;
    }
    this.expandedId.set(id);
    const candidatosC = (n?.novedadesConductores ?? n?.conductores ?? []) as any[];
    const candidatosV = (n?.novedadesVehiculos ?? n?.vehiculos ?? []) as any[];
    const filtroConductores = candidatosC.length ? candidatosC : this.conductoresGlobal.filter((c: any) => (c.idNovedad ?? c.id_novedad) === id);
    const filtroVehiculos = candidatosV.length ? candidatosV : this.vehiculosGlobal.filter((v: any) => (v.idNovedad ?? v.id_novedad) === id);
    this.conductores.set(filtroConductores);
    this.vehiculos.set(filtroVehiculos);
  }

  onFiltroTerm(event: Event) {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.filtroTerm.set(value);
    this.page.set(1);
  }

  onFiltroFecha(event: Event) {
    const value = (event.target as HTMLInputElement).value ?? '';
    this.filtroFecha.set(value);
    this.page.set(1);
  }

  limpiarFiltros() {
    this.filtroTerm.set('');
    this.filtroFecha.set('');
    this.page.set(1);
  }

  private formatearFecha(raw: any): string {
    const d = raw ? new Date(raw) : null;
    if (!d || isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
}
