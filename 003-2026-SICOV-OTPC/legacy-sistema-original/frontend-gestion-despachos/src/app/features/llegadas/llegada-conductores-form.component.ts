import { ChangeDetectionStrategy, Component, input, output, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ConductorSalida } from '../../despachos/models/Llegadas';

@Component({
  selector: 'app-llegada-conductores-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <form class="d-grid gap-3" [formGroup]="form" (ngSubmit)="onSubmitPrincipal()">
      <h6 class="mb-0">Conductor principal</h6>
      <div class="row g-2">
        <div class="col-6 col-md-3"><label class="form-label">Tipo ID</label><input class="form-control form-control-sm" formControlName="tipoIdentificacionConductor" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Número ID</label><input class="form-control form-control-sm" formControlName="numeroIdentificacion" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Primer nombre</label><input class="form-control form-control-sm" formControlName="primerNombreConductor" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Segundo nombre</label><input class="form-control form-control-sm" formControlName="segundoNombreConductor" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Primer apellido</label><input class="form-control form-control-sm" formControlName="primerApellidoConductor" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Segundo apellido</label><input class="form-control form-control-sm" formControlName="segundoApellidoConductor" readonly /></div>
        <div class="col-6 col-md-3"><label class="form-label">Licencia</label><input class="form-control form-control-sm" formControlName="licenciaConduccion" readonly /></div>
        <div class="col-12"><label class="form-label">Observaciones</label><textarea class="form-control form-control-sm" formControlName="observaciones"></textarea></div>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button type="submit" class="btn btn-brand btn-sm" [disabled]="form.invalid || saving() || principalGuardado()">
          {{ saving() ? 'Guardando…' : 'Registrar conductor principal' }}
        </button>
        @if (principalGuardado()) { <span class="badge text-bg-success align-self-center">Principal guardado</span> }
      </div>
    </form>

    @if (tieneSecundario()) {
      <form class="d-grid gap-3 mt-3 border-top pt-3" [formGroup]="formSecundario" (ngSubmit)="onSubmitSecundario()">
        <h6 class="mb-0">Conductor secundario</h6>
        <div class="row g-2">
          <div class="col-6 col-md-3"><label class="form-label">Tipo ID</label><input class="form-control form-control-sm" formControlName="tipoIdentificacionConductor" readonly /></div>
          <div class="col-6 col-md-3"><label class="form-label">Número ID</label><input class="form-control form-control-sm" formControlName="numeroIdentificacion" readonly /></div>
          <div class="col-6 col-md-3"><label class="form-label">Primer nombre</label><input class="form-control form-control-sm" formControlName="primerNombreConductor" readonly /></div>
          <div class="col-6 col-md-3"><label class="form-label">Primer apellido</label><input class="form-control form-control-sm" formControlName="primerApellidoConductor" readonly /></div>
          <div class="col-12"><label class="form-label">Observaciones</label><textarea class="form-control form-control-sm" formControlName="observaciones"></textarea></div>
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button type="submit" class="btn btn-outline-primary btn-sm" [disabled]="formSecundario.invalid || saving() || secundarioGuardado()">
            Registrar conductor secundario
          </button>
          @if (secundarioGuardado()) { <span class="badge text-bg-success align-self-center">Secundario guardado</span> }
        </div>
      </form>
    }

    @if (principalGuardado() && (!tieneSecundario() || secundarioGuardado())) {
      <div class="text-end mt-2"><span class="badge text-bg-success">Conductores completados</span></div>
    }
  `,
})
export class LlegadaConductoresFormComponent implements OnInit {
  llegadaId = input.required<string | number>();
  infoSalidaConductor = input<ConductorSalida | null>(null);
  saving = input(false);
  principalGuardado = signal(false);
  secundarioGuardado = signal(false);
  conductoresCompletos = output<void>();
  registrarConductor = output<Record<string, unknown>>();

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    tipoIdentificacionConductor: [''],
    numeroIdentificacion: ['', Validators.required],
    primerNombreConductor: [''],
    segundoNombreConductor: [''],
    primerApellidoConductor: [''],
    segundoApellidoConductor: [''],
    idPruebaAlcoholimetria: [''],
    resultadoPruebaAlcoholimetria: [''],
    fechaUltimaPruebaAlcoholimetria: [''],
    licenciaConduccion: [''],
    fechaVencimientoLicencia: [''],
    idExamenMedico: [''],
    fechaUltimoExamenMedico: [''],
    observaciones: [''],
  });

  formSecundario = this.fb.nonNullable.group({
    tipoIdentificacionConductor: [''],
    numeroIdentificacion: [''],
    primerNombreConductor: [''],
    segundoNombreConductor: [''],
    primerApellidoConductor: [''],
    segundoApellidoConductor: [''],
    idPruebaAlcoholimetria: [''],
    resultadoPruebaAlcoholimetria: [''],
    fechaUltimaPruebaAlcoholimetria: [''],
    licenciaConduccion: [''],
    fechaVencimientoLicencia: [''],
    idExamenMedico: [''],
    fechaUltimoExamenMedico: [''],
    observaciones: [''],
  });

  ngOnInit(): void {
    const c = this.infoSalidaConductor();
    if (!c) return;
    this.form.patchValue({
      tipoIdentificacionConductor: c.tipoIdentificacionConductorPrincipal ?? '',
      numeroIdentificacion: c.numeroIdentificacion ?? '',
      primerNombreConductor: c.primerNombreConductorPrincipal ?? '',
      segundoNombreConductor: c.segundoNombreConductorPrincipal ?? '',
      primerApellidoConductor: c.primerApellidoConductorPrincipal ?? '',
      segundoApellidoConductor: c.segundoApellidoConductorPrincipal ?? '',
      idPruebaAlcoholimetria: c.idPruebaAlcoholimetria ?? '',
      resultadoPruebaAlcoholimetria: c.resultadoPruebaAlcoholimetria ?? '',
      fechaUltimaPruebaAlcoholimetria: c.fechaUltimaPruebaAlcoholimetria ?? '',
      licenciaConduccion: c.licenciaConduccion ?? '',
      fechaVencimientoLicencia: c.fechaVencimientoLicencia ?? '',
      idExamenMedico: c.idExamenMedico ?? '',
      fechaUltimoExamenMedico: c.fechaUltimoExamenMedico ?? '',
      observaciones: c.observaciones ?? '',
    });
    if (c.numeroIdentificacionConductorSecundario) {
      this.formSecundario.patchValue({
        tipoIdentificacionConductor: c.tipoIdentificacionConductorSecundario ?? '',
        numeroIdentificacion: c.numeroIdentificacionConductorSecundario ?? '',
        primerNombreConductor: c.primerNombreConductorSecundario ?? '',
        segundoNombreConductor: c.segundoNombreConductorSecundario ?? '',
        primerApellidoConductor: c.primerApellidoConductorSecundario ?? '',
        segundoApellidoConductor: c.segundoApellidoConductorSecundario ?? '',
        idPruebaAlcoholimetria: c.idPruebaAlcoholimetriaSecundario ?? '',
        licenciaConduccion: c.licenciaConduccionSecundario ?? '',
        fechaVencimientoLicencia: c.fechaVencimientoLicenciaSecundario ?? '',
        idExamenMedico: c.idExamenMedicoSecundario ?? '',
        observaciones: c.observacionesSecundario ?? '',
      });
    }
  }

  tieneSecundario(): boolean {
    return !!this.infoSalidaConductor()?.numeroIdentificacionConductorSecundario;
  }

  onSubmitPrincipal(): void {
    if (this.form.invalid || this.principalGuardado()) return;
    this.registrarConductor.emit({ idLlegada: this.llegadaId(), ...this.form.getRawValue(), esSecundario: false });
  }

  onSubmitSecundario(): void {
    if (this.formSecundario.invalid || this.secundarioGuardado()) return;
    this.registrarConductor.emit({ idLlegada: this.llegadaId(), ...this.formSecundario.getRawValue(), esSecundario: true });
  }

  marcarPrincipalGuardado(): void {
    this.principalGuardado.set(true);
    if (!this.tieneSecundario()) this.conductoresCompletos.emit();
  }

  marcarSecundarioGuardado(): void {
    this.secundarioGuardado.set(true);
    this.conductoresCompletos.emit();
  }
}
