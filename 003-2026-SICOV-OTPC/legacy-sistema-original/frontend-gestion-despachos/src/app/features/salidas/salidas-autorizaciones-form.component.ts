import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SalidasRegistroService } from './salidas-registro.service';
import { PaginatorComponent } from '../../shared/ui/paginator.component';
import { ParametricasService } from '../../parametricas/servicios/parametricas.service';

export interface AutorizacionDespachoItem {
  key: string;
  id?: string | number;
  nombresNna: string;
  identificacionNna: string;
  origen: string;
  destino: string;
  raw: Record<string, unknown>;
}

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function normalizarAutorizacionItem(raw: unknown, index: number): AutorizacionDespachoItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const nombresNna = pickStr(obj, 'nombresApellidosNna', 'nombres_apellidos_nna');
  const identificacionNna = pickStr(obj, 'numeroIdentificacionNna', 'numero_identificacion_nna');
  const origen = pickStr(obj, 'origen', 'centroPobladoOrigen', 'centro_poblado_origen');
  const destino = pickStr(obj, 'destino', 'centroPobladoDestino', 'centro_poblado_destino');
  const idRaw = obj['id'] ?? obj['idAutorizacion'] ?? obj['id_autorizacion'];
  const id =
    idRaw != null && (typeof idRaw === 'number' || typeof idRaw === 'string') ? idRaw : undefined;
  const codigo = pickStr(obj, 'codigo', 'autorizacion');

  if (!nombresNna && !identificacionNna && !origen && !destino && !codigo) return null;

  // Clave única por fila: varios registros pueden compartir id/codigo de la API.
  const key = `aut-${index}`;
  return {
    key,
    id,
    nombresNna,
    identificacionNna,
    origen,
    destino,
    raw: obj,
  };
}

export function extraerAutorizaciones(resp: unknown): AutorizacionDespachoItem[] {
  const root = resp as Record<string, unknown> | null | undefined;
  const list = Array.isArray(root?.['array_data'])
    ? (root['array_data'] as unknown[])
    : Array.isArray(root?.['data'])
      ? (root['data'] as unknown[])
      : [];

  const items: AutorizacionDespachoItem[] = [];
  let seq = 0;
  list.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;
    const nested = record['autorizacion'];
    if (Array.isArray(nested) && nested.length) {
      nested.forEach((child) => {
        const item = normalizarAutorizacionItem(child, seq++);
        if (item) items.push(item);
      });
      return;
    }
    const item = normalizarAutorizacionItem(record, seq++);
    if (item) items.push(item);
  });
  return items;
}

@Component({
  selector: 'app-salidas-autorizaciones-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [PaginatorComponent],
  template: `
    <div class="d-grid gap-3">
      @if (!placa() || !nit()) {
        <p class="text-muted small mb-0">Consulte la integradora para cargar autorizaciones.</p>
      } @else {
        <div class="d-flex justify-content-between align-items-end flex-wrap gap-2">
          <div style="min-width: 160px; max-width: 180px;">
            <label class="form-label form-label-sm mb-1" for="fechaAutorizaciones">Fecha</label>
            <input
              id="fechaAutorizaciones"
              type="date"
              class="form-control form-control-sm"
              [value]="fechaConsulta()"
              [max]="fechaActual"
              [disabled]="loading()"
              (change)="onFechaChange($event)"
            />
          </div>
          <div class="input-group input-group-sm" style="max-width: 280px;">
            <input
              type="search"
              class="form-control"
              placeholder="Buscar NNA, origen o destino"
              [value]="filtro()"
              (input)="onFiltro($event)"
            />
            @if (filtro()) {
              <button type="button" class="btn-outline-brand btn-brand--sm" (click)="limpiarFiltro()">Limpiar</button>
            }
          </div>
        </div>

        @if (loading()) {
          <div class="text-muted small py-2">Cargando autorizaciones…</div>
        } @else if (registros().length) {
          <div class="table-responsive border rounded">
            <table class="table table-sm align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th style="width: 50px;">#</th>
                <th>NNA</th>
                <th>Origen</th>
                <th>Destino</th>
                <th style="width: 48px;" class="text-center">
                  <input
                    type="checkbox"
                    class="form-check-input"
                    [checked]="todosFiltradosSeleccionados()"
                    [indeterminate]="algunosFiltradosSeleccionados()"
                    (change)="toggleTodosFiltrados($event)"
                    aria-label="Seleccionar todas las autorizaciones filtradas"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              @if (!registrosFiltrados().length) {
                <tr>
                  <td colspan="5" class="text-center text-muted py-3">Sin resultados</td>
                </tr>
              } @else {
                @for (item of paginados(); track item.key; let idx = $index) {
                  <tr>
                    <td>{{ (page() - 1) * pageSize() + idx + 1 }}</td>
                    <td>
                      <div class="fw-semibold">{{ etiquetaNna(item) }}</div>
                    </td>
                    <td>{{ mostrarUbicacion(item.origen) }}</td>
                    <td>{{ mostrarUbicacion(item.destino) }}</td>
                    <td class="text-center">
                      <input
                        type="checkbox"
                        class="form-check-input"
                        [checked]="seleccionadas().has(item.key)"
                        (change)="toggle(item.key, $event)"
                        [attr.aria-label]="'Seleccionar ' + etiquetaNna(item)"
                      />
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
          </div>

          @if (registrosFiltrados().length) {
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <small class="text-muted">
                {{ seleccionadas().size }} seleccionada(s) · {{ registros().length }} registro(s)
              </small>
              <app-paginator
                [page]="page()"
                [total]="registrosFiltrados().length"
                [pageSize]="pageSize()"
                [showSummary]="false"
                (pageChange)="page.set($event)"
                (pageSizeChange)="onPageSize($event)"
              />
            </div>
          }
        } @else {
          <p class="text-muted small mb-0">No hay autorizaciones disponibles para esta placa y fecha.</p>
        }
      }
    </div>
  `,
  styles: [`.form-label-sm { font-size: .8125rem; }`],
})
export class SalidasAutorizacionesFormComponent implements OnInit {
  nit = input<string>('');
  placa = input<string>('');
  fechaSalida = input<string>('');
  selectionChange = output<Record<string, unknown>[]>();

