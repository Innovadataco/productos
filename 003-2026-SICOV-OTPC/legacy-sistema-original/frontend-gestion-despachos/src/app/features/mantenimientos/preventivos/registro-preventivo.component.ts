import { ChangeDetectionStrategy, Component, inject, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { RetryContext, RetrySubmit } from '../../../core/models/retry-context.models';
import { ServiciosMantenimientos } from '../../../mantenimientos/servicios/mantenimientos.service';
import { ParametricasService, TipoIdentificacion } from '../../../parametricas/servicios/parametricas.service';
import { ServicioLocalStorage } from '../../../administrador/servicios/local-storage.service';

@Component({
  selector: 'app-registro-preventivo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid py-3">
      <div class="d-flex align-items-center gap-2 mb-3" *ngIf="!inModal()">
        <button class="btn btn-light border" (click)="volver()">
          <i class="bi bi-arrow-left"></i>
        </button>
        <h3 class="mb-0">Registro de mantenimiento preventivo</h3>
      </div>

      <div class="card shadow-sm">
        <div class="card-body">
          <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
            <div class="row g-3 mb-3" *ngIf="retryMode()">
              <div class="col-md-6">
                <label class="form-label">Placa</label>
                <input class="form-control" type="text" formControlName="placa" autocomplete="off" />
                <div class="text-danger small" *ngIf="hasError('placa')">Requerido</div>
              </div>
              <div class="col-md-6">
                <label class="form-label">NIT empresa de transporte</label>
                <input class="form-control" type="text" formControlName="nitVigilado" (input)="onNitInput($event)" autocomplete="off" maxlength="15"/>
                <div class="text-danger small" *ngIf="hasError('nitVigilado')">
                  <span *ngIf="form.get('nitVigilado')?.errors?.['required']">Requerido</span>
                  <span *ngIf="form.get('nitVigilado')?.errors?.['pattern']">Sólo números</span>
                </div>
              </div>
            </div>
            <!-- Fila 1 (sin campo de placa; la placa viene del registro que abre el modal) -->
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Fecha</label>
                <input class="form-control" type="date" [max]="hoy" formControlName="fecha" (input)="onFechaInput($event)" />
                <div class="text-danger small" *ngIf="hasError('fecha')">Fecha inválida</div>
              </div>
              <div class="col-md-6">
                <label class="form-label">Hora</label>
                <input class="form-control" type="time" formControlName="hora" (input)="onHoraInput($event)" />
                <div class="text-danger small" *ngIf="hasError('hora')">Hora inválida</div>
              </div>
            </div>
            <div *ngIf="form.hasError('futureDate') || form.hasError('futureTimeToday')" class="alert alert-warning py-1 small mb-0 mt-2">
              <span *ngIf="form.hasError('futureDate')">La fecha y hora no pueden ser futuras.</span>
              <span *ngIf="!form.hasError('futureDate') && form.hasError('futureTimeToday')">La hora no puede ser mayor a la actual.</span>
            </div>

            <!-- Fila 2: Centro especializado -->
            <div class="border-top pt-3 mt-3">
              <label class="form-label text-muted fw-semibold">Información del Centro especializado</label>
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-label">NIT</label>
                  <input class="form-control" formControlName="nit" (input)="onNitInput($event)" maxlength="15"/>
                  <div class="text-danger small" *ngIf="hasError('nit')">
                    <span *ngIf="form.get('nit')?.errors?.['required']">Requerido</span>
                    <span *ngIf="form.get('nit')?.errors?.['pattern']">Sólo números</span>
                  </div>
                </div>
                <div class="col-md-8">
                  <label class="form-label">Razón Social</label>
                  <input class="form-control" formControlName="razonSocial" />
                  <div class="text-danger small" *ngIf="hasError('razonSocial')">Requerido</div>
                </div>
              </div>
            </div>

            <!-- Fila 3: Ingeniero mecánico -->
            <div class="border-top pt-3 mt-3">
              <label class="form-label text-muted fw-semibold">Información del Ingeniero mecánico</label>
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-label">Tipo de identificación</label>
                  <select class="form-select" formControlName="tipoIdentificacion">
                    <option value="">Seleccione</option>
                    <option *ngFor="let t of tiposIdentificaciones" [value]="t.id">{{ t.nombre }}</option>
                  </select>
                  <div class="text-danger small" *ngIf="hasError('tipoIdentificacion')">Requerido</div>
                </div>
                <div class="col-md-4">
                  <label class="form-label">Número de identificación</label>
                  <input class="form-control" formControlName="numeroIdentificacion" (input)="onNumeroIdentificacionInput($event)" maxlength="15"/>
                  <div class="text-danger small" *ngIf="hasError('numeroIdentificacion')">
                    <span *ngIf="form.get('numeroIdentificacion')?.errors?.['required']">Requerido</span>
                    <span *ngIf="form.get('numeroIdentificacion')?.errors?.['pattern']">Sólo letras y números</span>
                    <span *ngIf="form.get('numeroIdentificacion')?.errors?.['maxlength']">Máximo 15 caracteres</span>
                  </div>
                </div>
                <div class="col-md-4">
                  <label class="form-label">Nombres y apellidos</label>
                  <input class="form-control" formControlName="nombreIngeniero" />
                  <div class="text-danger small" *ngIf="hasError('nombreIngeniero')">Requerido</div>
                </div>
              </div>
            </div>

            <!-- Detalle de actividades -->
            <div class="row g-3 mt-3">
              <div class="col-12">
                <label class="form-label">Detalle de las actividades</label>
                <textarea class="form-control" rows="4" formControlName="detalleActividades"></textarea>
                <div class="text-danger small" *ngIf="hasError('detalleActividades')">Requerido</div>
              </div>
            </div>

            <div class="d-flex gap-2 mt-4">
              <ng-container *ngIf="retryMode(); else normalActions">
                <button class="btn-brand" type="button" (click)="onRetry()" [disabled]="form.invalid || enviando">
                  <span class="spinner-border spinner-border-sm me-2" *ngIf="enviando"></span>
                  Reintentar
                </button>
                <button class="btn btn-outline-secondary" type="button" (click)="onCancel()">Cancelar</button>
              </ng-container>
              <ng-template #normalActions>
                <button class="btn-brand" type="submit" [disabled]="form.invalid || enviando">
                  <span class="spinner-border spinner-border-sm me-2" *ngIf="enviando"></span>
                  Guardar
                </button>
                <button class="btn btn-outline-secondary" type="button" (click)="onCancel()">Cancelar</button>
              </ng-template>
            </div>
          </form>
        </div>
      </div>


    </div>
  `,
})
export class RegistroPreventivoComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ServiciosMantenimientos);
  private readonly storage = inject(ServicioLocalStorage);
  private readonly parametricas = inject(ParametricasService);

  // Modal integration
  inModal = input<boolean>(false);
  initialPlaca = input<string | undefined>(undefined);
  // Cada apertura del modal debe limpiar el formulario
  resetToken = input<number>(0);
  // Estado de apertura del modal (para asegurar limpieza al abrir)
  modalOpen = input<boolean>(false);
  // Reintento manual
  retryMode = input<boolean>(false);
  retryData = input<RetryContext | null>(null);
  closed = output<void>();
  saved = output<void>();
  retry = output<RetrySubmit<any>>();

  enviando = false;
  hoy = new Date().toISOString().slice(0, 10);

  private readonly defaultTiposIdentificaciones: ReadonlyArray<TipoIdentificacion> = [
    { id: '1', nombre: 'Cédula de ciudadanía', codigo: '1' },
    { id: '5', nombre: 'Cédula de extranjería', codigo: '5' },
    { id: '6', nombre: 'Pasaporte', codigo: '6' },
    { id: '3', nombre: 'Tarjeta de identidad', codigo: '3' },
  ];

  tiposIdentificaciones: TipoIdentificacion[] = [...this.defaultTiposIdentificaciones];

  // Validator definido como propiedad para uso en el form
  private readonly fechaHoraValidator = (group: import('@angular/forms').AbstractControl): import('@angular/forms').ValidationErrors | null => {
    const fecha = group.get('fecha')?.value as string | null;
    const hora = group.get('hora')?.value as string | null;
    if (!fecha || !hora) return null;
    const hoy = new Date();
    const sel = new Date(`${fecha}T${hora}:00`);
    if (sel > hoy) return { futureDate: true };
    const fechaHoyStr = hoy.toISOString().slice(0,10);
    if (fecha === fechaHoyStr) {
      const [hSel, mSel] = hora.split(':').map(Number);
      if (hSel > hoy.getHours() || (hSel === hoy.getHours() && mSel > hoy.getMinutes())) {
        return { futureTimeToday: true };
      }
    }
    return null;
  };

  form = this.fb.group({
    // placa ahora se autopuebla desde el registro que abre el modal; se mantiene el control para el payload
    placa: ['', [Validators.required]],
    nitVigilado: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
    fecha: ['', [Validators.required]],
    hora: ['', [Validators.required]],
    nit: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
    razonSocial: ['', [Validators.required]],
    tipoIdentificacion: ['', [Validators.required]],
    numeroIdentificacion: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]+$/), Validators.maxLength(15)]],
    nombreIngeniero: ['', [Validators.required]],
    detalleActividades: ['', [Validators.required]],
  }, { validators: [this.fechaHoraValidator] });

  // (Historial movido a la vista de Preventivos)

  constructor() {
    // Reiniciar el formulario cada vez que se abra el modal o cambie el token
    effect(() => {
      const opened = this.modalOpen();
      const token = this.resetToken();
      if (opened) {
        const p = this.initialPlaca() || this.route.snapshot.queryParamMap.get('placa') || '';
        this.resetForm(p);
      }
      void token; // dependencia extra para resets manuales
    });

    effect(() => {
      const isRetry = this.retryMode();
      const data = this.retryData();
      if (isRetry && data) {
        this.prefillFromRetry(data);
      }
    });

    // Validadores condicionales: placa y nitVigilado sólo requeridos en reintento
    effect(() => {
      const isRetry = this.retryMode();
      const placaCtrl = this.form.get('placa');
      const nitVigCtrl = this.form.get('nitVigilado');
      if (placaCtrl) {
        placaCtrl.setValidators(isRetry ? [Validators.required] : []);
        placaCtrl.updateValueAndValidity({ emitEvent: false, onlySelf: true });
      }
      if (nitVigCtrl) {
        const pattern = Validators.pattern(/^[0-9]+$/);
        nitVigCtrl.setValidators(isRetry ? [Validators.required, pattern] : [pattern]);
        nitVigCtrl.updateValueAndValidity({ emitEvent: false, onlySelf: true });
      }
    });
  }

  ngOnInit() {
    const placaViaRuta = this.route.snapshot.queryParamMap.get('placa');
    const placaInicial = this.initialPlaca() || placaViaRuta || '';
    this.form.patchValue({ placa: placaInicial });

    // Cargar tipos de identificación desde paramétricas, con fallback a los por defecto
    this.parametricas.obtenerTipoIdentificaciones().subscribe({
      next: (lista: TipoIdentificacion[] | null) => {
        const validos = (lista ?? []).filter(t => t.id !== undefined && String(t.nombre || '').trim() !== '');
        this.tiposIdentificaciones = validos.length ? validos : [...this.defaultTiposIdentificaciones];
      },
      error: () => {
        this.tiposIdentificaciones = [...this.defaultTiposIdentificaciones];
      },
    });
  }

  hasError(ctrl: string): boolean {
    const c = this.form.get(ctrl);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Validar fecha/hora no futuras
    const fecha = this.form.value.fecha as string;
    const hora = this.form.value.hora as string;
    const now = new Date();
    const selected = new Date(`${fecha}T${hora}:00`);
    if (selected > now) {
      Swal.fire({ icon: 'warning', title: 'La fecha/hora no puede ser futura' });
      return;
    }

    const usuario = this.storage.obtenerUsuario();
    const vigilado = usuario?.usuario;
    if (!vigilado) {
      Swal.fire({ icon: 'error', title: 'No se encontró el usuario' });
      return;
    }

    this.enviando = true;
    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      const placaFinal = this.form.value.placa || this.initialPlaca() || this.route.snapshot.queryParamMap.get('placa');
      if (!placaFinal) {
        Swal.fire({ icon: 'error', title: 'No se determinó la placa' });
        return;
      }
      const res1: any = await this.api.guardarMantenimiento(vigilado, placaFinal, 1).toPromise();
      const id = res1?.id ?? res1?.mantenimientoId ?? res1; // intentar obtener id
      const payload = this.buildPayload(placaFinal);
      await this.api.guardarMantenimientoPreventivo(payload as any, id).toPromise();
      Swal.fire({ icon: 'success', title: 'Registro guardado', timer: 1400, showConfirmButton: false });
      if (this.inModal()) {
        this.saved.emit();
        this.closed.emit();
      } else {
        this.volver(true);
      }
    } catch (e) {
      const msg = this.getErrorMessage(e);
      Swal.fire({ icon: 'error', title: msg });
    } finally {
      this.enviando = false;
    }
  }

  onRetry() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const fecha = this.form.value.fecha as string;
    const hora = this.form.value.hora as string;
    const now = new Date();
    const selected = new Date(`${fecha}T${hora}:00`);
    if (selected > now) {
      Swal.fire({ icon: 'warning', title: 'La fecha/hora no puede ser futura' });
      return;
    }

    const ctx = this.retryData();
    const placaFinal = this.form.value.placa || this.initialPlaca() || this.route.snapshot.queryParamMap.get('placa');
    if (!ctx || !placaFinal) {
      Swal.fire({ icon: 'error', title: 'Falta la información necesaria para reintentar' });
      return;
    }

    const payload = this.buildPayload(placaFinal);
    this.retry.emit({ context: ctx, payload });
  }

  // (validator moved above)

  onNitInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const cleaned = el.value.replace(/[^0-9]/g, '');
    if (cleaned !== el.value) {
      el.value = cleaned;
      this.form.patchValue({ nit: cleaned });
    }
  }
  onNumeroIdentificacionInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const cleaned = el.value.replace(/[^A-Za-z0-9]/g, '').slice(0,15);
    if (cleaned !== el.value) {
      el.value = cleaned;
      this.form.patchValue({ numeroIdentificacion: cleaned });
    }
  }
  onFechaInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const hoyStr = this.hoy;
    if (el.value && el.value > hoyStr) {
      el.value = hoyStr;
      this.form.patchValue({ fecha: hoyStr });
    }
  }
  onHoraInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const fecha = this.form.value.fecha;
    if (!fecha) return;
    const hoyStr = this.hoy;
    if (fecha === hoyStr) {
      const now = new Date();
      const [hSelStr, mSelStr] = el.value.split(':');
      if (hSelStr && mSelStr) {
        const hSel = Number(hSelStr); const mSel = Number(mSelStr);
        if (hSel > now.getHours() || (hSel === now.getHours() && mSel > now.getMinutes())) {
          const hh = String(now.getHours()).padStart(2,'0');
          const mm = String(now.getMinutes()).padStart(2,'0');
          const corr = `${hh}:${mm}`;
          el.value = corr;
          this.form.patchValue({ hora: corr });
        }
      }
    }
  }

  private resetForm(placa?: string) {
    this.form.reset({
      placa: placa ?? this.form.value.placa ?? this.initialPlaca() ?? this.route.snapshot.queryParamMap.get('placa') ?? '',
      fecha: '',
      hora: '',
      nit: '',
      razonSocial: '',
      tipoIdentificacion: '',
      numeroIdentificacion: '',
      nombreIngeniero: '',
      detalleActividades: '',
    });
  }

  private prefillFromRetry(ctx: RetryContext) {
    const detalle = (ctx.detalle as any) ?? {};
    const payload = (ctx.payload as any) ?? {};
    const placa = detalle.placa ?? payload.placa ?? this.initialPlaca() ?? this.form.value.placa ?? this.route.snapshot.queryParamMap.get('placa') ?? '';
    this.form.patchValue({
      placa,
      nitVigilado: payload.vigiladoId ?? ctx.vigiladoId ?? '',
      fecha: payload.fecha ?? '',
      hora: payload.hora ?? '',
      nit: detalle.nit ?? payload.nit ?? ctx.vigiladoId ?? '',
      razonSocial: detalle.razonSocial ?? payload.razonSocial ?? '',
      tipoIdentificacion: (detalle.tipoIdentificacion ?? payload.tipoIdentificacion ?? '')?.toString(),
      numeroIdentificacion: detalle.numeroIdentificacion ?? payload.numeroIdentificacion ?? '',
      nombreIngeniero: detalle.nombresResponsable ?? detalle.nombreIngeniero ?? payload.nombresResponsable ?? payload.nombreIngeniero ?? '',
      detalleActividades: detalle.detalleActividades ?? payload.detalleActividades ?? '',
    });
    console.log('Prefilled form for retry:', this.form.value);
  }

  private buildPayload(placaFinal: string) {
    return {
      placa: placaFinal,
      vigiladoId: Number(this.form.value.nitVigilado),
      fecha: this.form.value.fecha!,
      hora: this.form.value.hora!,
      nit: Number(this.form.value.nit),
      razonSocial: this.form.value.razonSocial!,
      tipoIdentificacion: this.form.value.tipoIdentificacion!,
      numeroIdentificacion: this.form.value.numeroIdentificacion,
      nombreIngeniero: this.form.value.nombreIngeniero!,
      detalleActividades: this.form.value.detalleActividades!,
    };
  }

  onCancel() {
    if (this.inModal()) {
      this.closed.emit();
    } else {
      this.volver();
    }
  }

  volver(refrescar = false) {
    if (refrescar) {
      this.router.navigate(['/dashboard/mantenimientos'], { queryParamsHandling: 'preserve' });
    } else {
      this.router.navigate(['/dashboard/mantenimientos']);
    }
  }

  // (Tabla de historial y helpers eliminados de esta vista)

  private getErrorMessage(err: any): string {
    const src = (err && (err.error ?? err)) as any;
    if (typeof src === 'string') return src;
    const base = src?.mensaje ?? src?.message ?? err?.message;
    const errors = Array.isArray(src?.errors) ? src.errors : Array.isArray(src?.Messages) ? src.Messages : null;
    if (Array.isArray(errors) && errors.length) {
      const detail = errors.map((x: any) => x?.mensaje ?? x?.message ?? String(x)).join('; ');
      return base ? `${base}: ${detail}` : detail;
    }
    return base || 'Error al guardar';
  }
}
