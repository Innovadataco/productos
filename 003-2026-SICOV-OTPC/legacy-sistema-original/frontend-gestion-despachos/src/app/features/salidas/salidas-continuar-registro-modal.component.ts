import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import Swal from 'sweetalert2';
import { finalize } from 'rxjs/operators';
import { SalidasRegistroService } from './salidas-registro.service';
import {
  guardarRespuestaIntegradora,
  leerRespuestaIntegradora,
  tieneConductorSecundario,
} from './salidas-integradora.util';
import { SalidasAutorizacionesFormComponent } from './salidas-autorizaciones-form.component';
import { VehiculosFormComponent } from './vehiculos-form.component';
import { ConductoresFormComponent } from './conductores-form.component';
import { RutasFormComponent } from './rutas-form.component';
import { CollapseSectionComponent } from '../../shared/ui/collapse-section.component';
import { ObjRutasIntegracion } from '../../despachos/models/Integracion';
import { buildRegistroDespachoPayload } from './salidas-payload.util';
import { Salida } from './salidas.models';

function pasajerosOpcional(max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw === null || raw === '' || raw === undefined) return null;
    const v = Number(raw);
    if (Number.isNaN(v) || v < 1 || v > max) return { pasajerosInvalido: true };
    return null;
  };
}

function identificacionOpcional() {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value ?? '').trim();
    if (!v) return null;
    if (!/^\d+$/.test(v)) return { pattern: true };
    if (v.length < 6) return { minlength: { requiredLength: 6, actualLength: v.length } };
    if (v.length > 10) return { maxlength: { requiredLength: 10, actualLength: v.length } };
    return null;
  };
}

function identificacionRequerida() {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value ?? '').trim();
    if (!v) return { required: true };
    if (!/^\d+$/.test(v)) return { pattern: true };
    if (v.length < 6) return { minlength: { requiredLength: 6, actualLength: v.length } };
    if (v.length > 10) return { maxlength: { requiredLength: 10, actualLength: v.length } };
    return null;
  };
}

function placaVehiculo() {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value ?? '').trim().toUpperCase();
    if (!v) return { required: true };
    if (v.length < 5) return { minlength: { requiredLength: 5, actualLength: v.length } };
    if (v.length > 6) return { maxlength: { requiredLength: 6, actualLength: v.length } };
    if (!/^[A-Z0-9]+$/.test(v)) return { pattern: true };
    return null;
  };
}