  private readonly registro = inject(SalidasRegistroService);
  private readonly parametricas = inject(ParametricasService);

  loading = signal(false);
  registros = signal<AutorizacionDespachoItem[]>([]);
  seleccionadas = signal<Set<string>>(new Set());
  filtro = signal('');
  fechaConsulta = signal('');
  page = signal(1);
  pageSize = signal(5);
  readonly fechaActual = this.getBogotaDate();
  private readonly ubicaciones = signal<{ codigo: string; descripcion: string }[]>([]);

  registrosFiltrados = computed(() => {
    const term = this.filtro().trim().toLowerCase();
    if (!term) return this.registros();
    return this.registros().filter((item) => {
      const campos = [
        item.nombresNna,
        item.identificacionNna,
        this.mostrarUbicacion(item.origen),
        this.mostrarUbicacion(item.destino),
      ];
      return campos.some((c) => c.toLowerCase().includes(term));
    });
  });

  paginados = computed(() => {
    const size = Math.max(1, this.pageSize());
    const total = this.registrosFiltrados().length;
    const maxPage = Math.max(1, Math.ceil(total / size));
    const current = Math.min(this.page(), maxPage);
    const start = (current - 1) * size;
    return this.registrosFiltrados().slice(start, start + size);
  });

  ngOnInit(): void {
    this.parametricas.obtenerParametrica<{ codigo: string; descripcion: string }[]>('listar-centros-poblados').subscribe({
      next: (res) => this.ubicaciones.set(res ?? []),
    });

    this.fechaConsulta.set(this.fechaSalida() || this.getBogotaDate());
    this.cargarAutorizaciones();
  }

  onFechaChange(event: Event): void {
    const fecha = (event.target as HTMLInputElement).value ?? '';
    if (!fecha || fecha === this.fechaConsulta()) return;
    this.fechaConsulta.set(fecha);
    this.filtro.set('');
    this.page.set(1);
    this.cargarAutorizaciones();
  }

  private cargarAutorizaciones(): void {
    const nit = this.nit();
    const placa = this.placa();
    const fecha = this.fechaConsulta();
    if (!nit || !placa || !fecha) {
      this.registros.set([]);
      this.seleccionadas.set(new Set());
      this.emitSeleccion();
      return;
    }

    this.loading.set(true);
    this.registro.consultarAutorizaciones({ nit, placa, fecha }).subscribe({
      next: (resp: unknown) => {
        this.seleccionadas.set(new Set());
        this.registros.set(extraerAutorizaciones(resp));
        this.emitSeleccion();
      },
      error: () => {
        this.seleccionadas.set(new Set());
        this.registros.set([]);
        this.emitSeleccion();
      },
      complete: () => this.loading.set(false),
    });
  }

  etiquetaNna(item: AutorizacionDespachoItem): string {
    const nombre = item.nombresNna.trim();
    const id = item.identificacionNna.trim();
    if (nombre && id) return `${nombre} · ${id}`;
    return nombre || id || '—';
  }

  mostrarUbicacion(codigo?: string): string {
    if (!codigo) return '—';
    return this.ubicaciones().find((u) => String(u.codigo) === String(codigo))?.descripcion || codigo;
  }

  toggle(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.seleccionadas());
    if (checked) next.add(key);
    else next.delete(key);
    this.seleccionadas.set(next);
    this.emitSeleccion();
  }

  todosFiltradosSeleccionados(): boolean {
    const filtrados = this.registrosFiltrados();
    return filtrados.length > 0 && filtrados.every((item) => this.seleccionadas().has(item.key));
  }

  algunosFiltradosSeleccionados(): boolean {
    const filtrados = this.registrosFiltrados();
    const count = filtrados.filter((item) => this.seleccionadas().has(item.key)).length;
    return count > 0 && count < filtrados.length;
  }

  toggleTodosFiltrados(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.seleccionadas());
    for (const item of this.registrosFiltrados()) {
      if (checked) next.add(item.key);
      else next.delete(item.key);
    }
    this.seleccionadas.set(next);
    this.emitSeleccion();
  }

  onFiltro(event: Event): void {
    this.filtro.set((event.target as HTMLInputElement).value ?? '');
    this.page.set(1);
  }

  limpiarFiltro(): void {
    this.filtro.set('');
    this.page.set(1);
  }

  onPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  private emitSeleccion(): void {
    const mapa = new Map(this.registros().map((item) => [item.key, item.raw]));
    const seleccionadas = Array.from(this.seleccionadas())
      .map((key) => mapa.get(key))
      .filter((item): item is Record<string, unknown> => !!item);
    this.selectionChange.emit(seleccionadas);
  }

  private getBogotaDate(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  }
}
