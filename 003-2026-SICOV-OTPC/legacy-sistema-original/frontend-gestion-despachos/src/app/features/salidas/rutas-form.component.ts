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
import { ObjRutasIntegracion } from '../../despachos/models/Integracion';

export interface RutaActivaItem {
  key: string;
  idRuta: number;
  origen: string;
  destino: string;
  codOrigen: string;
  codDestino: string;
  vias: { id: number; via: string }[];
  raw: Record<string, unknown>;
}

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function normalizarRutaItem(raw: unknown): RutaActivaItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const idRuta = Number(obj['idRuta'] ?? obj['id'] ?? 0);
  if (!idRuta) return null;

  const origen = pickStr(obj, 'descripcionOrigen', 'detalleOrigen', 'origen');
  const destino = pickStr(obj, 'descripcionDestino', 'detalleDestino', 'destino');
  const codOrigen = pickStr(obj, 'codOrigen', 'centroPobladoOrigen', 'idOrigen');
  const codDestino = pickStr(obj, 'codDestino', 'centroPobladoDestino', 'idDestino');
  const viasRaw = Array.isArray(obj['via']) ? obj['via'] : [];
  const vias = viasRaw
    .map((v) => {
      if (!v || typeof v !== 'object') return null;
      const viaObj = v as Record<string, unknown>;
      const id = Number(viaObj['id'] ?? 0);
      const nombre = pickStr(viaObj, 'via', 'nombre');
      if (!id && !nombre) return null;
      return { id, via: nombre };
    })
    .filter((v): v is { id: number; via: string } => !!v);

  return {
    key: String(idRuta),
    idRuta,
    origen,
    destino,
    codOrigen,
    codDestino,
    vias,
    raw: obj,
  };
}

export function extraerRutasActivas(resp: unknown): RutaActivaItem[] {
  if (Array.isArray(resp)) {
    return resp.map(normalizarRutaItem).filter((item): item is RutaActivaItem => !!item);
  }
  const root = resp as Record<string, unknown> | null | undefined;
  const list = Array.isArray(root?.['rutas'])
    ? (root['rutas'] as unknown[])
    : Array.isArray(root?.['array_data'])
      ? (root['array_data'] as unknown[])
      : Array.isArray(root?.['data'])
        ? (root['data'] as unknown[])
        : [];
  return list.map(normalizarRutaItem).filter((item): item is RutaActivaItem => !!item);
}

export function mapearRutaSeleccionada(
  item: RutaActivaItem,
  viaId: number | null | undefined
): ObjRutasIntegracion {
  const raw = item.raw;
  const idOrigen = pickStr(raw, 'idOrigen', 'codOrigen') || item.codOrigen;
  const idDestino = pickStr(raw, 'idDestino', 'codDestino') || item.codDestino;
  return {
    idRutaAutorizada: String(item.idRuta),
    idOrigen,
    detalleOrigen: pickStr(raw, 'detalleOrigen', 'descripcionOrigen') || item.origen,
    idDestino,
    detalleDestino: pickStr(raw, 'detalleDestino', 'descripcionDestino'),
    via: viaId != null ? String(viaId) : '',
    centroPobladoOrigen: pickStr(raw, 'centroPobladoOrigen') || item.origen,
    centroPobladoDestino: pickStr(raw, 'centroPobladoDestino') || item.destino,
  };
}

@Component({
  selector: 'app-rutas-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [PaginatorComponent],
  template: `
    <div class="d-grid gap-3">
      @if (loading()) {
        <div class="text-muted small py-2">Cargando rutas…</div>
      } @else if (registros().length) {
        <div class="d-flex justify-content-end">
          <div class="input-group input-group-sm" style="max-width: 280px;">
            <input
              type="search"
              class="form-control"
              placeholder="Buscar origen o destino"
              [value]="filtro()"
              (input)="onFiltro($event)"
            />
            @if (filtro()) {
              <button type="button" class="btn-outline-brand btn-brand--sm" (click)="limpiarFiltro()">Limpiar</button>
            }
          </div>
        </div>

        <div class="table-responsive border rounded">
          <table class="table table-sm align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th style="width: 50px;">#</th>
                <th>Origen</th>
                <th>Destino</th>
                <th style="min-width: 180px;">Vía (opcional)</th>
                <th style="width: 48px;" class="text-center">Sel.</th>
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
                    <td>{{ item.origen || '—' }}</td>
                    <td>{{ item.destino || '—' }}</td>
                    <td>
                      @if (item.vias.length) {
                        <select
                          class="form-select form-select-sm"
                          [value]="viaSeleccionada(item.key) ?? ''"
                          (change)="onViaChange(item.key, $event)"
                        >
                          <option value="">—</option>
                          @for (via of item.vias; track via.id) {
                            <option [value]="via.id">{{ via.via }}</option>
                          }
                        </select>
                      } @else {
                        <span class="text-muted small">—</span>
                      }
                    </td>
                    <td class="text-center">
                      <input
                        type="checkbox"
                        class="form-check-input"
                        [checked]="seleccionada() === item.key"
                        (change)="seleccionarRuta(item.key, $event)"
                        [attr.aria-label]="'Seleccionar ruta ' + item.origen + ' - ' + item.destino"
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
            <small class="text-muted">{{ registros().length }} ruta(s)</small>
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
        <p class="text-muted small mb-0">No hay rutas activas disponibles para esta empresa.</p>
      }
    </div>
  `,
})
export class RutasFormComponent implements OnInit {
  nit = input<string>('');
  selectionChange = output<ObjRutasIntegracion | null>();

  private readonly registro = inject(SalidasRegistroService);

  loading = signal(false);
  registros = signal<RutaActivaItem[]>([]);
  seleccionada = signal<string | null>(null);
  viasPorRuta = signal<Record<string, number | null>>({});
  filtro = signal('');
  page = signal(1);
  pageSize = signal(5);

  registrosFiltrados = computed(() => {
    const term = this.filtro().trim().toLowerCase();
    if (!term) return this.registros();
    return this.registros().filter((item) =>
      [item.origen, item.destino].some((c) => c.toLowerCase().includes(term))
    );
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
    const nit = this.nit();
    if (!nit) {
      this.emitSeleccion();
      return;
    }

    this.loading.set(true);
    this.registro.obtenerRutas(nit).subscribe({
      next: (resp: unknown) => {
        this.seleccionada.set(null);
        this.viasPorRuta.set({});
        this.registros.set(extraerRutasActivas(resp));
        this.emitSeleccion();
      },
      error: () => {
        this.seleccionada.set(null);
        this.viasPorRuta.set({});
        this.registros.set([]);
        this.emitSeleccion();
      },
      complete: () => this.loading.set(false),
    });
  }

  viaSeleccionada(key: string): number | null {
    return this.viasPorRuta()[key] ?? null;
  }

  onViaChange(key: string, event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    const viaId = raw ? Number(raw) : null;
    this.viasPorRuta.update((prev) => ({ ...prev, [key]: viaId }));
    if (this.seleccionada() === key) this.emitSeleccion();
  }

  seleccionarRuta(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.seleccionada.set(key);
    } else if (this.seleccionada() === key) {
      this.seleccionada.set(null);
    }
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
    const key = this.seleccionada();
    if (!key) {
      this.selectionChange.emit(null);
      return;
    }
    const item = this.registros().find((r) => r.key === key);
    if (!item) {
      this.selectionChange.emit(null);
      return;
    }
    this.selectionChange.emit(mapearRutaSeleccionada(item, this.viasPorRuta()[key]));
  }
}
