import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { AutorizacionHistorial } from './autorizaciones.models';
import { PaginatorComponent } from '../../shared/ui/paginator.component';
import { ParametricasService, TipoIdentificacion } from '../../parametricas/servicios/parametricas.service';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-autorizaciones-historial',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PaginatorComponent, FormsModule, DatePipe],
  providers: [DatePipe],
  template: `
    <div class="d-grid gap-3">
      <div class="d-flex justify-content-end gap-2 flex-wrap">
        <div class="input-group input-group-sm" style="max-width: 320px;">
          <input type="search" class="form-control" placeholder="Buscar origen, destino, otorgante o estado" [value]="filtroTerm()" (input)="onFilterTerm($event)" />
        </div>
        <div class="input-group input-group-sm" style="max-width: 170px;">
          <input type="date" class="form-control" [value]="filtroFecha()" (input)="onFilterFecha($event)" />
        </div>
        <button type="button" class="btn-outline-brand btn-brand--sm" (click)="limpiar()" [disabled]="!filtroTerm() && !filtroFecha()">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="table-responsive border rounded">
        <table class="table table-sm align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th style="width: 60px;">#</th>
              <th>Fecha</th>
              <th>Origen</th>
              <th>Destino</th>
              <th title="Niño, niña o adolescente">NNA <i class="bi bi-info-circle"></i></th>
              <th>Otorgante</th>
              <th>Acompañante autorizado</th>
              <th>Receptor autorizado</th>
              <!-- <th>Estado</th> -->
              <!-- <th class="text-end">Acciones</th> -->
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr>
                <td colspan="8" class="text-center py-4">
                  <div class="spinner-border text-primary" role="status" aria-label="Cargando"></div>
                </td>
              </tr>
            } @else if (!records().length) {
              <tr>
                <td colspan="8" class="text-center text-muted py-4">Sin registros</td>
              </tr>
            } @else if (!filtrados().length) {
              <tr>
                <td colspan="8" class="text-center text-muted py-4">Sin resultados</td>
              </tr>
            } @else {
              @for (r of paginados(); track r.id ?? $index; let i = $index) {
                <tr>
                  <td>{{ (page() - 1) * effectiveSize() + i + 1 }}</td>
                  <td>{{ formatFecha(r.fecha_viaje) | date:'shortDate'}}</td>
                  <td>
                    <div [attr.title]="tooltipText(mostrarUbicacion(r.origen))">{{ truncateText(mostrarUbicacion(r.origen)) }}</div>
                  <td>
                    <div [attr.title]="tooltipText(mostrarUbicacion(r.destino))">{{ truncateText(mostrarUbicacion(r.destino)) }}</div>
                  </td>
                  <td>
                    <div class="fw-semibold" [attr.title]="tooltipText(r.nombres_apellidos_nna)">{{ truncateText(r.nombres_apellidos_nna) }}</div>
                    <div class="text-muted small">{{ formatIdent(r.tipo_identificacion_nna, r.numero_identificacion_nna) || '-' }}</div>
                  </td>
                  <td>
                    <div class="fw-semibold" [attr.title]="tooltipText(r.nombres_apellidos_otorgante)">{{ truncateText(r.nombres_apellidos_otorgante) }}</div>
                    <div class="text-muted small">{{ formatIdent(r.tipo_identificacion_otorgante, r.numero_identificacion_otorgante) || '-' }}</div>
                  </td>
                  <td>
                    <div class="fw-semibold" [attr.title]="tooltipText(r.nombres_apellidos_autorizado_viajar)">{{ truncateText(r.nombres_apellidos_autorizado_viajar) }}</div>
                    <div class="text-muted small">{{ formatIdent(r.tipo_identificacion_autorizado_viajar, r.numero_identificacion_autorizado_viajar) || '-' }}</div>
                  </td>
                  <td>
                    <div class="fw-semibold" [attr.title]="tooltipText(r.nombres_apellidos_autorizado_recoger)">{{ truncateText(r.nombres_apellidos_autorizado_recoger) }}</div>
                    <div class="text-muted small">{{ formatIdent(r.tipo_identificacion_autorizado_recoger, r.numero_identificacion_autorizado_recoger) || '-' }}</div>
                  </td>
                  <!-- <td>
                    <span class="badge" [class.text-bg-success]="r.estado" [class.text-bg-secondary]="r.estado === false">{{ r.estado === false ? 'Inactivo' : 'Activo' }}</span>
                  </td> -->
                  <!-- <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" type="button" (click)="ver.emit(r)">
                      <i class="bi bi-eye"></i> Ver/editar
                    </button>
                  </td> -->
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      @if (filtrados().length > 0) {
        <app-paginator
          [total]="filtrados().length"
          [page]="page()"
          (pageChange)="page.set($event)"
          [pageSize]="effectiveSize()"
          (pageSizeChange)="onPageSize($event)"
          [storageKey]="'autorizaciones_historial'"
        ></app-paginator>
      }

      <!-- @if (exportUrl()) {
        <div class="d-flex justify-content-end">
          <a class="btn btn-sm btn-outline-success" [href]="exportUrl()!" target="_blank" rel="noopener"><i class="bi bi-download"></i> Exportar</a>
        </div>
      } -->
    </div>
  `,
})
export class AutorizacionesHistorialComponent {
  protected readonly selectedSize = signal<number | null>(null);
  private readonly datePipe = inject(DatePipe);
  records = input.required<AutorizacionHistorial[]>();
  placa = input<string>('');
  loading = input<boolean>(false);
  exportUrl = input<string | null>(null);
  pageSize = input<number>(5);
  ver = output<AutorizacionHistorial>();

