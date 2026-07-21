import { ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output, input, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import Swal from 'sweetalert2';

function maxPasajeros(max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = Number(control.value);
    if (Number.isNaN(v) || v > max) return { maxPasajeros: true };
    return null;
  };
}

@Component({
  selector: 'app-salidas-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="d-grid gap-3" [formGroup]="form" (ngSubmit)="onSubmit()">
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <label class="form-label">NIT empresa <span class="text-danger">*</span></label>
          <input class="form-control" formControlName="nitEmpresaTransporte" readonly />
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label">Razón social <span class="text-danger">*</span></label>
          <input class="form-control" formControlName="razonSocial" readonly />
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label">Pasajeros</label>
          <input type="number" class="form-control" formControlName="numeroPasajero" min="0" max="85" />
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label">Fecha salida <span class="text-danger">*</span></label>
          <input type="date" class="form-control" formControlName="fechaSalida" [max]="fechaActual" />
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label">Hora salida <span class="text-danger">*</span></label>
          <input type="time" class="form-control" formControlName="horaSalida" />
        </div>
        <div class="col-12 col-md-3">
          <label class="form-label">Valor tiquete</label>
          <input class="form-control" formControlName="valorTiquete" (blur)="formatearMoneda('valorTiquete')" />
        </div>
      </div>
      <div class="row g-3">
        <div class="col-12 col-md-4">
          <label class="form-label">Valor total tasa uso</label>
          <input class="form-control" formControlName="valorTotalTasaUso" (blur)="formatearMoneda('valorTotalTasaUso')" />
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Observaciones</label>
          <textarea class="form-control" formControlName="observaciones"></textarea>
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button class="btn btn-secondary" type="button" (click)="cancel.emit()">Cancelar</button>
        <button class="btn-brand" type="submit" [disabled]="form.invalid || saving()">
          @if (!saving()) { Guardar salida } @else { Guardando... }
        </button>
      </div>
    </form>
  `,
})
export class SalidasFormComponent implements OnInit {
  saving = input<boolean>(false);
  nitEmpresa = input<string>('');
  razonSocialEmpresa = input<string>('');
  @Output() submit = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  readonly fechaActual = this.getBogotaDate();

  private readonly fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    nitEmpresaTransporte: ['', [Validators.required]],
    razonSocial: ['', [Validators.required]],
    tipoDespacho: [1, [Validators.required]],
    numeroPasajero: [0, [Validators.required, Validators.min(0), maxPasajeros(85)]],
    fechaSalida: [this.getBogotaDate(), [Validators.required]],
    horaSalida: ['', [Validators.required]],
    valorTiquete: [''],
    valorTotalTasaUso: [''],
    observaciones: [''],
  });

  ngOnInit(): void {
    const nit = this.nitEmpresa();
    const razon = this.razonSocialEmpresa();
    if (nit || razon) {
      this.form.patchValue({
        nitEmpresaTransporte: nit,
        razonSocial: razon,
        fechaSalida: this.getBogotaDate(),
        horaSalida: this.getBogotaTime(),
      });
    }
  }

  formatearMoneda(campo: 'valorTiquete' | 'valorTotalTasaUso'): void {
    const ctrl = this.form.get(campo);
    if (!ctrl) return;
    const raw = String(ctrl.value ?? '').replace(/\D/g, '');
    if (!raw) { ctrl.setValue(''); return; }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    ctrl.setValue(new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(num));
  }

  onSubmit() {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const fecha = raw.fechaSalida;
    const hora = (raw.horaSalida ?? '').slice(0, 5);
    if (fecha === this.fechaActual && hora > this.getBogotaTime()) {
      Swal.fire({ icon: 'warning', title: 'Hora inválida', text: 'La hora de salida no puede ser mayor a la hora actual.' });
      return;
    }
    const body = {
      ...raw,
      valorTiquete: String(raw.valorTiquete ?? '').replace(/\D/g, ''),
      valorTotalTasaUso: String(raw.valorTotalTasaUso ?? '').replace(/\D/g, ''),
    };
    this.submit.emit(body);
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
