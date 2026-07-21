import { ChangeDetectionStrategy, Component, input, output, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { VehiculoSalida } from '../../despachos/models/Llegadas';

@Component({
  selector: 'app-llegada-vehiculo-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <form class="d-grid gap-3" [formGroup]="form" (ngSubmit)="onSubmit()">
      <div class="row g-2">
        <div class="col-6 col-md-3"><label class="form-label">Placa</label><input class="form-control form-control-sm" formControlName="placa" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">SOAT</label><input class="form-control form-control-sm" formControlName="soat" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Vence SOAT</label><input type="date" class="form-control form-control-sm" formControlName="fechavencimientoSoat" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Rev. tecno</label><input class="form-control form-control-sm" formControlName="revisiontecnicomecanica" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Vence rev. tecno</label><input type="date" class="form-control form-control-sm" formControlName="fecharevisiontecnicomecanica" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Póliza contractual</label><input class="form-control form-control-sm" formControlName="id_poliza_contractual" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Vigencia contractual</label><input class="form-control form-control-sm" formControlName="vigenciacontractual" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Póliza extra</label><input class="form-control form-control-sm" formControlName="id_poliza_extracontractual" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Vigencia extra</label><input class="form-control form-control-sm" formControlName="vigenciaextracontractual" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Tarjeta operación</label><input class="form-control form-control-sm" formControlName="tarjetaoperacion" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Vence tarjeta</label><input type="date" class="form-control form-control-sm" formControlName="fechavencimientoTarjetaOperacion" readonly /></div>
        <div class="col-12"><label class="form-label">Observaciones</label><textarea class="form-control form-control-sm" formControlName="observaciones"></textarea></div>
        <div class="col-6 col-md-3"><label class="form-label">Clase</label><input class="form-control form-control-sm" formControlName="clase" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Nivel servicio</label><input class="form-control form-control-sm" formControlName="nivelservicio" readonly /></div>
      </div>
      <div class="d-flex justify-content-end">
        <button type="submit" class="btn btn-brand btn-sm" [disabled]="form.invalid || saving() || guardado()">
          {{ saving() ? 'Guardando…' : 'Registrar vehículo llegada' }}
        </button>
        @if (guardado()) { <span class="badge text-bg-success ms-2 align-self-center">Guardado</span> }
      </div>
    </form>
  `,
})
export class LlegadaVehiculoFormComponent implements OnInit {
  llegadaId = input.required<string | number>();
  infoSalidaVehiculo = input<VehiculoSalida | null>(null);
  saving = input(false);
  guardado = input(false);
  submit = output<Record<string, unknown>>();

  private readonly fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    placa: ['', Validators.required],
    soat: [''],
    fechavencimientoSoat: [''],
    revisiontecnicomecanica: [''],
    fecharevisiontecnicomecanica: [''],
    id_poliza_contractual: [''],
    id_poliza_extracontractual: [''],
    vigenciacontractual: [''],
    vigenciaextracontractual: [''],
    tarjetaoperacion: [''],
    fechavencimientoTarjetaOperacion: [''],
    idMatenimientopreventivo: [''],
    fechaMantenimientopreventivo: [''],
    idprotocoloalistamientodiario: [''],
    fechaprotocoloalistamientodiario: [''],
    observaciones: [''],
    clase: [''],
    nivelservicio: [''],
  });

  ngOnInit(): void {
    const v = this.infoSalidaVehiculo();
    if (!v) return;
    this.form.patchValue({
      placa: v.placa ?? '',
      soat: v.soat ?? '',
      fechavencimientoSoat: v.fechaVencimientoSoat ?? '',
      revisiontecnicomecanica: v.revisionTecnicoMecanica ?? '',
      fecharevisiontecnicomecanica: v.fechaRevisionTecnicoMecanica ?? '',
      id_poliza_contractual: v.idPolizaContractual ?? '',
      id_poliza_extracontractual: v.idPolizaExtracontractual ?? '',
      vigenciacontractual: v.vigenciaContractual ?? '',
      vigenciaextracontractual: v.vigenciaExtracontractual ?? '',
      tarjetaoperacion: v.tarjetaOperacion ?? '',
      fechavencimientoTarjetaOperacion: v.fechaVencimientoTarjetaOperacion ?? '',
      idMatenimientopreventivo: v.idMatenimientoPreventivo ?? '',
      fechaMantenimientopreventivo: v.fechaMantenimientoPreventivo ?? '',
      idprotocoloalistamientodiario: v.idProtocoloAlistamientodiario ?? '',
      fechaprotocoloalistamientodiario: v.fechaProtocoloAlistamientodiario ?? '',
      clase: v.clase != null ? String(v.clase) : '',
      nivelservicio: v.nivelServicio != null ? String(v.nivelServicio) : '',
      observaciones: v.observaciones ?? '',
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.guardado()) return;
    this.submit.emit({
      llegada_id: this.llegadaId(),
      ...this.form.getRawValue(),
      nivelservicio: Number(this.form.get('nivelservicio')?.value) || 0,
      clase: Number(this.form.get('clase')?.value) || this.form.get('clase')?.value,
    });
  }
}
