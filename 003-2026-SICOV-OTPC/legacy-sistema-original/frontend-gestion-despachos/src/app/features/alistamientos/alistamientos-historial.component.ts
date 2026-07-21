import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { HistorialAlistamiento } from './alistamientos.models';
import { PaginatorComponent } from '../../shared/ui/paginator.component';
import { TipoIdentificacion } from '../../parametricas/servicios/parametricas.service';

@Component({
  selector: 'app-alistamientos-historial',
  standalone: true,
  imports: [PaginatorComponent],
  template: `
    <section class="d-grid gap-3">
      <header class="d-flex justify-content-end align-items-start gap-3">
        <div class="d-flex align-items-center gap-2">
          <div class="input-group input-group-sm" style="max-width: 240px;">
            <label for="alistBuscar" class="visually-hidden">Buscar</label>
            <input id="alistBuscar" type="search" class="form-control form-control-sm" placeholder="Buscar..."
              [value]="termino()" (input)="termino.set(($any($event.target)).value); aplicarFiltros()" />
          </div>
          <div class="d-flex align-items-center gap-2">
            <input type="date" class="form-control form-control-sm" [value]="fecha()" (change)="fecha.set(($any($event.target)).value); aplicarFiltros()"/>
          </div>
          <button class="btn btn-sm btn-outline-secondary" (click)="limpiarFiltros()" [disabled]="!termino() && !fecha()">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </header>

      @if (loading()) {
        <div class="d-flex justify-content-center py-4">
          <div class="spinner-border text-primary" role="status" aria-label="Cargando historial"></div>
        </div>
      } @else {
        <div class="table-responsive border rounded">
          <table class="table table-sm align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Conductor</th>
                <th>Detalle de la actividad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @if (!recordsFiltrados().length) {
                <tr>
                  <td colspan="6" class="text-center text-muted py-4">Sin registros para mostrar</td>
                </tr>
              } @else {
                @for (item of registrosPaginados(); track item.id; let index = $index) {
                  <tr>
                    <td>{{ pageOffset() + index + 1 }}</td>
                    <td>{{ formatearFecha(item.created_at) }}</td>
                    <td>
                      <div class="fw-semibold">{{ item.nombre_responsable }}</div>
                      <div class="text-muted small">{{ formatIdent(item.tipo_identificacion_responsable, item.numero_identificacion_responsable) }}</div>
                    </td>
                    <td>
                      <div class="fw-semibold">{{ item.nombres_conductor }}</div>
                      <div class="text-muted small">{{ formatIdent(item.tipo_identificacion_conductor, item.numero_identificacion_conductor) }}</div>
                    </td>
                    <td>{{ item.detalle_actividades }}</td>
                    <td>
                      <span class="badge" [class.text-bg-success]="item.estadoMantenimiento" [class.text-bg-secondary]="!item.estadoMantenimiento">
                        {{ item.estadoMantenimiento ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
        <div class="d-flex flex-column flex-md-row justify-content-center align-items-md-center gap-2 border rounded-bottom border-top-0 bg-light px-3 py-2 small">
          @if (recordsFiltrados().length) {
            <app-paginator
              [page]="paginaActual()"
              [total]="recordsFiltrados().length"
              [pageSize]="effectiveSize()"
              storageKey="alistamientos_historial"
              (pageChange)="paginaActual.set($event)"
              (pageSizeChange)="selectedSize.set($event)"
            />
          }
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlistamientosHistorialComponent {
  records = input<readonly HistorialAlistamiento[]>([]);
  placa = input<string>('');
  loading = input<boolean>(false);
  exportUrl = input<string | null>(null);
  pageSize = input<number>(5);
  idTypes = input<readonly TipoIdentificacion[]>([]);

  ver = output<HistorialAlistamiento>();

  protected readonly paginaActual = signal(1);
  protected readonly selectedSize = signal<number | null>(null);
  protected readonly termino = signal('');
  protected readonly fecha = signal('');

  private toLower(v: unknown): string { return (v ?? '').toString().toLowerCase(); }

  protected readonly recordsFiltrados = computed(() => {
    const items = this.records();
    const t = this.toLower(this.termino());
    const f = (this.fecha() || '').trim();
    let list = items;
    if (t) {
      list = list.filter((r) => {
        const responsable = this.toLower((r as any).nombre_responsable);
        const conductor = this.toLower((r as any).nombres_conductor);
        const detalle = this.toLower((r as any).detalle_actividades);
        const tipoResp = this.toLower((r as any).tipo_identificacion_responsable);
        const numResp = this.toLower((r as any).numero_identificacion_responsable);
        const tipoCond = this.toLower((r as any).tipo_identificacion_conductor);
        const numCond = this.toLower((r as any).numero_identificacion_conductor);
        return (
          responsable.includes(t) ||
          conductor.includes(t) ||
          detalle.includes(t) ||
          tipoResp.includes(t) ||
          numResp.includes(t) ||
          tipoCond.includes(t) ||
          numCond.includes(t)
        );
      });
    }
    if (f) {
      list = list.filter((r) => {
        const fechaRegistro = ((r as any).created_at || '').toString().split('T')[0];
        return fechaRegistro === f;
      });
    }
    return list;
  });

  protected readonly effectiveSize = computed(() => this.selectedSize() ?? Math.max(1, this.pageSize()));
  protected readonly registrosPaginados = computed(() => {
    const items = this.recordsFiltrados();
    const size = this.effectiveSize();
    const inicio = (this.paginaActual() - 1) * size;
    return items.slice(inicio, inicio + size);
  });
  protected readonly totalPaginas = computed(() => {
    const total = this.recordsFiltrados().length;
    const size = this.effectiveSize();
    return total ? Math.ceil(total / size) : 1;
  });
  protected readonly enPrimeraPagina = computed(() => this.paginaActual() <= 1);
  protected readonly enUltimaPagina = computed(() => this.paginaActual() >= this.totalPaginas());
  protected readonly pageOffset = computed(() => {
    if (!this.recordsFiltrados().length) return 0;
    return (this.paginaActual() - 1) * this.effectiveSize();
  });
  protected readonly pageInfo = computed(() => {
    const total = this.recordsFiltrados().length;
    if (!total) {
      return { inicio: 0, fin: 0, total: 0 } as const;
    }
    const size = this.effectiveSize();
    const inicio = (this.paginaActual() - 1) * size + 1;
    const fin = Math.min(inicio + size - 1, total);
    return { inicio, fin, total } as const;
  });

  constructor() {
    effect(() => {
      const paginas = this.totalPaginas();
      const actual = this.paginaActual();
      if (actual > paginas) {
        this.paginaActual.set(paginas);
      }
    });

    effect(() => {
      this.records();
      this.pageSize();
      if (this.paginaActual() !== 1) {
        this.paginaActual.set(1);
      }
    });
  }

  formatearFecha(fecha: string | undefined | null) {
    if (!fecha) return '';
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  protected irAPaginaAnterior() {
    this.paginaActual.update(page => Math.max(1, page - 1));
  }

  protected irAPaginaSiguiente() {
    this.paginaActual.update(page => Math.min(this.totalPaginas(), page + 1));
  }

  protected aplicarFiltros() {
    if (this.paginaActual() !== 1) this.paginaActual.set(1);
  }

  protected limpiarFiltros() {
    if (this.termino() || this.fecha()) {
      this.termino.set('');
      this.fecha.set('');
      this.aplicarFiltros();
    }
  }

  protected formatIdent(tipo: unknown, numero: unknown): string {
    const abbr = this.abbrTipoId(tipo);
    const num = numero == null ? '' : String(numero);
    return abbr ? `${abbr} ${num}` : num;
  }

  private abbrTipoId(tipo: unknown): string {
    if (tipo == null) return '';
    const raw = String(tipo).trim();
    const upper = this.removeDiacritics(raw).toUpperCase();
    if (['CC','CE','TI','NIT','PAS','PPT','PEP','DIE','RC'].includes(upper)) return upper;

    const tipos = this.idTypes();
    if (tipos && tipos.length) {
      const match = tipos.find(t => String(t.id).trim() === raw);
      if (match) {
        const ab = this.abbrFromDescription(match.nombre);
        if (ab) return ab;
      }
    }

    const byText = this.abbrFromDescription(raw);
    if (byText) return byText;

    if (upper.includes('EXTRANJ')) return 'CE';
    if (upper.includes('TARJETA')) return 'TI';
    if (upper.includes('PASAP')) return 'PAS';
    if (upper.includes('REGISTRO') || upper === 'RC') return 'RC';
    if (upper.includes('NIT')) return 'NIT';
    if (upper.includes('CEDULA') || upper.includes('CEDULA DE CIUDADANIA')) return 'CC';
    return raw;
  }

  private abbrFromDescription(desc: string | null | undefined): string {
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

  private removeDiacritics(s: string): string {
    return s.normalize('NFD').replace(/\p{Diacritic}+/gu, '');
  }
}
