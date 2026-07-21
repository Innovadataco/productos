import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, input, output, signal, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormControl } from '@angular/forms';
import { RolItem, UsuarioListado, UsuarioPayload, ModuloItem } from './usuarios.models';
import { CommonModule } from '@angular/common';
import { UsuariosService } from './usuarios.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, of, startWith, Subscription, take } from 'rxjs';

export type UsuarioFormMode = 'create' | 'edit';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <div class="position-relative">
      @if (cargando()) {
        <div class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white bg-opacity-75" style="z-index: 2;">
          <div class="d-flex align-items-center gap-2 text-muted">
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            <span>Cargando…</span>
          </div>
        </div>
      }

      <form class="d-grid gap-3" [formGroup]="form" (ngSubmit)="onSubmit()">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label fw-semibold" for="nombre">Nombre</label>
          <input id="nombre" type="text" class="form-control" formControlName="nombre" required placeholder="Ej: César Mora" />
          @if (invalid(nombre)) { <p class="text-danger small mb-0">Requerido.</p> }
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold" for="ident">Identificación (NIT)</label>
          <input id="ident" type="text" class="form-control" formControlName="identificacion" [disabled]="mode() === 'edit'" required placeholder="Ej: 800086050" />
          @if (invalid(identificacion)) { <p class="text-danger small mb-0">Requerido.</p> }
        </div>
      </div>

      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label fw-semibold" for="tel">Teléfono</label>
          <input id="tel" type="text" class="form-control" formControlName="telefono" required maxlength="10" inputmode="numeric" (input)="onTelefonoInput($event)" autocomplete="tel" placeholder="Ej: 3001234567" />
          @if (invalid(telefono)) { <p class="text-danger small mb-0">Debe tener exactamente 10 dígitos numéricos.</p> }
        </div>
        <div class="col-md-6">
          <label class="form-label fw-semibold" for="correo">Correo</label>
          <input id="correo" type="email" class="form-control" formControlName="correo" required placeholder="Ej: usuario@dominio.com" />
          @if (invalid(correo)) { <p class="text-danger small mb-0">Correo inválido o vacío.</p> }
        </div>
      </div>

      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label fw-semibold" for="rol">Rol</label>
          <select id="rol" class="form-select" formControlName="idRol" required (change)="rolSeleccionado($event)" [disabled]="mode() === 'edit'">
            <option value="" disabled>Seleccione</option>
            @for (r of roles(); track r.id) { <option [value]="r.id">{{ r.nombre }}</option> }
          </select>
          @if (invalid(idRol)) { <p class="text-danger small mb-0">Seleccione un rol.</p> }
        </div>
        @if (esCliente()) {
        <div class="col-md-6">
          <label class="form-label fw-semibold" for="token">Token autorizado (solo cliente)</label>
          <input id="token" type="text" class="form-control" formControlName="tokenAutorizado" [required]="esCliente()" placeholder="Ej: 34346af4-949d-4f72-bcc6-19d7633b414e" />
          @if (esCliente() && invalid(tokenAutorizado)) { <p class="text-danger small mb-0">Requerido para clientes.</p> }
        </div>
        }
      </div>

      @if (esCliente()) {
      <div class="row g-3">
        <div class="col-12">
          <label class="form-label fw-semibold" for="modulos">Módulos autorizados</label>
          <div class="form-check mb-2">
            <input class="form-check-input" type="checkbox" id="selAll" [checked]="allSelected()" (change)="onToggleAll($event)" />
            <label class="form-check-label" for="selAll">Seleccionar todos</label>
          </div>
          <div class="border rounded p-2" style="max-height: 220px; overflow: auto;" id="modulos">
            @for (m of modulosLista(); track m.id) {
              <div class="form-check">
                <input class="form-check-input" type="checkbox" [id]="'mod_'+m.id" [checked]="isChecked(m.id)" (change)="onToggleModulo(m.id, $event)" />
                <label class="form-check-label" [for]="'mod_'+m.id">{{ m.nombre }}</label>
              </div>
            }
          </div>
          <small class="text-muted d-block">Marca uno o varios módulos disponibles para el Cliente.</small>
          <!-- <div class="mt-2">
            @if (selectedModulos().length) {
              <div class="d-flex flex-wrap gap-1">
                @for (m of selectedModulos(); track m.id) { <span class="badge bg-secondary">{{ m.nombre }}</span> }
              </div>
            } @else {
              <small class="text-muted">No hay módulos seleccionados.</small>
            }
          </div> -->
        </div>
      </div>
      }

      <div class="d-flex justify-content-between gap-2">
        <button class="btn btn-outline-secondary" type="button" (click)="cancel.emit()" [disabled]="saving()">Cancelar</button>
        <div class="d-flex justify-content-end align-items-center gap-3">
          @if (mode() === 'edit') {
            <div class="form-check form-switch me-auto">
              <input class="form-check-input" type="checkbox" id="estadoSwitch" formControlName="estado" />
              <label class="form-check-label" for="estadoSwitch">Activo</label>
            </div>
          }
          <button class="btn-brand" type="submit" [disabled]="saving() || form.invalid">
            {{ saving() ? 'Guardando…' : (mode() === 'edit' ? 'Actualizar' : 'Crear') }}
          </button>
        </div>
      </div>
      </form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuarioFormComponent implements OnDestroy {
  private readonly fb = new FormBuilder();
  private readonly api = inject(UsuariosService);
  private modulosLoadSub: Subscription | null = null;

  mode = input<UsuarioFormMode>('create');
  roles = input<readonly RolItem[]>([]);
  initial = input<UsuarioListado | null>(null);
  saving = input<boolean>(false);

  submit = output<{ payload: UsuarioPayload | Partial<UsuarioPayload>; modulos: number[] }>();
  cancel = output<void>();

  cargando = signal<boolean>(false);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    identificacion: ['', [Validators.required]],
  telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    correo: ['', [Validators.required, Validators.email]],
    tokenAutorizado: [''],
    modulos: this.fb.nonNullable.control<string[]>([]),
    idRol: ['', Validators.required],
    estado: this.fb.nonNullable.control<boolean>(true),
  });

  readonly nombre = this.form.controls.nombre as FormControl<string>;
  readonly identificacion = this.form.controls.identificacion as FormControl<string>;
  readonly telefono = this.form.controls.telefono as FormControl<string>;
  readonly correo = this.form.controls.correo as FormControl<string>;
  readonly tokenAutorizado = this.form.controls.tokenAutorizado as FormControl<string>;
  readonly idRol = this.form.controls.idRol as FormControl<string>;

  // Puente a signals para reaccionar a cambios de rol
  private readonly idRolValue = toSignal(this.idRol.valueChanges.pipe(startWith(this.idRol.value)));
  private readonly modulosValue = toSignal(this.form.controls.modulos.valueChanges.pipe(startWith(this.form.controls.modulos.value)));

  private _sync = effect(() => {
    const data = this.initial();
    if (data) {
      this.form.reset({
        nombre: data.nombre ?? '',
        identificacion: String(data.identificacion ?? ''),
        telefono: String((data.telefono ?? '').toString().replace(/\D/g, '').slice(0, 10)),
        correo: String(data.correo ?? ''),
        tokenAutorizado: data.tokenAutorizado ?? '',
        idRol: String(data.idRol ?? ''),
        modulos: [],
        estado: (data as any).estado ?? true,
      });
    } else {
      this.form.reset({ nombre: '', identificacion: '', telefono: '', correo: '', tokenAutorizado: '', idRol: '', modulos: [], estado: true });
    }
  }, { allowSignalWrites: true });

  private _rolLock = effect(() => {
    if (this.mode() === 'edit') {
      if (!this.idRol.disabled) this.idRol.disable({ emitEvent: false });
    } else {
      if (this.idRol.disabled) this.idRol.enable({ emitEvent: false });
    }
  });

  private _identLock = effect(() => {
    if (this.mode() === 'edit') {
      if (!this.identificacion.disabled) this.identificacion.disable({ emitEvent: false });
    } else {
      if (this.identificacion.disabled) this.identificacion.enable({ emitEvent: false });
    }
  });

  // Dinamiza obligatoriedad de token según rol (Cliente = 2)
  private _tokenReqWatcher = effect(() => {
    const isCliente = Number(this.idRolValue() ?? 0) === 2;
    if (isCliente) {
      this.tokenAutorizado.addValidators(Validators.required);
    } else {
      this.tokenAutorizado.removeValidators(Validators.required);
    }
    this.tokenAutorizado.updateValueAndValidity({ emitEvent: false });
  });

  // Cargar módulos y selección de cliente en edición de forma confiable
  private _modulosLoader = effect(() => {
    const isCliente = Number(this.idRolValue() ?? 0) === 2;
    const data = this.initial();

    // Cancelar solicitudes previas si cambia el rol
    this.modulosLoadSub?.unsubscribe();
    if (!isCliente) {
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    const modulos$ = this.api.obtenerModulosRol();
    const seleccionados$ = data?.id != null ? this.api.obtenerModulosDeUsuario(data.id) : of<string[]>([]);

    this.modulosLoadSub = forkJoin([modulos$, seleccionados$]).pipe(take(1)).subscribe({
      next: ([items, ids]) => {
        this.modulosLista.set(items ?? []);
        this.form.controls.modulos.setValue((ids ?? []).map(String), { emitEvent: false });
      },
      error: () => {
        this.modulosLista.set([]);
        this.cargando.set(false);
      },
      complete: () => this.cargando.set(false),
    });
  });

  invalid(ctrl: FormControl<unknown>) { return ctrl.invalid && ctrl.touched; }

  onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    const telSan = String(raw.telefono ?? '').replace(/\D/g, '').slice(0, 10);
    // Solo incluir tokenAutorizado si el rol es Cliente (idRol === 2)
    const idRolNum = Number(raw.idRol);
    const base: UsuarioPayload = {
      nombre: raw.nombre,
      identificacion: Number(raw.identificacion),
      telefono: telSan,
      correo: raw.correo ?? '',
      idRol: idRolNum,
      estado: Boolean(raw.estado),
    };
    if (idRolNum === 2) {
      (base as any).tokenAutorizado = raw.tokenAutorizado ?? '';
    }
    const payload = base;
    const modulos = Number(idRolNum) === 2 ? (raw.modulos ?? []).map((x: string) => Number(x)) : [];
    this.submit.emit({ payload, modulos });
  }

  esCliente() {
    const idRolVal = Number(this.idRol.value);
    return idRolVal === 2; // rol Cliente
  }

  rolSeleccionado(e: Event) {

  }

  onTelefonoInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    if (digits !== input.value) {
      this.telefono.setValue(digits, { emitEvent: false });
    }
  }

  // Estado de módulos
  modulosLista = signal<ModuloItem[]>([]);
  selectedModulos = computed(() => {
    const ids = new Set<string>((this.modulosValue() as string[]) ?? []);
    return (this.modulosLista() ?? []).filter(m => ids.has(String(m.id)));
  });

  // Helpers selección de módulos con checkboxes
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

  ngOnDestroy(): void {
    this.modulosLoadSub?.unsubscribe();
  }
}
