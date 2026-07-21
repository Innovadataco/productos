import { ChangeDetectionStrategy, Component, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SalidasRegistroService } from './salidas-registro.service';
import { leerRespuestaIntegradora, mapearConductoresIntegradora } from './salidas-integradora.util';
import { extraerMaestrasCodigoDescripcion } from './maestras.util';

@Component({
  selector: 'app-conductores-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="d-grid gap-3" [formGroup]="form">
      <div class="row g-3">
      <div class="col-12"><strong>Conductor principal</strong></div>
        <div class="col-6 col-md-3">
          <label class="form-label">Tipo identificación</label>
          <select class="form-select" formControlName="tipoIdentificacionPrincipal">
            <option [ngValue]="null">Seleccione…</option>
            @for (t of tiposId(); track t.codigo) {
              <option [ngValue]="t.codigo">{{ t.descripcion }}</option>
            }
          </select>
        </div>
        <div class="col-6 col-md-3"><label class="form-label">Número identificación</label><input class="form-control" formControlName="numeroIdentificacion" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Primer nombre</label><input class="form-control" formControlName="primerNombrePrincipal" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Segundo nombre</label><input class="form-control" formControlName="segundoNombrePrincipal" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Primer apellido</label><input class="form-control" formControlName="primerApellidoPrincipal" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Segundo apellido</label><input class="form-control" formControlName="segundoApellidoPrincipal" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Alcoholimetría</label><input class="form-control" formControlName="idPruebaAlcoholimetria" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Examen médico</label><input class="form-control" formControlName="idExamenMedico" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Licencia</label><input class="form-control" formControlName="licenciaConduccion" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Vence licencia</label><input type="date" class="form-control" formControlName="fechaVencimientoLicencia" /></div>
      </div>
      @if (mostrarSecundario()) {
        <hr />
        <div class="row g-3">
          <div class="col-12"><strong>Conductor secundario</strong></div>
          <div class="col-6 col-md-3">
            <label class="form-label">Tipo ID (secundario)</label>
            <select class="form-select" formControlName="tipoIdentificacionSecundario">
              <option [ngValue]="null">Seleccione…</option>
              @for (t of tiposId(); track t.codigo) {
                <option [ngValue]="t.codigo">{{ t.descripcion }}</option>
              }
            </select>
          </div>
          <div class="col-6 col-md-3"><label class="form-label">Número ID</label><input class="form-control" formControlName="numeroIdentificacionSecundario" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Primer nombre</label><input class="form-control" formControlName="primerNombreSecundario" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Segundo nombre</label><input class="form-control" formControlName="segundoNombreSecundario" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Primer apellido</label><input class="form-control" formControlName="primerApellidoSecundario" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Segundo apellido</label><input class="form-control" formControlName="segundoApellidoSecundario" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Alcoholimetría</label><input class="form-control" formControlName="idPruebaAlcoholimetriaSecundario" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Examen médico</label><input class="form-control" formControlName="idExamenMedicoSecundario" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Licencia</label><input class="form-control" formControlName="licenciaConduccionSecundario" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Vence licencia</label><input type="date" class="form-control" formControlName="fechaVencimientoLicenciaSecundario" /></div>
        </div>
      }
    </div>
  `,
})
export class ConductoresFormComponent implements OnInit {
  revision = input<number>(0);
  mostrarSecundario = input<boolean>(false);
  dataChange = output<Record<string, unknown>>();

  private readonly fb = inject(FormBuilder);
  private readonly registro = inject(SalidasRegistroService);

  tiposId = signal<Array<{ codigo: number; descripcion: string }>>([]);

  form = this.fb.nonNullable.group({
    tipoIdentificacionPrincipal: [null as number | null, Validators.required],
    numeroIdentificacion: ['', Validators.required],
    primerNombrePrincipal: ['', Validators.required],
    segundoNombrePrincipal: [''],
    primerApellidoPrincipal: ['', Validators.required],
    segundoApellidoPrincipal: [''],
    idPruebaAlcoholimetria: [''],
    idExamenMedico: [''],
    licenciaConduccion: [''],
    fechaVencimientoLicencia: [''],
    tipoIdentificacionSecundario: [null as number | null],
    numeroIdentificacionSecundario: [''],
    primerNombreSecundario: [''],
    segundoNombreSecundario: [''],
    primerApellidoSecundario: [''],
    segundoApellidoSecundario: [''],
    idPruebaAlcoholimetriaSecundario: [''],
    idExamenMedicoSecundario: [''],
    licenciaConduccionSecundario: [''],
    fechaVencimientoLicenciaSecundario: [''],
  });

  constructor() {
    effect(() => {
      this.revision();
      this.mostrarSecundario();
      this.cargarIntegradora();
    });
  }

  ngOnInit(): void {
    this.cargarIntegradora();
    this.registro.obtenerTiposIdentificacion().subscribe((resp: unknown) => {
      this.tiposId.set(extraerMaestrasCodigoDescripcion(resp));
      this.cargarIntegradora();
    });
  }

  private cargarIntegradora(): void {
    const root = leerRespuestaIntegradora();
    if (!root) return;
    const mapped = mapearConductoresIntegradora(root);
    this.form.patchValue(mapped as any, { emitEvent: false });
    this.form.disable({ emitEvent: false });
    this.emitData();
  }

  private emitData(): void {
    const raw = this.form.getRawValue();
    if (!raw.numeroIdentificacion?.trim()) return;
    this.dataChange.emit({ ...raw });
  }
}