  page = signal(1);
  filtroTerm = signal('');
  filtroFecha = signal('');
  private readonly ubicaciones = signal<{ codigo: string; descripcion: string }[]>([]);
  private readonly tiposIdentificacion = signal<TipoIdentificacion[]>([]);

  private readonly fecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  private readonly parametricas = inject(ParametricasService);

  constructor() {
    this.parametricas.obtenerParametrica<any[]>('listar-centros-poblados').subscribe((res) => this.ubicaciones.set(res ?? []));
    this.parametricas.obtenerTipoIdentificaciones().subscribe((res) => this.tiposIdentificacion.set(res ?? []));
  }

  onFilterTerm(e: Event) {
    const v = (e.target as HTMLInputElement).value ?? '';
    this.filtroTerm.set(v);
    this.page.set(1);
  }
  onFilterFecha(e: Event) {
    const v = (e.target as HTMLInputElement).value ?? '';
    this.filtroFecha.set(v);
    this.page.set(1);
  }
  limpiar() { this.filtroTerm.set(''); this.filtroFecha.set(''); this.page.set(1); }

  filtrados = computed(() => {
    const term = this.filtroTerm().trim().toLowerCase();
    const fechaFiltro = this.filtroFecha().trim();
    const toText = (v: unknown) => String(v ?? '').toLowerCase();
    return this.records().filter(r => {
      const fechaRaw = r.fecha_viaje;
      const fechaShort = fechaRaw ? this.datePipe.transform(fechaRaw, 'shortDate', 'UTC') ?? '' : '';
      const fechaShortWithTime = fechaRaw ? this.datePipe.transform(fechaRaw, 'short', 'UTC') ?? '' : '';
      const fechaAlt = fechaRaw ? this.datePipe.transform(fechaRaw, 'MM/dd/yy', 'UTC') ?? '' : '';
      const fechaAlt2 = fechaRaw ? this.datePipe.transform(fechaRaw, 'dd/MM/yy', 'UTC') ?? '' : '';
      const origen = this.mostrarUbicacion(r.origen);
      const destino = this.mostrarUbicacion(r.destino);
      const estado = r.estado === false ? 'inactivo' : 'activo';
      const camposTexto = [
        this.fechaLegible(fechaRaw),
        fechaShort,
        fechaShortWithTime,
        fechaAlt,
        fechaAlt2,
        origen,
        destino,
        r.nombres_apellidos_otorgante,
        r.nombres_apellidos_autorizado_viajar,
        r.nombres_apellidos_autorizado_recoger,
        estado,
      ];

      const coincideTexto = !term || camposTexto.some(t => toText(t).includes(term));
      const coincideFecha = !fechaFiltro || camposTexto.slice(0, 5).some(t => toText(t).includes(fechaFiltro.toLowerCase()));
      return coincideTexto && coincideFecha;
    });
  });

