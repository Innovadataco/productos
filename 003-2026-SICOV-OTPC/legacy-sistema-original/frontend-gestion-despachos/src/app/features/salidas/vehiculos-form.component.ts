import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SalidasRegistroService } from './salidas-registro.service';
import { leerRespuestaIntegradora, mapearVehiculoIntegradora } from './salidas-integradora.util';
import { extraerMaestrasCodigoDescripcion, extraerNivelesServicio } from './maestras.util';

@Component({
  selector: 'app-vehiculos-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="d-grid gap-3" [formGroup]="form">
      <div class="row g-3">
        <div class="col-6 col-md-3"><label class="form-label">Placa</label><input class="form-control" formControlName="placa" /></div>
        <div class="col-6 col-md-3"><label class="form-label">SOAT</label><input class="form-control" formControlName="soat" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Vence SOAT</label><input type="date" class="form-control" formControlName="fechaVencimientoSoat" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Rev. Tecno</label><input class="form-control" formControlName="revisionTecnicoMecanica" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Vence Rev. Tecno</label><input type="date" class="form-control" formControlName="fechaRevisionTecnicoMecanica" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Póliza contractual</label><input class="form-control" formControlName="idPolizasContractual" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Vigencia contractual</label><input class="form-control" formControlName="vigenciaContractual" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Póliza extra</label><input class="form-control" formControlName="idPolizasExtracontractual" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Vigencia extra</label><input class="form-control" formControlName="vigenciaExtracontractual" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Tarjeta operación</label><input class="form-control" formControlName="tarjetaOperacion" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Vence tarjeta</label><input type="date" class="form-control" formControlName="fechaTarjetaOperacion" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Mantenimiento prev.</label><input class="form-control" formControlName="idMatenimientoPreventivo" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Fecha mant.</label><input type="date" class="form-control" formControlName="fechaMantenimiento" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Protocolo alistamiento</label><input class="form-control" formControlName="idProtocoloAlistamientodiario" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Fecha protocolo</label><input type="date" class="form-control" formControlName="fechaProtocoloAlistamientodiario" /></div>
        <div class="col-6 col-md-3">
          <label class="form-label">Clase</label>
          <select class="form-select" formControlName="clase">
            <option [ngValue]="null">—</option>
            @for (c of clases(); track c.codigo) {
              <option [ngValue]="c.codigo">{{ c.descripcion }}</option>
            }
          </select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label">Nivel servicio <span class="text-danger">*</span></label>
          <select class="form-select" formControlName="nivelServicio">
            <option [ngValue]="null">Seleccione…</option>
            @for (n of nivelesServicio(); track n.id) {
              <option [ngValue]="n.id">{{ n.nombre }}</option>
            }
          </select>
        </div>
      </div>
    </div>
  `,
})
export class VehiculosFormComponent implements OnInit {
  revision = input<number>(0);
  dataChange = output<Record<string, unknown>>();

  private readonly fb = inject(FormBuilder);
  private readonly registro = inject(SalidasRegistroService);
  private readonly destroyRef = inject(DestroyRef);

  clases = signal<Array<{ codigo: number; descripcion: string }>>([]);
  nivelesServicio = signal<Array<{ id: number; nombre: string }>>([]);

  form = this.fb.nonNullable.group({
    placa: ['', Validators.required],
    soat: [''],
    fechaVencimientoSoat: [''],
    revisionTecnicoMecanica: [''],
    fechaRevisionTecnicoMecanica: [''],
    idPolizasContractual: [''],
    vigenciaContractual: [''],
    idPolizasExtracontractual: [''],
    vigenciaExtracontractual: [''],
    tarjetaOperacion: [''],
    fechaTarjetaOperacion: [''],
    idMatenimientoPreventivo: [''],
    fechaMantenimiento: [''],
    idProtocoloAlistamientodiario: [''],
    fechaProtocoloAlistamientodiario: [''],
    clase: [null as number | null],
    nivelServicio: [null as number | null, Validators.required],
  });

  constructor() {
    effect(() => {
      this.revision();
      this.cargarIntegradora();
    });
  }

  ngOnInit(): void {
    this.cargarIntegradora();
    this.registro.obtenerNivelesServicio().subscribe((resp: unknown) => {
      this.nivelesServicio.set(extraerNivelesServicio(resp));
    });
    this.registro.obtenerClasesVehiculo().subscribe((resp: unknown) => {
      this.clases.set(extraerMaestrasCodigoDescripcion(resp));
      this.cargarIntegradora();
    });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.emitData());
  }

  private cargarIntegradora(): void {
    const root = leerRespuestaIntegradora();
    if (!root) return;
    const nivelActual = this.form.get('nivelServicio')?.value;
    this.form.patchValue(mapearVehiculoIntegradora(root) as any, { emitEvent: false });
    if (nivelActual != null) {
      this.form.patchValue({ nivelServicio: nivelActual }, { emitEvent: false });
    }
    this.aplicarEstadoCampos();
    this.emitData();
  }

  private aplicarEstadoCampos(): void {
    this.form.disable({ emitEvent: false });
    this.form.get('nivelServicio')?.enable({ emitEvent: false });
  }

  private emitData(): void {
    this.dataChange.emit(this.form.getRawValue() as Record<string, unknown>);
  }
}
