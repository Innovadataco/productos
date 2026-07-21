import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UsuariosService } from './usuarios.service';
import { UsuarioListado, SubusuarioListado, SubusuarioPayload, ModuloItem } from './usuarios.models';
import { ModalComponent } from '../../shared/ui/modal.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith, of } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-subusuarios-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  template: `
    <app-modal [open]="open()" [title]="titulo()" size="xl" (closed)="onClosed()">
      @if (open()) {
        <div class="d-grid gap-3">
          @if (errorMsg()) { <div class="alert alert-danger py-2 mb-0">{{ errorMsg() }}</div> }

          <form class="row g-2" [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="col-md-4">
              <label class="form-label">Nombre</label>
              <input class="form-control" formControlName="nombre" />
            </div>
            <div class="col-md-4">
              <label class="form-label">Identificación</label>
              <input class="form-control" formControlName="identificacion" [readonly]="editTarget() !== null" />
            </div>
            <div class="col-md-4">
              <label class="form-label">Teléfono</label>
              <input class="form-control" formControlName="telefono" />
            </div>
            <div class="col-md-8">
              <label class="form-label">Correo</label>
              <input class="form-control" type="email" formControlName="correo" />
            </div>
            <div class="col-md-12">
              <label class="form-label fw-semibold">Módulos autorizados</label>
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="selAllSub" [checked]="allSelected()" (change)="onToggleAll($event)" />
                <label class="form-check-label" for="selAllSub">Seleccionar todos</label>
              </div>
              <div class="border rounded p-2" style="max-height: 200px; overflow:auto;">
                @for (m of modulosLista(); track m.id) {
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" [id]="'sm_'+m.id" [checked]="isChecked(m.id)" (change)="onToggleModulo(m.id, $event)" />
                    <label class="form-check-label" [for]="'sm_'+m.id">{{ m.nombre }}</label>
                  </div>
                }
              </div>
              <small class="text-muted">Solo se muestran los módulos disponibles, asignados a {{ nombreAdmin() }}.</small>
            </div>
            <div class="col-md-4 d-flex align-items-end justify-content-between gap-2">
              @if (editTarget()) {
                <div class="form-check form-switch ms-auto me-2 justify-content-end">
                  <input class="form-check-input" type="checkbox" id="estadoSwitchSub" formControlName="estado" />
                  <label class="form-check-label" for="estadoSwitchSub">Activo</label>
                </div>
              }
              <button class="btn-brand" type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Guardando...' : (editTarget() ? 'Actualizar' : 'Agregar') }}</button>
              <button class="btn btn-outline-secondary" type="button" (click)="cancelEdit()" [hidden]="!editTarget()" [disabled]="saving()">Cancelar</button>
            </div>
          </form>

          <div class="table-responsive border rounded">
            <table class="table table-sm align-middle mb-0">
              <thead class="table-light"><tr><th>Identificación</th><th>Nombre</th><th>Correo</th><th>Teléfono</th><th class="text-end">Acciones</th></tr></thead>
              <tbody>
                @if (loading()) {
                  <tr><td colspan="5" class="text-center py-4"><div class="spinner-border" role="status" aria-label="Cargando"></div></td></tr>
                } @else if (!lista().length) {
                  <tr><td colspan="5" class="text-center text-muted py-4">Sin subusuarios</td></tr>
                } @else {
                  @for (s of lista(); track s.id) {
                    <tr>
                      <td class="fw-semibold">{{ s.identificacion }}</td>
                      <td>{{ s.nombre }}</td>
                      <td>{{ s.correo || '—' }}</td>
                      <td>{{ s.telefono || '—' }}</td>
                      <td class="text-end">
                        <button class="btn btn-sm btn-outline-secondary" type="button" (click)="editar(s)" [disabled]="saving() || modulosLoading()">Editar</button>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubusuariosModalComponent {
  private readonly api = inject(UsuariosService);
  private readonly fb = inject(FormBuilder);

  open = input<boolean>(false);
  parent = input<UsuarioListado | null>(null);
  closed = output<void>();

  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  lista = signal<SubusuarioListado[]>([]);
  modulosLista = signal<ModuloItem[]>([]);
  modulosLoading = signal(false);
  private pendingModuloIds = signal<string[] | null>(null);
  editTarget = signal<SubusuarioListado | null>(null);
  private readonly cdr = inject(ChangeDetectorRef);

  titulo = computed(() => {
    const p = this.parent();
    return `Operadores de ${p?.nombre ?? ''}`.trim();
  });

  nombreAdmin = computed(() => {
    const p = this.parent();
    return p?.nombre ?? '';
  });

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    identificacion: ['', [Validators.required]],
    telefono: ['', [Validators.required, Validators.maxLength(10)]],
    correo: ['', [Validators.required, Validators.email]],
    modulos: this.fb.nonNullable.control<string[]>([]),
    estado: this.fb.nonNullable.control<boolean>(true),
  });

  private cargar() {
    const p = this.parent();
    if (!p) return;
    this.loading.set(true);
    this.errorMsg.set(null);
    this.api.listarSubusuarios(p.identificacion).subscribe({
      next: (items) => { this.lista.set(items ?? []); this.loading.set(false); },
      error: () => { this.errorMsg.set('No fue posible cargar los subusuarios.'); this.loading.set(false); },
    });
    // cargar módulos asignados al padre (excluyendo id=1) para limitar selección
    this.modulosLoading.set(true);
    this.api.obtenerModulosDeUsuarioDetallados(p.id).subscribe({
      next: (mods) => { this.modulosLista.set((mods ?? []).filter(m => Number(m.id) !== 1)); this.modulosLoading.set(false); this.cdr.markForCheck(); },
      error: () => { this.modulosLoading.set(false); this.cdr.markForCheck(); }
    });
  }

  // Garantiza que la lista de módulos del padre esté disponible antes de preseleccionar
  private ensureModulosDisponibles() {
    const actuales = this.modulosLista();
    if (actuales.length) return of(actuales);
    const p = this.parent();
    if (!p) return of([]);
    this.modulosLoading.set(true);
    return this.api.obtenerModulosDeUsuarioDetallados(p.id).pipe(
      tap((mods: any) => {
        const lista = (mods ?? []).filter((m: any) => Number(m.id) !== 1);
        this.modulosLista.set(lista);
        this.modulosLoading.set(false);
        this.cdr.markForCheck();
      }),
      catchError(() => { this.modulosLoading.set(false); return of([]); })
    );
  }

  onSubmit() {
    if (this.form.invalid || !this.parent()) return;
    const p = this.parent()!;
    const raw = this.form.getRawValue();
    const modulosIds = (this.form.controls.modulos.value ?? []).map(x => Number(x));
    const target = this.editTarget();
    this.saving.set(true);
    if (!target) {
      const payload: any = {
        nombre: raw.nombre,
        identificacion: Number(raw.identificacion),
        telefono: String(raw.telefono),
        correo: raw.correo,
        idRol: 3,
        tokenAutorizado: p.tokenAutorizado ?? '',
        administrador: p.identificacion,
      };
      this.api.crearUsuarioConAdmin(payload).subscribe({
        next: (resp) => {
          const done = () => { this.saving.set(false); this.form.reset({ nombre: '', identificacion: '', telefono: '', correo: '', modulos: [] }); this.cargar(); };
          const createdId = this.api.extractUserId(resp);
          if (createdId != null && modulosIds.length) {
            this.api.asignarModulosUsuario(createdId, modulosIds).subscribe({ next: done, error: done });
          } else { done(); }
        },
        error: () => { this.errorMsg.set('No fue posible crear el subusuario.'); this.saving.set(false); },
      });
    } else {
      const patch: any = {
        nombre: raw.nombre,
        telefono: String(raw.telefono),
        correo: raw.correo,
        estado: Boolean(raw.estado),
      };
      this.api.editarUsuario(target.identificacion, patch).subscribe({
        next: () => {
          const done = () => { this.saving.set(false); this.cancelEdit(); this.cargar(); };
          this.api.asignarModulosUsuario(target.id, modulosIds).subscribe({ next: done, error: done });
        },
        error: () => { this.errorMsg.set('No fue posible actualizar el subusuario.'); this.saving.set(false); },
      });
    }
      // nada más que hacer aquí
  }

  editar(s: SubusuarioListado) {
    this.editTarget.set(s);
    this.form.patchValue({
      nombre: s.nombre ?? '',
      identificacion: String(s.identificacion ?? ''),
      telefono: String(s.telefono ?? ''),
      correo: s.correo ?? '',
      estado: (s as any).estado ?? true,
    }, { emitEvent: false });
    // Asegurar módulos disponibles y luego marcar los asignados al subusuario
    this.ensureModulosDisponibles()
      .pipe(switchMap(() => this.api.obtenerModulosDeUsuario(s.id)))
      .subscribe({
        next: (ids: Array<string | number>) => {
          const allIds = (ids ?? []).map((x: any) => String(x));
          const dispSet = new Set(this.modulosLista().map(m => String(m.id)));
          const match = allIds.filter((id: string) => dispSet.has(id));
          this.form.controls.modulos.setValue(match, { emitEvent: true });
          this.cdr.markForCheck();
        }
      });
  }

  cancelEdit() {
    this.editTarget.set(null);
    this.form.reset({ nombre: '', identificacion: '', telefono: '', correo: '', modulos: [] });
  }

  onClosed() { this.closed.emit(); }

  // Efecto simple para cargar cuando abre o cambia el parent
  constructor() {
    effect(() => {
      if (this.open() && this.parent()) { this.cargar(); }
    });
    // Aplicar selección pendiente cuando los módulos del padre estén cargados
    effect(() => {
      const pending = this.pendingModuloIds();
      const mods = this.modulosLista();
      if (pending && mods.length) {
        const disponibles = new Set(mods.map(m => String(m.id)));
        const match = pending.filter(id => disponibles.has(id));
        this.form.controls.modulos.setValue(match, { emitEvent: true });
        this.pendingModuloIds.set(null);
      }
    });
  }

  // Helpers de checkboxes
  isChecked(id: number | string): boolean {
    const arr = (this.form.controls.modulos.value ?? []) as string[];
    return arr.includes(String(id));
  }
  onToggleModulo(id: number | string, e: Event) {
    const target = e.target as HTMLInputElement;
    const arr = new Set<string>(((this.form.controls.modulos.value ?? []) as string[]).map(String));
    if (target.checked) arr.add(String(id)); else arr.delete(String(id));
    this.form.controls.modulos.setValue(Array.from(arr), { emitEvent: true });
  }
  allSelected(): boolean {
    const current = (this.form.controls.modulos.value ?? []) as string[];
    const total = this.modulosLista().length;
    return total > 0 && current.length === total;
  }
  onToggleAll(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      const all = this.modulosLista().map(m => String(m.id));
      this.form.controls.modulos.setValue(all, { emitEvent: true });
    } else {
      this.form.controls.modulos.setValue([], { emitEvent: true });
    }
  }
}