  effectiveSize = computed(() => this.selectedSize() ?? this.pageSize());

  paginados = computed(() => {
    const size = this.effectiveSize();
    const start = (this.page() - 1) * size;
    return this.filtrados().slice(start, start + size);
  });
  totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / this.effectiveSize())));

  fechaLegible(d?: string | Date) {
    if (!d) return '';
    return this.datePipe.transform(d, 'dd/MM/yyyy', 'UTC') ?? '';
  }
  mostrarUbicacion(codigo?: string) {
    if (!codigo) return '-';
    return this.ubicaciones().find(u => String(u.codigo) === String(codigo))?.descripcion || String(codigo);
  }

  formatFecha(d?: string | Date) {
    if (!d) return '';
    return this.datePipe.transform(d, 'yyyy-MM-dd', 'UTC') ?? '';
  }

  formatIdent(tipo?: unknown, numero?: unknown) {
    const abbr = this.abbrTipoId(tipo);
    const num = numero == null ? '' : String(numero).trim();
    if (abbr && num) return `${abbr} ${num}`;
    if (num) return num;
    return abbr;
  }

  private abbrTipoId(tipo: unknown): string {
    if (tipo == null) return '';
    const raw = String(tipo).trim();
    const upper = this.removeDiacritics(raw).toUpperCase();
    if (['CC','CE','TI','NIT','PAS','PPT','PEP','DIE','RC'].includes(upper)) return upper;

    const match = this.tiposIdentificacion().find((t) => String(t.id).trim() === raw || String(t.codigo ?? '').trim() === raw);
    if (match) {
      const ab = this.abbrFromDescription(match.nombre);
      if (ab) return ab;
    }

    if (upper.includes('EXTRANJ')) return 'CE';
    if (upper.includes('TARJETA')) return 'TI';
    if (upper.includes('PASAP')) return 'PAS';
    if (upper.includes('REGISTRO')) return 'RC';
    if (upper.includes('NIT')) return 'NIT';
    if (upper.includes('CEDULA')) return 'CC';
    return '';
  }

  private abbrFromDescription(desc?: string | null): string {
    if (!desc) return '';
    const u = this.removeDiacritics(String(desc)).toUpperCase();
    if (u.includes('PERMISO POR PROTECCION TEMPORAL') || u.includes('PPT')) return 'PPT';
    if (u.includes('PERMISO ESPECIAL DE PERMANENCIA') || u.includes('PEP')) return 'PEP';
    if (u.includes('DOCUMENTO DE IDENTIFICACION EXTRANJERO') || u.includes('DIE')) return 'DIE';
    if (u.includes('PASAP')) return 'PAS';
    if (u.includes('EXTRANJ')) return 'CE';
    if (u.includes('TARJETA')) return 'TI';
    if (u.includes('REGISTRO CIVIL')) return 'RC';
    if (u.includes('CEDULA')) return 'CC';
    return '';
  }

  private removeDiacritics(v: string) {
    return v.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
  }

  truncateText(value?: string | null, limit = 20) {
    const text = (value ?? '').trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, Math.max(0, limit - 3))}...`;
  }

  tooltipText(value?: string | null) {
    const text = (value ?? '').trim();
    return text.length > 20 ? text : null;
  }

  onPageSize(size: number) {
    this.selectedSize.set(size);
    this.page.set(1);
  }
}
