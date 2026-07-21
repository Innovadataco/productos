import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

@Component({
  selector: 'app-paginator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between">
      @if (showSummary()) {
        <div class="text-muted small">
          Página {{ page() }} de {{ totalPages() }} · {{ total() }} registros
        </div>
      }

      <div class="d-flex align-items-center gap-2 ms-auto">
        <label class="small text-muted">Mostrar</label>
        <select class="form-select form-select-sm" style="width: auto;" [value]="pageSize()" (change)="onPageSize($any($event.target).value)">
          @for (s of pageSizeOptions(); track s) { <option [value]="s">{{ s }}</option> }
        </select>

        <div class="btn-group btn-group-sm" role="group" aria-label="Paginación">
          <button type="button" class="btn btn-outline-secondary" (click)="goFirst()" [disabled]="page()<=1">Primera</button>
          <button type="button" class="btn btn-outline-secondary" (click)="goPrev()" [disabled]="page()<=1">Anterior</button>

          <!-- Números -->
          @for (it of items(); track it.key) {
            @if (it.kind==='page') {
              <button type="button" class="btn btn-outline-secondary" [class.active]="it.value===page()" (click)="go(it.value)" [attr.aria-current]="it.value===page() ? 'page' : null">{{ it.value }}</button>
            } @else {
              <button type="button" class="btn btn-outline-secondary" disabled aria-hidden="true">…</button>
            }
          }

          <button type="button" class="btn btn-outline-secondary" (click)="goNext()" [disabled]="page()>=totalPages()">Siguiente</button>
          <button type="button" class="btn btn-outline-secondary" (click)="goLast()" [disabled]="page()>=totalPages()">Última</button>
        </div>

        <div class="input-group input-group-sm" style="width: 120px;">
          <span class="input-group-text">Ir a</span>
          <input type="number" class="form-control" [min]="1" [max]="totalPages()" [value]="page()" (keyup.enter)="onJump($any($event.target).value)" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .btn.active { background: #0d6efd; color: #fff; border-color: #0d6efd; }
  `]
})
export class PaginatorComponent {
  // Inputs
  total = input<number>(0);
  page = input<number>(1);
  pageSize = input<number>(5);
  pageSizeOptions = input<number[]>([5, 10, 25, 50, 100]);
  maxButtons = input<number>(5);
  storageKey = input<string | null>(null);
  showSummary = input<boolean>(true);

  // Outputs
  pageChange = output<number>();
  pageSizeChange = output<number>();

  totalPages = computed(() => {
    const size = Math.max(1, Number(this.pageSize()) || 1);
    const total = Math.max(0, Number(this.total()) || 0);
    return Math.max(1, Math.ceil(total / size));
  });

  private normalizedPage = computed(() => clamp(this.page() || 1, 1, this.totalPages()));

  items = computed(() => {
    const total = this.totalPages();
    const max = Math.max(3, this.maxButtons());
    const current = this.normalizedPage();
    const pages: number[] = [];

    if (total <= max) {
      for (let i=1;i<=total;i++) pages.push(i);
    } else {
      const half = Math.floor((max - 3) / 2);
      let start = Math.max(2, current - half);
      let end = Math.min(total - 1, current + half);

      const needed = (max - 2) - (end - start + 1);
      if (needed > 0) {
        if (start === 2) end = Math.min(total - 1, end + needed);
        else if (end === total - 1) start = Math.max(2, start - needed);
      }

      pages.push(1);
      if (start > 2) pages.push(-1 as any);
      for (let p = start; p <= end; p++) pages.push(p);
      if (end < total - 1) pages.push(-1 as any);
      pages.push(total);
    }

    return pages.map((p, idx) => p === ( -1 as any)
      ? { kind: 'ellipsis' as const, key: `e-${idx}` }
      : { kind: 'page' as const, value: p, key: `p-${p}` }
    );
  });

  // Persistence
  _restore = effect(() => {
    const key = this.storageKey();
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const { page, pageSize } = JSON.parse(raw);
      if (Number.isFinite(pageSize)) this.pageSizeChange.emit(Math.max(1, Number(pageSize)));
      if (Number.isFinite(page)) this.pageChange.emit(Math.max(1, Number(page)));
    } catch { /* ignore */ }
  }, { allowSignalWrites: true });

  /** Si el total baja (p. ej. al abrir un modal), evita quedar en una página vacía. */
  _clampPage = effect(() => {
    const max = this.totalPages();
    const current = this.page() || 1;
    if (current > max) this.pageChange.emit(max);
  });

  _persist = effect(() => {
    const key = this.storageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({ page: this.normalizedPage(), pageSize: this.pageSize() }));
    } catch { /* ignore */ }
  });

  go(n: number) { this.pageChange.emit(clamp(Number(n)||1, 1, this.totalPages())); }
  goPrev() { this.go(this.normalizedPage() - 1); }
  goNext() { this.go(this.normalizedPage() + 1); }
  goFirst() { this.go(1); }
  goLast() { this.go(this.totalPages()); }
  onJump(v: unknown) { this.go(Number(v)||1); }
  onPageSize(v: unknown) {
    const size = Math.max(1, Number(v) || 10);
    this.pageSizeChange.emit(size);
    // Alinear página actual a rango válido
    const total = this.totalPages();
    if (this.page() > total) this.pageChange.emit(total);
  }
}
