import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsuariosService } from './usuarios.service';
import { ServicioLocalStorage } from '../../administrador/servicios/local-storage.service';
import { SubusuarioListado, SubusuarioPayload, UsuarioListado, ModuloItem } from './usuarios.models';
import { of } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-subusuarios-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="container-fluid py-3 d-grid gap-3">
      <header class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
        <div>
          <h3 class="mb-1">Operadores</h3>
          <p class="text-muted mb-0">Gestión de operadores vinculados.</p>
        </div>
      </header>

      <section class="card border-1 shadow-sm">
        <div class="card-body d-grid gap-3">
          @if (errorMsg()) { <div class="alert alert-danger py-2 mb-0">{{ errorMsg() }}</div> }

          <form class="row g-2" [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="col-md-3">
              <label class="form-label">Nombre</label>
              <input class="form-control" formControlName="nombre" />
            </div>
            <div class="col-md-3">
              <label class="form-label">Identificación</label>
              <input class="form-control" formControlName="identificacion" [readonly]="editTarget() !== null" />
            </div>
            <div class="col-md-2">
              <label class="form-label">Teléfono</label>
              <input class="form-control" maxlength="10" formControlName="telefono" />
            </div>
            <div class="col-md-4">
              <label class="form-label">Correo</label>
              <input class="form-control" type="email" formControlName="correo" />
            </div>
            <div class="col-12">
              <label class="form-label fw-semibold">Módulos autorizados</label>
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="selAllPage" [checked]="allSelected()" (change)="onToggleAll($event)" />
                <label class="form-check-label" for="selAllPage">Seleccionar todos</label>
              </div>
              <div class="border rounded p-2 position-relative" style="max-height: 220px; overflow:auto;">
                @if (modulosLoading()) {
                  <div class="text-center py-2"><div class="spinner-border spinner-border-sm" aria-label="Cargando módulos"></div></div>
                }
                @for (m of modulosLista(); track m.id) {
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" [id]="'pm_'+m.id" [checked]="isChecked(m.id)" (change)="onToggleModulo(m.id, $event)" />
                    <label class="form-check-label" [for]="'pm_'+m.id">{{ m.nombre }}</label>
                  </div>
                }
              </div>
              <small class="text-muted">El módulo principal quedará excluido automáticamente.</small>
            </div>
            <div class="col-12 d-flex justify-content-end align-items-center">
              <div class="d-flex justify-content-end align-items-center gap-2">
                @if (editTarget()) {
                  <div class="form-check form-switch me-auto me-2">
                    <input class="form-check-input" type="checkbox" id="estadoSwitchPage" formControlName="estado" />
                    <label class="form-check-label" for="estadoSwitchPage">Activo</label>
                  </div>
                }
                <button class="btn-brand" type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Guardando...' : (editTarget() ? 'Actualizar' : 'Agregar') }}</button>
              </div>
              <button class="btn btn-outline-secondary ms-2" type="button" (click)="cancelEdit()" [hidden]="!editTarget()" [disabled]="saving()">Cancelar</button>
            </div>
          </form>

          <div class="table-responsive border rounded">
            <table class="table table-sm align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Identificación</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th class="text-end">Acciones</th></tr></thead>
              <tbody>
                @if (loading()) {
                  <tr><td colspan="6" class="text-center py-4"><div class="spinner-border" role="status" aria-label="Cargando"></div></td></tr>
                } @else if (!lista().length) {
                  <tr><td colspan="5" class="text-center text-muted py-4">Sin operadores</td></tr>
                } @else {
                  @for (s of lista(); track s.id) {
                    <tr>
                      <td class="fw-semibold">{{ s.identificacion }}</td>
                      <td>{{ s.nombre }}</td>
                      <td>{{ s.correo || '—' }}</td>
                      <td>{{ s.telefono || '—' }}</td>
                      <td>
                        @if (s.estado) {
                          <span class="badge bg-success">Activo</span>
                        } @else {
                          <span class="badge bg-secondary">Inactivo</span>
                        }
                      </td>
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
      </section>
    </div>
  `,
  styles: [':host{display:block;}'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubusuariosPageComponent {
  private readonly api = inject(UsuariosService);
  private readonly fb = inject(FormBuilder);
  private readonly storage = inject(ServicioLocalStorage);
  private readonly cdr = inject(ChangeDetectorRef);

  // Sólo rol 1 puede seleccionar otro titular; rol 2 usa su propio usuario como parentId
  protected readonly rolId = signal<number>(0);
  protected readonly parentUserId = signal<number | string | null>(null);
  protected readonly parentIdent = signal<string | number | null>(null);
  protected readonly parentToken = signal<string | null>(null);

  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  lista = signal<SubusuarioListado[]>([]);
  modulosLista = signal<ModuloItem[]>([]);
  modulosLoading = signal(false);
  editTarget = signal<SubusuarioListado | null>(null);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    identificacion: ['', [Validators.required]],
    telefono: ['', [Validators.required, Validators.maxLength(10)]],
    correo: ['', [Validators.required, Validators.email]],
    modulos: this.fb.nonNullable.control<string[]>([]),
    estado: this.fb.nonNullable.control<boolean>(true),
  });

  constructor() {
    effect(() => {
      const rol = this.storage.obtenerRol();
      this.rolId.set(Number(rol?.id ?? 0));
      const usuario = this.storage.obtenerUsuario();
      // Para rol 2 usar el usuario logueado como padre: id para módulos, usuario (identificación) para filtro administrador
      if (usuario) {
        this.parentUserId.set(usuario.id);
        this.parentIdent.set(usuario.usuario);
        // Cargar tokenAutorizado del padre desde listado (rol=true) para reusar en creación
        this.api.listarUsuarios({ rol: true, termino: usuario.usuario }).subscribe({
          next: (items) => {
            console.log('Usuarios cargados para tokenAutorizado:', items);
            const found = (items ?? []).find(u => String(u.identificacion) === String(usuario.usuario));
            this.parentToken.set(found?.tokenAutorizado ?? null);
            this.cdr.markForCheck();
          },
          error: () => {}
        });
      }
      if (this.parentUserId()) {
        this.cargar();
        this.cargarModulosPadre();
      }
    });
  }

  private cargar() {
    const adminIdent = this.parentIdent();
    if (!adminIdent) return;
    this.loading.set(true);
    this.errorMsg.set(null);
    this.api.listarSubusuarios(adminIdent).subscribe({
      next: (items) => {
        console.log('Subusuarios cargados:', items);
        this.lista.set(items ?? []); this.loading.set(false);
      },
      error: () => { this.errorMsg.set('No fue posible cargar los subusuarios.'); this.loading.set(false); },
    });
  }

  private cargarModulosPadre() {
    const pid = this.parentUserId();
    if (!pid) return;
    this.modulosLoading.set(true);
    this.api.obtenerModulosDeUsuarioDetallados(pid).subscribe({
      next: (mods) => { this.modulosLista.set((mods ?? []).filter(m => Number(m.id) !== 1)); this.modulosLoading.set(false); this.cdr.markForCheck(); },
      error: () => { this.modulosLoading.set(false); this.cdr.markForCheck(); }
    });
  }

  onSubmit() {
    if (this.form.invalid || !this.parentUserId() || !this.parentIdent()) return;
    const raw = this.form.getRawValue();
    const pid = this.parentUserId()!;
    const adminIdent = this.parentIdent()!;
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
        tokenAutorizado: this.parentToken() ?? '',
        administrador: adminIdent,
      };
      this.api.crearUsuarioConAdmin(payload).subscribe({
        next: (resp) => {
          const done = () => { this.saving.set(false); this.form.reset({ nombre: '', identificacion: '', telefono: '', correo: '', modulos: [] }); this.cargar(); };
          const createdId = this.api.extractUserId(resp);
          if (createdId != null && modulosIds.length) {
            this.api.asignarModulosUsuario(createdId, modulosIds).subscribe({ next: done, error: done });
          } else { done(); }
        },
        error: () => { this.errorMsg.set('No fue posible crear el operador.'); this.saving.set(false); },
      });
    } else {
      const patch: any = { nombre: raw.nombre, telefono: String(raw.telefono), correo: raw.correo, estado: Boolean(raw.estado) };
      this.api.editarUsuario(target.identificacion, patch).subscribe({
        next: () => {
          const done = () => { this.saving.set(false); this.cancelEdit(); this.cargar(); };
          this.api.asignarModulosUsuario(target.id, modulosIds).subscribe({ next: done, error: done });
        },
        error: () => { this.errorMsg.set('No fue posible actualizar el operador.'); this.saving.set(false); },
      });
    }
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

  private ensureModulosDisponibles() {
    const actuales = this.modulosLista();
    if (actuales.length) return of(actuales);
    const pid = this.parentUserId();
    if (!pid) return of([] as ModuloItem[]);
    this.modulosLoading.set(true);
    return this.api.obtenerModulosDeUsuarioDetallados(pid).pipe(
      tap((mods: any) => {
        const lista = (mods ?? []).filter((m: any) => Number(m.id) !== 1);
        this.modulosLista.set(lista);
        this.modulosLoading.set(false);
        this.cdr.markForCheck();
      })
    );
  }

  // Checkboxes helpers
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