@Component({
  selector: 'app-salidas-continuar-registro-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CollapseSectionComponent,
    SalidasAutorizacionesFormComponent,
    VehiculosFormComponent,
    ConductoresFormComponent,
    RutasFormComponent,
  ],
  template: `
    <div class="d-grid gap-3">
      <p class="text-muted small mb-0">
        <span class="fw-bold">Complete cabecera</span>, consulte integradora y confirme los datos. El despacho se envía en un solo registro. Los campos marcados con <span class="text-danger">*</span> son obligatorios.
      </p>

      <form class="border rounded p-3 d-grid gap-2 bg" [formGroup]="cabeceraForm">
        <h6 class="mb-0 text-brand fw-bold">Datos generales del despacho</h6>
        <div class="row g-2">
          <div class="col-md-2">
            <label class="form-label">NIT <span class="text-danger">*</span></label>
            <input class="form-control form-control-sm disabled" formControlName="nitEmpresaTransporte" readonly />
          </div>
          <div class="col-md-4">
            <label class="form-label">Razón social <span class="text-danger">*</span></label>
            <input class="form-control form-control-sm disabled" formControlName="razonSocial" readonly />
          </div>
          <div class="col-md-2">
            <label class="form-label">Valor tiquete <span class="text-danger">*</span></label>
            <div class="input-group input-group-sm">
              <span class="input-group-text">$</span>
              <input
                class="form-control"
                formControlName="valorTiquete"
                inputmode="numeric"
                autocomplete="off"
                (keydown)="permitirSoloNumerosValorTiquete($event)"
                (input)="onValorTiqueteInput($event)"
              />
            </div>
          </div>
          <div class="col-md-2">
            <label class="form-label">Fecha salida <span class="text-danger">*</span></label>
            <input type="date" class="form-control form-control-sm" formControlName="fechaSalida" [max]="fechaActual" />
          </div>
          <div class="col-md-2">
            <label class="form-label">Hora salida <span class="text-danger">*</span></label>
            <input type="time" class="form-control form-control-sm" formControlName="horaSalida" />
          </div>
        </div>
        <div class="row g-2">
          <div class="col-md-12">
            <label class="form-label">Observaciones</label>
            <textarea class="form-control form-control-sm" formControlName="observaciones" rows="2"></textarea>
          </div>

        </div>
      </form>

      <form class="border rounded p-3 d-grid gap-2 bg" [formGroup]="integradoraForm" (ngSubmit)="consultarIntegradora()">
        <h6 class="mb-0 fw-bold">Consulta integradora</h6>
        <div class="row g-2 align-items-start">
          <div class="col-md-2">
            <label class="form-label">Placa <span class="text-danger">*</span></label>
            <input
              class="form-control form-control-sm text-uppercase"
              formControlName="placa"´
              placeholder="Ej: ABC123"
              maxlength="6"
              autocomplete="off"
              [class.is-invalid]="mostrarErrorIntegradora('placa')"
              (input)="onPlacaInput($event)"
            />
            @if (mostrarErrorIntegradora('placa')) {
              <div class="invalid-feedback d-block">{{ mensajeIntegradora('placa') }}</div>
            }
          </div>
          <div class="col-md-3">
            <label class="form-label">N° identificación conductor <span class="text-danger">*</span></label>
            <input
              class="form-control form-control-sm"
              formControlName="numeroIdentificacion1"
              placeholder="Ej: 1234567890"
              maxlength="10"
              inputmode="numeric"
              autocomplete="off"
              [class.is-invalid]="mostrarErrorIntegradora('numeroIdentificacion1')"
              (input)="onIdentificacionInput('numeroIdentificacion1', $event)"
            />
            @if (mostrarErrorIntegradora('numeroIdentificacion1')) {
              <div class="invalid-feedback d-block">{{ mensajeIntegradora('numeroIdentificacion1') }}</div>
            }
          </div>
          <div class="col-md-3">
            <label class="form-label">N° identificación conductor 2</label>
            <input
              class="form-control form-control-sm"
              formControlName="numeroIdentificacion2"
              placeholder="Ej: 1234567890"
              maxlength="10"
              inputmode="numeric"
              autocomplete="off"
              [class.is-invalid]="mostrarErrorIntegradora('numeroIdentificacion2')"
              (input)="onIdentificacionInput('numeroIdentificacion2', $event)"
            />
            @if (mostrarErrorIntegradora('numeroIdentificacion2')) {
              <div class="invalid-feedback d-block">{{ mensajeIntegradora('numeroIdentificacion2') }}</div>
            }
          </div>
          <div class="col-md-3 d-grid align-self-end">
            <button type="submit" class="btn btn-brand btn-brand--sm" [disabled]="consultando() || integradoraForm.invalid || cabeceraForm.invalid">
              {{ consultando() ? 'Consultando…' : 'Consultar integradora' }}
              <span class="spinner-border spinner-border-sm ms-1" role="status" *ngIf="consultando()"></span>
            </button>
          </div>
        </div>
      </form>

      @if (integradoraOk()) {
        <div class="d-grid gap-2">
          <app-collapse-section
            title="Información de conductor(es)"
            [badge]="conductoresOk() ? 'Listo' : null"
            [expanded]="abrirConductores()"
            (expandedChange)="abrirConductores.set($event)"
          >
            <app-conductores-form
              [revision]="consultaRevision()"
              [mostrarSecundario]="mostrarConductorSecundario()"
              (dataChange)="capturarConductores($event)"
            />
          </app-collapse-section>

          <app-collapse-section
            title="Información del vehículo"
            [badge]="vehiculoOk() ? 'Listo' : null"
            [expanded]="abrirVehiculo()"
            (expandedChange)="abrirVehiculo.set($event)"
          >
            <app-vehiculos-form
              [revision]="consultaRevision()"
              (dataChange)="capturarVehiculo($event)"
            />
          </app-collapse-section>

          <app-collapse-section
            title="Información de la autorización"
            [expanded]="abrirAutorizaciones()"
            (expandedChange)="abrirAutorizaciones.set($event)"
          >
            <app-salidas-autorizaciones-form
              [nit]="nit()"
              [placa]="placaConsulta()"
              [fechaSalida]="fechaSalida()"
              (selectionChange)="capturarAutorizaciones($event)"
            />
          </app-collapse-section>

          <app-collapse-section
            title="Información de la ruta"
            [badge]="rutaOk() ? 'Listo' : null"
            [expanded]="abrirRuta()"
            (expandedChange)="abrirRuta.set($event)"
          >
            <app-rutas-form [nit]="nit()" (selectionChange)="capturarRuta($event)" />
          </app-collapse-section>
        </div>

        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cerrar.emit()">Cancelar</button>
          <button type="button" class="btn btn-brand btn-sm" [disabled]="guardando() || !puedeRegistrar()" (click)="registrarDespacho()">
            {{ guardando() ? 'Registrando…' : 'Registrar despacho completo' }}
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .disabled {
        background-color: #f0f0f0;
        cursor: not-allowed;
      }

      .bg {
        background-color:rgb(255, 255, 255);
      }

      .invalid-feedback {
        font-size: 0.75rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalidasContinuarRegistroModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly registro = inject(SalidasRegistroService);

  nit = input<string>('');
  razonSocial = input<string>('');
  placaInicial = input<string>('');
  fechaInicial = input<string>('');
  horaInicial = input<string>('');

  cerrar = output<void>();
  finalizado = output<Salida>();

  consultando = signal(false);
  guardando = signal(false);
  integradoraOk = signal(false);
  placaConsulta = signal('');
  consultaRevision = signal(0);
  mostrarConductorSecundario = signal(false);

  abrirAutorizaciones = signal(false);
  abrirVehiculo = signal(false);
  abrirConductores = signal(true);
  abrirRuta = signal(false);

  vehiculoOk = signal(false);
  conductoresOk = signal(false);
  rutaOk = signal(false);

  private autorizaciones: Record<string, unknown>[] = [];
  private vehiculoRaw: Record<string, unknown> | null = null;
  private conductoresRaw: Record<string, unknown> | null = null;
  private rutas: ObjRutasIntegracion | null = null;

  readonly fechaActual = this.getBogotaDate();

  cabeceraForm = this.fb.nonNullable.group({
    nitEmpresaTransporte: ['', Validators.required],
    razonSocial: ['', Validators.required],
    numeroPasajero: [null as number | null, pasajerosOpcional(85)],
    valorTiquete: [''],
    observaciones: [''],
    fechaSalida: [this.getBogotaDate(), Validators.required],
    horaSalida: ['', Validators.required],
  });

  integradoraForm = this.fb.group({
    numeroIdentificacion1: ['', [identificacionRequerida()]],
    numeroIdentificacion2: ['', [identificacionOpcional()]],
    placa: ['', [placaVehiculo()]],
  });

  ngOnInit(): void {
    this.cabeceraForm.patchValue({
      nitEmpresaTransporte: this.nit(),
      razonSocial: this.razonSocial(),
      fechaSalida: this.fechaInicial() || this.getBogotaDate(),
      horaSalida: this.horaInicial() || this.getBogotaTime(),
    });
    this.integradoraForm.patchValue({ placa: (this.placaInicial() ?? '').toUpperCase() });
    if (leerRespuestaIntegradora()) {
      this.integradoraOk.set(true);
      this.actualizarEstadoIntegradora();
    }
  }

  fechaSalida(): string {
    return this.cabeceraForm.get('fechaSalida')?.value ?? '';
  }

  permitirSoloNumerosValorTiquete(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) return;
    const permitidas = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (permitidas.includes(event.key)) return;
    if (!/^\d$/.test(event.key)) event.preventDefault();
  }

  onValorTiqueteInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    const ctrl = this.cabeceraForm.get('valorTiquete');
    if (!ctrl) return;
    if (!digits) {
      ctrl.setValue('', { emitEvent: false });
      return;
    }
    const formatted = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(digits));
    ctrl.setValue(formatted, { emitEvent: false });
  }

  onPlacaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalizada = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const ctrl = this.integradoraForm.get('placa');
    if (!ctrl) return;
    if (input.value !== normalizada) {
      input.value = normalizada;
    }
    ctrl.setValue(normalizada);
    ctrl.markAsDirty();
  }

  onIdentificacionInput(campo: 'numeroIdentificacion1' | 'numeroIdentificacion2', event: Event): void {
    const input = event.target as HTMLInputElement;
    const soloDigitos = input.value.replace(/\D/g, '').slice(0, 10);
    const ctrl = this.integradoraForm.get(campo);
    if (!ctrl) return;
    if (input.value !== soloDigitos) {
      input.value = soloDigitos;
    }
    ctrl.setValue(soloDigitos);
    ctrl.markAsDirty();
  }

  mostrarErrorIntegradora(campo: 'placa' | 'numeroIdentificacion1' | 'numeroIdentificacion2'): boolean {
    const ctrl = this.integradoraForm.get(campo);
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  mensajeIntegradora(campo: 'placa' | 'numeroIdentificacion1' | 'numeroIdentificacion2'): string {
    const ctrl = this.integradoraForm.get(campo);
    const errores = ctrl?.errors;
    if (!errores) return 'Valor inválido.';

    if (errores['required']) return 'Este campo es obligatorio.';
    if (errores['minlength']) {
      const min = errores['minlength'].requiredLength;
      return campo === 'placa'
        ? `La placa debe tener al menos ${min} caracteres.`
        : `La identificación debe tener al menos ${min} dígitos.`;
    }
    if (errores['maxlength']) {
      const max = errores['maxlength'].requiredLength;
      return campo === 'placa'
        ? `La placa no puede superar ${max} caracteres.`
        : `La identificación no puede superar ${max} dígitos.`;
    }
    if (errores['pattern']) {
      return campo === 'placa'
        ? 'Use solo letras y números, sin espacios ni caracteres especiales.'
        : 'Use solo números, sin letras ni símbolos.';
    }
    return 'Valor inválido.';
  }

  consultarIntegradora(): void {
    this.integradoraForm.markAllAsTouched();
    if (this.integradoraForm.invalid || this.cabeceraForm.invalid) return;
    const cab = this.cabeceraForm.getRawValue();
    const form = this.integradoraForm.getRawValue();
    const id2 = String(form.numeroIdentificacion2 || '').trim();
    this.consultando.set(true);
    this.registro.consultarIntegradora({
      numeroIdentificacion1: String(form.numeroIdentificacion1 || ''),
      ...(id2 ? { numeroIdentificacion2: id2 } : {}),
      placa: String(form.placa || ''),
      nit: String(this.nit() || cab.nitEmpresaTransporte || ''),
      fechaConsulta: cab.fechaSalida,
      horaConsulta: cab.horaSalida?.slice(0, 5),
    }).pipe(finalize(() => this.consultando.set(false))).subscribe({
      next: (resp: unknown) => {
        guardarRespuestaIntegradora(resp);
        this.placaConsulta.set(String(form.placa || ''));
        this.integradoraOk.set(true);
        this.consultaRevision.update((v) => v + 1);
        this.autorizaciones = [];
        this.rutas = null;
        this.vehiculoRaw = null;
        this.conductoresRaw = null;
        this.vehiculoOk.set(false);
        this.conductoresOk.set(false);
        this.rutaOk.set(false);
        this.abrirAutorizaciones.set(false);
        this.abrirVehiculo.set(false);
        this.abrirConductores.set(true);
        this.abrirRuta.set(false);
        this.actualizarEstadoIntegradora();
        Swal.fire({ icon: 'success', title: 'Consulta exitosa', timer: 1200, showConfirmButton: false });
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.mensaje ?? err?.error?.mensajes ?? 'No fue posible consultar la integradora' }),
    });
  }

  private actualizarEstadoIntegradora(): void {
    const root = leerRespuestaIntegradora();
    this.mostrarConductorSecundario.set(tieneConductorSecundario(root));
  }

  capturarAutorizaciones(lista: Record<string, unknown>[]) {
    this.autorizaciones = lista ?? [];
  }

  capturarVehiculo(raw: Record<string, unknown>) {
    this.vehiculoRaw = raw;
    this.vehiculoOk.set(!!raw['placa'] && raw['clase'] != null && raw['nivelServicio'] != null);
  }

  capturarConductores(raw: Record<string, unknown>) {
    this.conductoresRaw = raw;
    const principalOk = !!String(raw['numeroIdentificacion'] ?? '').trim() && !!String(raw['fechaVencimientoLicencia'] ?? '').trim();
    const secundarioOk =
      !this.mostrarConductorSecundario() ||
      (!!String(raw['numeroIdentificacionSecundario'] ?? '').trim() &&
        !!String(raw['fechaVencimientoLicenciaSecundario'] ?? '').trim());
    this.conductoresOk.set(principalOk && secundarioOk);
  }

  capturarRuta(ruta: ObjRutasIntegracion | null) {
    this.rutas = ruta;
    this.rutaOk.set(!!ruta?.idRutaAutorizada && !!ruta?.idOrigen && !!ruta?.idDestino);
  }

  puedeRegistrar(): boolean {
    return this.integradoraOk() && this.vehiculoOk() && this.conductoresOk() && this.rutaOk();
  }

  registrarDespacho(): void {
    if (!this.puedeRegistrar() || !this.vehiculoRaw || !this.conductoresRaw || !this.rutas) return;
    const cab = this.cabeceraForm.getRawValue();
    const hora = (cab.horaSalida ?? '').slice(0, 5);
    if (cab.fechaSalida === this.fechaActual && hora > this.getBogotaTime()) {
      Swal.fire({ icon: 'warning', title: 'Hora inválida', text: 'La hora de salida no puede ser mayor a la hora actual.' });
      return;
    }
    const pasajerosRaw = cab.numeroPasajero;
    const pasajerosNum =
      pasajerosRaw != null && String(pasajerosRaw) !== '' ? Number(pasajerosRaw) : undefined;
    const payload = buildRegistroDespachoPayload({
      cabecera: { ...cab, horaSalida: hora },
      vehiculoForm: this.vehiculoRaw,
      conductoresForm: this.conductoresRaw,
      ruta: this.rutas,
      integradora: leerRespuestaIntegradora(),
      incluirSecundario: this.mostrarConductorSecundario(),
      autorizaciones: this.autorizaciones.length ? this.autorizaciones : undefined,
    });
    this.guardando.set(true);
    this.registro.registrarDespachoIntegracion(payload).subscribe({
      next: (resp: any) => {
        const idExterno = resp?.idDespachoExterno ?? resp?.obj?.idDespachoExterno ?? resp?.obj?.id ?? null;
        const solicitudId = resp?.solicitudId ?? resp?.obj?.solicitudId ?? null;
        const salida: Salida = {
          id: idExterno ?? solicitudId ?? undefined,
          nitEmpresaTransporte: cab.nitEmpresaTransporte,
          razonSocial: cab.razonSocial,
          fechaSalida: cab.fechaSalida,
          horaSalida: hora,
          numeroPasajero: pasajerosNum,
          placa: String(this.vehiculoRaw?.['placa'] ?? ''),
          llegadas: [],
        };
        Swal.fire({ icon: 'success', title: 'Despacho registrado', text: idExterno ? `ID externo: ${idExterno}` : undefined, timer: 2000, showConfirmButton: false });
        this.finalizado.emit(salida);
        this.cerrar.emit();
      },
      error: (err) => Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.mensaje ?? err?.error?.mensajes ?? 'No fue posible registrar el despacho' }),
      complete: () => this.guardando.set(false),
    });
  }

  private getBogotaDate(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  }

  private getBogotaTime(): string {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  }
}
