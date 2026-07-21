import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { finalize } from 'rxjs/operators';
import { LlegadasRegistroService } from './llegadas-registro.service';
import { SalidaConsultada } from '../../despachos/models/Llegadas';
import { RegistroLlegadaIntegracion } from '../../despachos/models/Integracion';
import { guardarRespuestaIntegradora } from '../salidas/salidas-integradora.util';

@Component({
  selector: 'app-llegadas-registro-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form class="d-grid gap-3" [formGroup]="llegadaForm" (ngSubmit)="registrarLlegada()">
      <div class="llegada-panel border rounded overflow-hidden">
        <div class="llegada-panel__header px-3 py-2">
          Datos de llegada
          <small class="text-muted">
            Los campos marcados con (<span class="text-danger fw-semibold">*</span>) son obligatorios.
          </small>
        </div>
        <div class="p-3 d-grid gap-3">
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label form-label-sm mb-1" for="fechaLlegada">
                Fecha de llegada <span class="text-danger">*</span>
              </label>
              <input
                id="fechaLlegada"
                type="date"
                class="form-control form-control-sm"
                formControlName="fechaLlegada"
                [max]="fechaActual"
              />
            </div>
            <div class="col-md-6">
              <label class="form-label form-label-sm mb-1" for="horaLlegada">
                Hora de llegada <span class="text-danger">*</span>
              </label>
              <input
                id="horaLlegada"
                type="time"
                class="form-control form-control-sm"
                formControlName="horaLlegada"
              />
            </div>
          </div>

          <div class="row g-2 align-items-end">
            <div class="col-md-8">
              <label class="form-label form-label-sm mb-1" for="placaLlegada">
                Placa <span class="text-danger">*</span>
              </label>
              <input
                id="placaLlegada"
                type="text"
                maxlength="6"
                class="form-control form-control-sm text-uppercase"
                formControlName="placa"
                placeholder="Ej: ABC123"
                [readonly]="placaBloqueada()"
                (keydown.enter)="$event.preventDefault(); consultarPlaca()"
              />
            </div>
            <div class="col-md-4">
              <button
                type="button"
                class="btn btn-brand btn-sm w-100"
                (click)="consultarPlaca()"
                [disabled]="consultando() || !llegadaForm.get('placa')?.value"
              >
                @if (consultando()) {
                  <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                  Consultando…
                } @else {
                  Consultar
                }
              </button>
            </div>
          </div>

          @if (mensajeConsulta()) {
            <div
              class="small px-1"
              [class.text-success]="idTipollegada() === 1"
              [class.text-warning]="idTipollegada() === 2"
            >
              {{ mensajeConsulta() }}
            </div>
          }

          @if (mostrarIntegradora()) {
            <div class="border rounded p-2 d-grid gap-2 bg-light-subtle">
              <span class="small fw-semibold text-secondary">Consulta integradora</span>
              <div class="row g-2 align-items-end">
                <div class="col-md-3">
                  <label class="form-label form-label-sm mb-1">
                    Placa <span class="text-danger">*</span>
                  </label>
                  <input class="form-control form-control-sm disabled" formControlName="placa" readonly/>
                </div>
                <div class="col-md-3">
                  <label class="form-label form-label-sm mb-1">
                    Identificación conductor <span class="text-danger">*</span>
                  </label>
                  <input class="form-control form-control-sm" formControlName="numeroIdentificacion1" placeholder="Ej: 1234567890" maxlength="10" inputmode="numeric" autocomplete="off"/>
                </div>
                <div class="col-md-6">
                  <button
                    type="button"
                    class="btn btn-outline-primary btn-sm w-100"
                    (click)="consultarIntegradora()"
                    [disabled]="consultandoIntegradora() || !llegadaForm.get('numeroIdentificacion1')?.value"
                  >
                    {{ consultandoIntegradora() ? 'Consultando…' : 'Consultar integradora' }}
                  </button>
                </div>
              </div>
              @if (integradoraConsultadaOk()) {
                <div class="alert alert-success py-2 px-3 mb-0 small d-flex align-items-start gap-2" role="status">
                  <i class="bi bi-check-circle-fill flex-shrink-0 mt-1"></i>
                  <span>{{ mensajeIntegradoraOk() }}</span>
                </div>
              }
            </div>
          }

          <div class="d-flex justify-content-end gap-2 pt-1">
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cerrar.emit()">Cancelar</button>
            <button type="submit" class="btn btn-brand btn-sm" [disabled]="!puedeGuardar()">
              {{ guardandoLlegada() ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </form>
  `,
  styles: [
    `.llegada-panel__header{background:var(--bs-light-bg-subtle,#e8eef5);font-weight:600;color:var(--bs-body-color);}`,
    `.form-label-sm{font-size:.8125rem;}`,
    `.disabled{cursor:not-allowed;background-color: #f0f0f0;}`,
  ],
})
export class LlegadasRegistroModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly registro = inject(LlegadasRegistroService);

  nit = input<string>('');
  cerrar = output<void>();
  guardado = output<void>();

  consultando = signal(false);
  consultandoIntegradora = signal(false);
  guardandoLlegada = signal(false);
  idTipollegada = signal<1 | 2 | null>(null);
  mensajeConsulta = signal('');
  integradoraConsultadaOk = signal(false);
  mensajeIntegradoraOk = signal('');
  salidaEncontrada = signal<SalidaConsultada | null>(null);
  placaBloqueada = signal(false);

  readonly fechaActual = this.getBogotaDate();

  llegadaForm = this.fb.group({
    fechaLlegada: [this.getBogotaDate(), Validators.required],
    horaLlegada: [this.getBogotaTime(), Validators.required],
    placa: ['', Validators.required],
    idDespacho: [null as number | null],
    numeroIdentificacion1: [''],
  });

  ngOnInit(): void {
    this.llegadaForm.patchValue({
      fechaLlegada: this.getBogotaDate(),
      horaLlegada: this.getBogotaTime(),
    });
  }

  mostrarIntegradora(): boolean {
    return this.idTipollegada() === 2 && !this.salidaEncontrada();
  }

  puedeGuardar(): boolean {
    if (this.llegadaForm.invalid || this.guardandoLlegada()) return false;
    const tipo = this.idTipollegada();
    if (tipo == null) return false;
    if (tipo === 2) return this.integradoraConsultadaOk();
    return true;
  }

  consultarPlaca(): void {
    const placa = String(this.llegadaForm.get('placa')?.value ?? '').trim().toUpperCase();
    if (!placa) return;
    this.llegadaForm.patchValue({ placa });
    this.reiniciarIntegradora();
    this.consultando.set(true);
    this.registro.consultarSalidaPorPlaca(placa).pipe(finalize(() => this.consultando.set(false))).subscribe({
      next: (resp: unknown) => {
        const root = resp as Record<string, unknown>;
        const salida = (root?.['obj'] ?? root?.['data'] ?? root ?? null) as SalidaConsultada | null;
        const idDespacho = salida?.id ?? null;
        const tieneLlegada = (salida?.llegadas?.length ?? 0) > 0;

        if (idDespacho && !tieneLlegada) {
          this.idTipollegada.set(1);
          this.salidaEncontrada.set(salida);
          this.placaBloqueada.set(true);
          this.mensajeConsulta.set('Salida encontrada sin llegada. Se vinculará al despacho.');
          this.llegadaForm.patchValue({
            idDespacho: Number(idDespacho),
            placa,
          });
        } else if (idDespacho && tieneLlegada) {
          this.idTipollegada.set(2);
          this.salidaEncontrada.set(null);
          this.placaBloqueada.set(false);
          this.mensajeConsulta.set('La salida ya tiene llegada. Registro sin despacho (tipo 2).');
          this.llegadaForm.patchValue({ idDespacho: null, placa });
        } else {
          this.idTipollegada.set(2);
          this.salidaEncontrada.set(null);
          this.placaBloqueada.set(false);
          this.mensajeConsulta.set('No se encontró salida. Puede consultar la integradora.');
          this.llegadaForm.patchValue({ idDespacho: null, placa });
        }
      },
      error: () => {
        this.idTipollegada.set(2);
        this.salidaEncontrada.set(null);
        this.placaBloqueada.set(false);
        this.mensajeConsulta.set('No se encontró salida para la placa.');
        this.llegadaForm.patchValue({ idDespacho: null });
      },
    });
  }

  consultarIntegradora(): void {
    if (!this.nit()) return;
    const placa = String(this.llegadaForm.get('placa')?.value ?? '');
    const numeroIdentificacion1 = String(this.llegadaForm.get('numeroIdentificacion1')?.value ?? '');
    if (!placa || !numeroIdentificacion1) return;

    this.consultandoIntegradora.set(true);
    this.reiniciarIntegradora();
    this.registro.consultarIntegradora({
      numeroIdentificacion1,
      placa,
      nit: String(this.nit() || ''),
      fechaConsulta: this.getBogotaDate(),
      horaConsulta: this.getBogotaTime(),
    }).pipe(finalize(() => this.consultandoIntegradora.set(false))).subscribe({
      next: (resp: unknown) => {
        guardarRespuestaIntegradora(resp);
        this.integradoraConsultadaOk.set(true);
        this.mensajeIntegradoraOk.set(
          'Consulta integradora exitosa, puede guardar la llegada.'
        );
      },
      error: (err) => {
        this.reiniciarIntegradora();
        Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.mensajes ?? 'Consulta fallida' });
      },
    });
  }

  private reiniciarIntegradora(): void {
    this.integradoraConsultadaOk.set(false);
    this.mensajeIntegradoraOk.set('');
  }

  registrarLlegada(): void {
    if (!this.puedeGuardar()) return;
    const raw = this.llegadaForm.getRawValue();
    const fecha = raw.fechaLlegada ?? '';
    const hora = (raw.horaLlegada ?? '').slice(0, 5);
    if (fecha === this.fechaActual && hora > this.getBogotaTime()) {
      Swal.fire({ icon: 'warning', title: 'Hora inválida', text: 'La hora de llegada no puede ser mayor a la actual.' });
      return;
    }

    const tipo = this.idTipollegada() ?? (raw.idDespacho ? 1 : 2);
    const nit = String(this.nit() || '').trim();
    const payload: RegistroLlegadaIntegracion = {
      idTipollegada: String(tipo),
      nitEmpresaTransporte: nit,
      idDespacho: tipo === 1 && raw.idDespacho != null ? String(raw.idDespacho) : null,
      terminalLlegada: nit,
      numeroPasajero: '0',
      horaLlegada: hora,
      fechaLlegada: fecha,
      placa: String(raw.placa ?? '').toUpperCase(),
      sede: '0',
    };

    this.guardandoLlegada.set(true);
    this.registro.registrarLlegadaIntegracion(payload).subscribe({
      next: (resp: unknown) => {
        const r = resp as Record<string, unknown>;
        const obj = r?.['obj'] as Record<string, unknown> | undefined;
        const solicitudId = Number(r?.['solicitudId'] ?? obj?.['solicitudId'] ?? 0);
        if (solicitudId > 0) this.registro.registrarSolicitudId(solicitudId);
        Swal.fire({ icon: 'success', title: String(r?.['mensaje'] ?? 'Llegada registrada'), timer: 1500, showConfirmButton: false });
        this.guardado.emit();
        this.cerrar.emit();
      },
      error: (err) =>
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err?.error?.mensaje ?? err?.error?.mensajes ?? 'No fue posible registrar la llegada',
        }),
      complete: () => this.guardandoLlegada.set(false),
    });
  }

  private getBogotaDate(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  }

  private getBogotaTime(): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  }
}
