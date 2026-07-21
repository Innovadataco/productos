import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AutorizacionFormulario } from './autorizaciones.models';
import { AutorizacionesService } from './autorizaciones.service';
import { ParametricasService } from '../../parametricas/servicios/parametricas.service';
import Swal from 'sweetalert2';

export interface AutorizacionFormContext {
  mantenimientoId?: string | number;
  vigiladoId: string;
  placa: string;
  editar: boolean;
}

export type SubmitEvent = { form: AutorizacionFormulario; mantenimientoId?: string | number };

@Component({
  selector: 'app-autorizaciones-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" class="d-grid gap-3 border p-3 rounded-3 shadow-sm bg-white" (ngSubmit)="onSubmit()">

      <fieldset class="row g-3 border rounded p-3 shadow-sm">
        <legend class="float-none w-auto px-2 mb-0">Información del viaje</legend>
        <div class="row mb-2">
          <div class="col-sm-6 col-lg-4">
            <label class="form-label">Placa</label>
            <input type="text" class="form-control" [value]="context().placa" disabled />
          </div>
          <div class="col-sm-6 col-lg-4">
            <label class="form-label">Fecha del viaje</label>
            <input type="date" class="form-control" formControlName="fechaViaje" [attr.min]="minDate" placeholder="dd/mm/aaaa" />
            <span>
              @if (form.get('fechaViaje')?.touched && form.get('fechaViaje')?.invalid) {
                @if (form.get('fechaViaje')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              }
              @if (form.get('fechaViaje')?.value < minDate) {<small class="text-danger">La fecha del viaje no puede ser anterior a la actual.</small>}
            </span>
          </div>
        </div>
        <div class="row mb-2"> <!-- ORIGEN -->
          <div class="col">
            <label class="form-label">Departamento origen (Filtro)</label>
            <select class="form-select" formControlName="departamentoOrigen" (change)="onDepartamentoChange('origen')">
              <option [ngValue]="null">Seleccione un departamento</option>
              @for (d of departamentos(); track d.codigo) { <option [value]="d.codigo">{{ d.descripcion }}</option> }
            </select>
            <span>
              @if (form.get('departamentoOrigen')?.touched && form.get('departamentoOrigen')?.invalid) {
                @if (form.get('departamentoOrigen')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              }
            </span>
          </div>
          <div class="col">
            <label class="form-label">Municipio origen (Filtro)</label>
            <select class="form-select" formControlName="municipioOrigen" (change)="onMunicipioChange('origen')" [disabled]="!form.get('departamentoOrigen')?.value">
              <option [ngValue]="null">Seleccione un municipio</option>
              @for (m of municipiosOrigen(); track m.codigo) { <option [value]="m.codigo">{{ m.descripcion }}</option> }
            </select>
            <span>
              @if (form.get('municipioOrigen')?.touched && form.get('municipioOrigen')?.invalid) {
                @if (form.get('municipioOrigen')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              }
            </span>
          </div>
          <div class="col">
            <label class="form-label">Centro poblado origen</label>
            <select class="form-select" formControlName="origen" [disabled]="!form.get('municipioOrigen')?.value">
              <option [ngValue]="null">Seleccione un centro poblado</option>
              @for (u of ubicacionesOrigen(); track u.codigo) { <option [value]="u.codigo">{{ u.descripcion }}</option> }
            </select>
            <span>
              @if (form.get('origen')?.touched && form.get('origen')?.invalid) {
                @if (form.get('origen')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              }
            </span>
          </div>
        </div>
        <div class="row mb-2"> <!-- DESTINO -->
          <div class="col">
            <label class="form-label">Departamento destino (Filtro)</label>
            <select class="form-select" formControlName="departamentoDestino" (change)="onDepartamentoChange('destino')">
              <option [ngValue]="null">Seleccione un departamento</option>
              @for (d of departamentos(); track d.codigo) { <option [value]="d.codigo">{{ d.descripcion }}</option> }
            </select>
            <span>
              @if (form.get('departamentoDestino')?.touched && form.get('departamentoDestino')?.invalid) {
                @if (form.get('departamentoDestino')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              }
            </span>
          </div>
          <div class="col">
            <label class="form-label">Municipio destino (Filtro)</label>
            <select class="form-select" formControlName="municipioDestino" (change)="onMunicipioChange('destino')" [disabled]="!form.get('departamentoDestino')?.value">
              <option [ngValue]="null">Seleccione un municipio</option>
              @for (m of municipiosDestino(); track m.codigo) { <option [value]="m.codigo">{{ m.descripcion }}</option> }
            </select>
            <span>
              @if (form.get('municipioDestino')?.touched && form.get('municipioDestino')?.invalid) {
                @if (form.get('municipioDestino')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              }
            </span>
          </div>
          <div class="col">
            <label class="form-label">Centro poblado destino</label>
            <select class="form-select" formControlName="destino" [disabled]="!form.get('municipioDestino')?.value">
              <option [ngValue]="null">Seleccione un centro poblado</option>
              @for (u of ubicacionesDestino(); track u.codigo) { <option [value]="u.codigo">{{ u.descripcion }}</option> }
            </select>
            <span>
              @if (form.get('destino')?.touched && form.get('destino')?.invalid) {
                @if (form.get('destino')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              }
            </span>
          </div>
        </div>
      </fieldset>

      <hr />
      <fieldset class="row g-3 border rounded p-3 shadow-sm">
        <legend class="float-none w-auto px-2 mb-0">Información del menor de edad - Niño, niña o adolescente (NNA)</legend>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Tipo de identificación</label>
          <select class="form-select" formControlName="tipoIdentificacionNna">
            <option [ngValue]="null">Seleccione un tipo</option>
            @for (t of tiposIdentificacionesNna(); track t.codigo) { <option [value]="t.codigo">{{ t.descripcion }}</option> }
          </select>
          <span>
            @if (form.get('tipoIdentificacionNna')?.touched && form.get('tipoIdentificacionNna')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Número de identificación</label>
          <input class="form-control" formControlName="numeroIdentificacionNna" placeholder="Ej: 1023456789" (keypress)="soloLetrasYNumeros($event)" minlength="5" maxlength="14"/>
          <span>
            @if (form.get('numeroIdentificacionNna')?.touched && form.get('numeroIdentificacionNna')?.invalid) {
              @if (form.get('numeroIdentificacionNna')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              @if (form.get('numeroIdentificacionNna')?.errors?.['pattern']) {<small class="text-danger">(5-14 caracteres).</small>}
            }
          </span>
        </div>
        <div class="col-lg-4">
          <label class="form-label">Nombres y apellidos</label>
          <input class="form-control" formControlName="nombresApellidosNna" placeholder="Ej: Juan Pérez Ramírez" />
          <span>
            @if (form.get('nombresApellidosNna')?.touched && form.get('nombresApellidosNna')?.invalid) {
              @if (form.get('nombresApellidosNna')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              @if (form.get('nombresApellidosNna')?.errors?.['minlength']) {<small class="text-danger">Mínimo 3 caracteres.</small>}
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">¿El menor se encuentra en situación de discapacidad?</label>
          <select class="form-select" formControlName="situacionDiscapacidad" (change)="onSituacionDiscapacidad()">
            <option [ngValue]="null">Seleccione una respuesta</option>
            <option value="SI">Sí</option>
            <option value="NO">No</option>
          </select>
          <span>
            @if (form.get('situacionDiscapacidad')?.touched && form.get('situacionDiscapacidad')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Tipo de discapacidad</label>
          <select class="form-select" formControlName="tipoDiscapacidad" [disabled]="form.get('situacionDiscapacidad')?.value!=='SI'">
            <option [ngValue]="null">Seleccione un tipo</option>
            @for (t of discapacidades(); track t.codigo) { <option [value]="t.codigo">{{ t.descripcion }}</option> }
          </select>
          <span>
            @if (form.get('tipoDiscapacidad')?.touched && form.get('tipoDiscapacidad')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">¿Pertenece a alguna comunidad étnica?</label>
          <select class="form-select" formControlName="perteneceComunidadEtnica" (change)="onPertenenciaEtnica()">
            <option [ngValue]="null">Seleccione una respuesta</option>
            <option value="SI">Sí</option>
            <option value="NO">No</option>
          </select>
          <span>
            @if (form.get('perteneceComunidadEtnica')?.touched && form.get('perteneceComunidadEtnica')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Tipo de población étnica</label>
          <select class="form-select" formControlName="tipoPoblacionEtnica" [disabled]="form.get('perteneceComunidadEtnica')?.value!=='SI'">
            <option [ngValue]="null">Seleccione un tipo</option>
            @for (e of etnias(); track e.codigo) { <option [value]="e.codigo">{{ e.descripcion }}</option> }
          </select>
          <span>
            @if (form.get('tipoPoblacionEtnica')?.touched && form.get('tipoPoblacionEtnica')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
      </fieldset>

      <hr />
      <fieldset class="row g-3 border rounded p-3 shadow-sm">
        <legend class="float-none w-auto px-2 mb-0">Información del mayor de edad que otorga la autorización</legend>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Tipo de identificación</label>
          <select class="form-select" formControlName="tipoIdentificacionOtorgante">
            <option [ngValue]="null">Seleccione un tipo</option>
            @for (t of tiposIdentificaciones(); track t.codigo) { <option [value]="t.codigo">{{ t.descripcion }}</option> }
          </select>
          <span>
            @if (form.get('tipoIdentificacionOtorgante')?.touched && form.get('tipoIdentificacionOtorgante')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Número de identificación</label>
          <input class="form-control" formControlName="numeroIdentificacionOtorgante" placeholder="Ej: 1234567890" (keypress)="soloLetrasYNumeros($event)" minlength="5" maxlength="14"/>
          <span>
            @if (form.get('numeroIdentificacionOtorgante')?.touched && form.get('numeroIdentificacionOtorgante')?.invalid) {
              @if (form.get('numeroIdentificacionOtorgante')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              @if (form.get('numeroIdentificacionOtorgante')?.errors?.['pattern']) {<small class="text-danger">(5-14 caracteres).</small>}
            }
          </span>
        </div>
        <div class="col-lg-4">
          <label class="form-label">Nombres y apellidos</label>
          <input class="form-control" formControlName="nombresApellidosOtorgante" placeholder="Ej: María Gómez" />
          <span>
            @if (form.get('nombresApellidosOtorgante')?.touched && form.get('nombresApellidosOtorgante')?.invalid) {
              @if (form.get('nombresApellidosOtorgante')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              @if (form.get('nombresApellidosOtorgante')?.errors?.['minlength']) {<small class="text-danger">Mínimo 3 caracteres.</small>}
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Correo electrónico</label>
          <input class="form-control" formControlName="correoElectronicoOtorgante" placeholder="Ej: correo@dominio.com" />
          <span>
            @if (form.get('correoElectronicoOtorgante')?.touched && form.get('correoElectronicoOtorgante')?.invalid) {
              @if (form.get('correoElectronicoOtorgante')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              @if (form.get('correoElectronicoOtorgante')?.errors?.['email']) {<small class="text-danger">Correo inválido.</small>}
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Teléfono</label>
          <input class="form-control" formControlName="numeroTelefonicoOtorgante" placeholder="Ej: 3001234567" maxlength="12" (keypress)="soloNumeros($event)"/>
          <span>
            @if (form.get('numeroTelefonicoOtorgante')?.touched && form.get('numeroTelefonicoOtorgante')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-lg-4">
          <label class="form-label">Dirección física</label>
          <input class="form-control" formControlName="direccionFisicaOtorgante" placeholder="Ej: Calle 123 #45-67" />
          <span>
            @if (form.get('direccionFisicaOtorgante')?.touched && form.get('direccionFisicaOtorgante')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Sexo</label>
          <select class="form-select" formControlName="sexoOtorgante">
            <option [ngValue]="null">Seleccione una opción</option>
            @for (s of sexos(); track s.codigo) { <option [value]="s.codigo">{{ s.descripcion }}</option> }
          </select>
          <span>
            @if (form.get('sexoOtorgante')?.touched && form.get('sexoOtorgante')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">
            Género <span class="text-warning small">(Opcional)</span>
          </label>
          <select class="form-select" formControlName="generoOtorgante">
            <option [ngValue]="null">Seleccione una opción</option>
            @for (g of generos(); track g.codigo) { <option [value]="g.codigo">{{ g.descripcion }}</option> }
          </select>
          <!-- <span>
            @if (form.get('generoOtorgante')?.touched && form.get('generoOtorgante')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span> -->
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Calidad en que actúa</label>
          <select class="form-select" formControlName="calidadActua">
            <option [ngValue]="null">Seleccione una opción</option>
            @for (p of parentescos(); track p.codigo) { <option [value]="p.codigo">{{ p.descripcion }}</option> }
          </select>
          <span>
            @if (form.get('calidadActua')?.touched && form.get('calidadActua')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
      </fieldset>

      <hr />
      <fieldset class="row g-3 border rounded p-3 shadow-sm">
        <legend class="float-none w-auto px-2 mb-0">Información del autorizado para viajar con el menor de edad</legend>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Tipo de identificación</label>
          <select class="form-select" formControlName="tipoIdentificacionAutorizadoViajar">
            <option [ngValue]="null">Seleccione un tipo</option>
            @for (t of tiposIdentificaciones(); track t.codigo) { <option [value]="t.codigo">{{ t.descripcion }}</option> }
          </select>
          <span>
            @if (form.get('tipoIdentificacionAutorizadoViajar')?.touched && form.get('tipoIdentificacionAutorizadoViajar')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Número de identificación</label>
          <input class="form-control" formControlName="numeroIdentificacionAutorizadoViajar" placeholder="Ej: 987654321" (keypress)="soloLetrasYNumeros($event)" minlength="5" maxlength="14"/>
          <span>
            @if (form.get('numeroIdentificacionAutorizadoViajar')?.touched && form.get('numeroIdentificacionAutorizadoViajar')?.invalid) {
              @if (form.get('numeroIdentificacionAutorizadoViajar')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              @if (form.get('numeroIdentificacionAutorizadoViajar')?.errors?.['pattern']) {<small class="text-danger">(5-14 caracteres).</small>}
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Nombres y apellidos</label>
          <input class="form-control" formControlName="nombresApellidosAutorizadoViajar" placeholder="Ej: Pedro López" />
          <span>
            @if (form.get('nombresApellidosAutorizadoViajar')?.touched && form.get('nombresApellidosAutorizadoViajar')?.invalid) {
              @if (form.get('nombresApellidosAutorizadoViajar')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              @if (form.get('nombresApellidosAutorizadoViajar')?.errors?.['minlength']) {<small class="text-danger">Mínimo 3 caracteres.</small>}
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Teléfono</label>
          <input class="form-control" formControlName="numeroTelefonicoAutorizadoViajar" placeholder="Ej: 3117654321" maxlength="12" (keypress)="soloNumeros($event)"/>
          <span>
            @if (form.get('numeroTelefonicoAutorizadoViajar')?.touched && form.get('numeroTelefonicoAutorizadoViajar')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-lg-4">
          <label class="form-label">Dirección física</label>
          <input class="form-control" formControlName="direccionFisicaAutorizadoViajar" placeholder="Ej: Av. Siempre Viva 742" />
          <span>
            @if (form.get('direccionFisicaAutorizadoViajar')?.touched && form.get('direccionFisicaAutorizadoViajar')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
      </fieldset>

      <hr/>
      <fieldset class="row g-3 border rounded p-3 shadow-sm">
        <legend class="float-none w-auto px-2 mb-0">Información del autorizado para recoger al menor de edad</legend>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Tipo de identificación</label>
          <select class="form-select" formControlName="tipoIdentificacionAutorizadoRecoger">
            <option [ngValue]="null">Seleccione un tipo</option>
            @for (t of tiposIdentificaciones(); track t.codigo) { <option [value]="t.codigo">{{ t.descripcion }}</option> }
          </select>
          <span>
            @if (form.get('tipoIdentificacionAutorizadoRecoger')?.touched && form.get('tipoIdentificacionAutorizadoRecoger')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Número de identificación</label>
          <input class="form-control" formControlName="numeroIdentificacionAutorizadoRecoger" placeholder="Ej: 1122334455" (keypress)="soloLetrasYNumeros($event)" minlength="5" maxlength="14"/>
          <span>
            @if (form.get('numeroIdentificacionAutorizadoRecoger')?.touched && form.get('numeroIdentificacionAutorizadoRecoger')?.invalid) {
              @if (form.get('numeroIdentificacionAutorizadoRecoger')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              @if (form.get('numeroIdentificacionAutorizadoRecoger')?.errors?.['pattern']) {<small class="text-danger">(5-14 caracteres).</small>}
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Nombres y apellidos</label>
          <input class="form-control" formControlName="nombresApellidosAutorizadoRecoger" placeholder="Ej: Laura Martínez" />
          <span>
            @if (form.get('nombresApellidosAutorizadoRecoger')?.touched && form.get('nombresApellidosAutorizadoRecoger')?.invalid) {
              @if (form.get('nombresApellidosAutorizadoRecoger')?.errors?.['required']) {<small class="text-danger">Requerido.</small>}
              @if (form.get('nombresApellidosAutorizadoRecoger')?.errors?.['minlength']) {<small class="text-danger">Mínimo 3 caracteres.</small>}
            }
          </span>
        </div>
        <div class="col-sm-6 col-lg-4">
          <label class="form-label">Teléfono</label>
          <input class="form-control" formControlName="numeroTelefonicoAutorizadoRecoger" placeholder="Ej: 3209988776" maxlength="12" (keypress)="soloNumeros($event)"/>
          <span>
            @if (form.get('numeroTelefonicoAutorizadoRecoger')?.touched && form.get('numeroTelefonicoAutorizadoRecoger')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
        <div class="col-lg-4">
          <label class="form-label">Dirección física</label>
          <input class="form-control" formControlName="direccionFisicaAutorizadoRecoger" placeholder="Ej: Cra. 10 #20-30" />
          <span>
            @if (form.get('direccionFisicaAutorizadoRecoger')?.touched && form.get('direccionFisicaAutorizadoRecoger')?.invalid) {
              <small class="text-danger">Requerido.</small>
            }
          </span>
        </div>
      </fieldset>

      <hr />
      <fieldset class="border rounded p-3 shadow-sm">
        <legend class="float-none w-auto px-2 mb-0">Documentación requerida</legend>
        <div class="row ">
          <div class="col-md-6">
            <label class="form-label">Copia de la manifestación expresa de autorización del viaje de la niña, niño o adolescente</label>
            <div class="d-flex">
              <input #archivo1 type="file" class="form-control" (change)="onFileChange($event, 1, archivo1)" accept=".pdf" />
              @if (doc1Nombre()) {
              <button type="button" class="btn btn-link ms-2 p-0 align-self-center" (click)="limpiarInputArchivo(1, archivo1)">
                <i class="bi bi-x-circle text-danger fs-4" title="Eliminar archivo"></i>
              </button>
              } @else if (cargandoArchivo1()) {
              <div class="spinner-border text-secondary ms-2" role="status" style="width: 1.5rem; height: 1.5rem;">
                <span class="visually-hidden">Cargando...</span>
              </div>
              }
            </div>
          </div>
          <div class="col-md-6">
            <label class="form-label">Copia del documento que pruebe el parentesco</label>
            <div class="d-flex">
              <input #archivo2 type="file" class="form-control" (change)="onFileChange($event, 2, archivo2)" accept=".pdf" />
              @if (doc2Nombre()) {
              <button type="button" class="btn btn-link ms-2 p-0 align-self-center" (click)="limpiarInputArchivo(2, archivo2)">
                <i class="bi bi-x-circle text-danger fs-4" title="Eliminar archivo"></i>
              </button>
              } @else if (cargandoArchivo2()) {
              <div class="spinner-border text-secondary ms-2" role="status" style="width: 1.5rem; height: 1.5rem;">
                <span class="visually-hidden">Cargando...</span>
              </div>
              }
            </div>
          </div>
        </div>
        <div class="row g-3 align-items-end mt-2">
          <div class="col-md-6">
            <label class="form-label">Copia del documento de identidad del mayor de edad que se autoriza</label>
            <div class="d-flex">
              <input #archivo3 type="file" class="form-control" (change)="onFileChange($event, 3, archivo3)" accept=".pdf" />
              @if (doc3Nombre()) {
              <button type="button" class="btn btn-link ms-2 p-0 align-self-center" (click)="limpiarInputArchivo(3, archivo3)">
                <i class="bi bi-x-circle text-danger fs-4" title="Eliminar archivo"></i>
              </button>
              } @else if (cargandoArchivo3()) {
              <div class="spinner-border text-secondary ms-2" role="status" style="width: 1.5rem; height: 1.5rem;">
                <span class="visually-hidden">Cargando...</span>
              </div>
              }
            </div>
          </div>
          <div class="col-md-6">
            <label class="form-label">Copia del documento de constancia de entrega del menor de edad a la persona autorizada</label>
            <div class="d-flex">
              <input #archivo4 type="file" class="form-control" (change)="onFileChange($event, 4, archivo4)" accept=".pdf" />
              @if (doc4Nombre()) {
              <button type="button" class="btn btn-link ms-2 p-0 align-self-center" (click)="limpiarInputArchivo(4, archivo4)">
                <i class="bi bi-x-circle text-danger fs-4" title="Eliminar archivo"></i>
              </button>
              } @else if (cargandoArchivo4()) {
              <div class="spinner-border text-secondary ms-2" role="status" style="width: 1.5rem; height: 1.5rem;">
                <span class="visually-hidden">Cargando...</span>
              </div>
              }
            </div>
          </div>
        </div>
        <small class="text-muted">Solo PDF. Máx 4 MB.</small>
      </fieldset>

      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-outline-secondary" (click)="cancel.emit()" [disabled]="enviando()">Cancelar</button>
        <button type="submit" class="btn btn-brand " [disabled]="!canSubmit()">
          @if (enviando()) {
          <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Guardando...
          } @else {
            Guardar
          }
        </button>
      </div>
    </form>
  `,
})
export class AutorizacionesFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AutorizacionesService);
  private readonly parametricas = inject(ParametricasService);

  context = input.required<AutorizacionFormContext>();
  cancel = output<void>();
  saved = output<void>();

  minDate = this.getBogotaDate();

  form: FormGroup = this.fb.group({
    fechaViaje: ['', [Validators.required]],
    // Cascadas de ubicación (departamento/municipio son auxiliares de UI)
    placa: [''],
    departamentoOrigen: [null, Validators.required],
    municipioOrigen: [null, Validators.required],
    origen: [null, Validators.required],
    departamentoDestino: [null, Validators.required],
    municipioDestino: [null, Validators.required],
    destino: [null, Validators.required],

    tipoIdentificacionNna: [null, Validators.required],
    numeroIdentificacionNna: ['', [Validators.required, Validators.pattern(/^.{5,14}$/)]],
    nombresApellidosNna: ['', [Validators.required, Validators.minLength(3)]],
    situacionDiscapacidad: [null, Validators.required],
    tipoDiscapacidad: [null, Validators.required],
    perteneceComunidadEtnica: [null, Validators.required],
    tipoPoblacionEtnica: [null, Validators.required],

    tipoIdentificacionOtorgante: [null, Validators.required],
    numeroIdentificacionOtorgante: ['', [Validators.required, Validators.pattern(/^.{5,14}$/)]],
    nombresApellidosOtorgante: ['', [Validators.required, Validators.minLength(3)]],
    numeroTelefonicoOtorgante: ['', [Validators.required]],
    correoElectronicoOtorgante: ['', [Validators.required, Validators.email]],
    direccionFisicaOtorgante: ['', Validators.required],
    sexoOtorgante: [null, Validators.required],
    generoOtorgante: [null],
    calidadActua: [null, Validators.required],

    tipoIdentificacionAutorizadoViajar: [null, Validators.required],
    numeroIdentificacionAutorizadoViajar: ['', [Validators.required, Validators.pattern(/^.{5,14}$/)]],
    nombresApellidosAutorizadoViajar: ['', [Validators.required, Validators.minLength(3)]],
    numeroTelefonicoAutorizadoViajar: ['', [Validators.required]],
    direccionFisicaAutorizadoViajar: ['', Validators.required],

    tipoIdentificacionAutorizadoRecoger: [null, Validators.required],
    numeroIdentificacionAutorizadoRecoger: ['', [Validators.required, Validators.pattern(/^.{5,14}$/)]],
    nombresApellidosAutorizadoRecoger: ['', [Validators.required, Validators.minLength(3)]],
    numeroTelefonicoAutorizadoRecoger: ['', [Validators.required]],
    direccionFisicaAutorizadoRecoger: ['', Validators.required],

    // opcionales (se llenan al subir archivos)
    copiaAutorizacionViajeNombreOriginal: [''],
    copiaAutorizacionViajeDocumento: [''],
    copiaAutorizacionViajeRuta: [''],
    copiaDocumentoParentescoNombreOriginal: [''],
    copiaDocumentoParentescoDocumento: [''],
    copiaDocumentoParentescoRuta: [''],
    copiaDocumentoIdentidadAutorizadoNombreOriginal: [''],
    copiaDocumentoIdentidadAutorizadoDocumento: [''],
    copiaDocumentoIdentidadAutorizadoRuta: [''],
    copiaConstanciaEntregaNombreOriginal: [''],
    copiaConstanciaEntregaDocumento: [''],
    copiaConstanciaEntregaRuta: [''],
  });

  // Document display signals
  doc1Nombre = signal<string>('');
  doc2Nombre = signal<string>('');
  doc3Nombre = signal<string>('');
  doc4Nombre = signal<string>('');
  cargandoArchivo1 = signal<boolean>(false);
  cargandoArchivo2 = signal<boolean>(false);
  cargandoArchivo3 = signal<boolean>(false);
  cargandoArchivo4 = signal<boolean>(false);

  // Paramétricas
  departamentos = signal<any[]>([]);
  municipiosOrigen = signal<any[]>([]);
  municipiosDestino = signal<any[]>([]);
  ubicacionesOrigen = signal<any[]>([]);
  ubicacionesDestino = signal<any[]>([]);
  tiposIdentificaciones = signal<any[]>([]);
  tiposIdentificacionesNna = signal<any[]>([]);
  discapacidades = signal<any[]>([]);
  etnias = signal<any[]>([]);
  sexos = signal<any[]>([]);
  generos = signal<any[]>([]);
  parentescos = signal<any[]>([]);
  private readonly formStatus = signal<string>(this.form.status);
  readonly enviando = signal<boolean>(false);

  protected readonly canSubmit = computed(() => {
    this.doc1Nombre();
    this.doc2Nombre();
    this.doc3Nombre();
    this.doc4Nombre();
    this.formStatus(); // reaccionar cuando cambie la validez del formulario
    if (this.enviando()) return false;
    if (!this.form.valid) return false;
    const raw = this.form.getRawValue() as any;
    const requiredDocs = [
      'copiaAutorizacionViajeDocumento',
      'copiaDocumentoParentescoDocumento',
      'copiaDocumentoIdentidadAutorizadoDocumento',
      'copiaConstanciaEntregaDocumento',
    ];
    return requiredDocs.every((k) => !!raw[k]);
  });

  constructor() {
    effect(() => {
      const ctx = this.context();
      if (!ctx) return;

      this.form.reset();
      this.reiniciarCascadas();
      this.actualizarEstadoDiscapacidad(null);
      this.actualizarEstadoPertenencia(null);
      this.doc1Nombre.set('');
      this.doc2Nombre.set('');
      this.doc3Nombre.set('');
      this.doc4Nombre.set('');
      this.form.patchValue({ placa: ctx.placa }, { emitEvent: false });
    });

    this.form.statusChanges.pipe(takeUntilDestroyed()).subscribe((status) => this.formStatus.set(status));

    // Cargar paramétricas base
    this.cargarParametricas();

    // Estado inicial: deshabilitar cascadas hasta escoger padre
    this.form.get('municipioOrigen')?.disable({ emitEvent: false });
    this.form.get('origen')?.disable({ emitEvent: false });
    this.form.get('municipioDestino')?.disable({ emitEvent: false });
    this.form.get('destino')?.disable({ emitEvent: false });
    // Discapacidad / Etnia inicialmente inactivos hasta responder "Sí"
    if (this.form.get('situacionDiscapacidad')?.value !== 'SI') {
      this.form.get('tipoDiscapacidad')?.disable({ emitEvent: false });
    }
    if (this.form.get('perteneceComunidadEtnica')?.value !== 'SI') {
      this.form.get('tipoPoblacionEtnica')?.disable({ emitEvent: false });
    }

    // Reactivar/desactivar según selección de departamento/municipio
    this.form.get('departamentoOrigen')?.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      const has = !!v;
      const mun = this.form.get('municipioOrigen');
      const cp = this.form.get('origen');
      if (!mun || !cp) return;
      if (has) {
        mun.enable({ emitEvent: false });
      } else {
        mun.disable({ emitEvent: false });
        mun.setValue(null, { emitEvent: false });
        cp.disable({ emitEvent: false });
        cp.setValue(null, { emitEvent: false });
        this.municipiosOrigen.set([]);
        this.ubicacionesOrigen.set([]);
      }
    });
    this.form.get('municipioOrigen')?.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      const cp = this.form.get('origen');
      if (!cp) return;
      if (v) {
        cp.enable({ emitEvent: false });
      } else {
        cp.disable({ emitEvent: false });
        cp.setValue(null, { emitEvent: false });
        this.ubicacionesOrigen.set([]);
      }
    });

    this.form.get('departamentoDestino')?.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      const has = !!v;
      const mun = this.form.get('municipioDestino');
      const cp = this.form.get('destino');
      if (!mun || !cp) return;
      if (has) {
        mun.enable({ emitEvent: false });
      } else {
        mun.disable({ emitEvent: false });
        mun.setValue(null, { emitEvent: false });
        cp.disable({ emitEvent: false });
        cp.setValue(null, { emitEvent: false });
        this.municipiosDestino.set([]);
        this.ubicacionesDestino.set([]);
      }
    });
    this.form.get('municipioDestino')?.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      const cp = this.form.get('destino');
      if (!cp) return;
      if (v) {
        cp.enable({ emitEvent: false });
      } else {
        cp.disable({ emitEvent: false });
        cp.setValue(null, { emitEvent: false });
        this.ubicacionesDestino.set([]);
      }
    });
  }

  async onFileChange(event: Event, tipo: number, inputEl?: HTMLInputElement) {
    const input = inputEl ?? (event.target as HTMLInputElement);
    const file = input.files && input.files[0];
    if (!file) return;

    // Validaciones básicas
    if (file.type !== 'application/pdf') {
      alert('Solo se permiten archivos PDF.');
      input.value = '';
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert('El archivo supera 4 MB.');
      input.value = '';
      return;
    }

    const ctx = this.context();
    if (!ctx) return;
    if (tipo === 1) {this.cargandoArchivo1.set(true);}
    if (tipo === 2) {this.cargandoArchivo2.set(true);}
    if (tipo === 3) {this.cargandoArchivo3.set(true);}
    if (tipo === 4) {this.cargandoArchivo4.set(true);}
    const res = await this.service.subirArchivo(file, ctx.vigiladoId).toPromise();
    if (tipo === 1) {this.cargandoArchivo1.set(false);}
    if (tipo === 2) {this.cargandoArchivo2.set(false);}
    if (tipo === 3) {this.cargandoArchivo3.set(false);}
    if (tipo === 4) {this.cargandoArchivo4.set(false);}
    if (!res) return;

    const patch: any = {};
    if (tipo === 1) {
      patch.copiaAutorizacionViajeNombreOriginal = res.nombreOriginalArchivo;
      patch.copiaAutorizacionViajeDocumento = res.nombreAlmacenado;
      patch.copiaAutorizacionViajeRuta = res.ruta;
      this.doc1Nombre.set(res.nombreOriginalArchivo);
    }
    if (tipo === 2) {
      patch.copiaDocumentoParentescoNombreOriginal = res.nombreOriginalArchivo;
      patch.copiaDocumentoParentescoDocumento = res.nombreAlmacenado;
      patch.copiaDocumentoParentescoRuta = res.ruta;
      this.doc2Nombre.set(res.nombreOriginalArchivo);
    }
    if (tipo === 3) {
      patch.copiaDocumentoIdentidadAutorizadoNombreOriginal = res.nombreOriginalArchivo;
      patch.copiaDocumentoIdentidadAutorizadoDocumento = res.nombreAlmacenado;
      patch.copiaDocumentoIdentidadAutorizadoRuta = res.ruta;
      this.doc3Nombre.set(res.nombreOriginalArchivo);
    }
    if (tipo === 4) {
      patch.copiaConstanciaEntregaNombreOriginal = res.nombreOriginalArchivo;
      patch.copiaConstanciaEntregaDocumento = res.nombreAlmacenado;
      patch.copiaConstanciaEntregaRuta = res.ruta;
      this.doc4Nombre.set(res.nombreOriginalArchivo);
    }
    this.form.patchValue(patch);
  }

  limpiarInputArchivo(tipo: number, inputEl?: HTMLInputElement) {
    const patch: any = {};
    if (tipo === 1) {
      patch.copiaAutorizacionViajeNombreOriginal = '';
      patch.copiaAutorizacionViajeDocumento = '';
      patch.copiaAutorizacionViajeRuta = '';
      this.doc1Nombre.set('');
    }
    if (tipo === 2) {
      patch.copiaDocumentoParentescoNombreOriginal = '';
      patch.copiaDocumentoParentescoDocumento = '';
      patch.copiaDocumentoParentescoRuta = '';
      this.doc2Nombre.set('');
    }
    if (tipo === 3) {
      patch.copiaDocumentoIdentidadAutorizadoNombreOriginal = '';
      patch.copiaDocumentoIdentidadAutorizadoDocumento = '';
      patch.copiaDocumentoIdentidadAutorizadoRuta = '';
      this.doc3Nombre.set('');
    }
    if (tipo === 4) {
      patch.copiaConstanciaEntregaNombreOriginal = '';
      patch.copiaConstanciaEntregaDocumento = '';
      patch.copiaConstanciaEntregaRuta = '';
      this.doc4Nombre.set('');
    }
    this.form.patchValue(patch);
    if (inputEl) {
      inputEl.value = '';
    }
  }

  onSubmit() {
    const ctx = this.context();
    if (!ctx) return;

    this.form.markAllAsTouched();
    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });

    // Reglas: en creación, los 4 docs son obligatorios
    const v = this.form.value as any;
    const requiredDocs = [
      'copiaAutorizacionViajeDocumento',
      'copiaDocumentoParentescoDocumento',
      'copiaDocumentoIdentidadAutorizadoDocumento',
      'copiaConstanciaEntregaDocumento',
    ];
    const falta = requiredDocs.some((k) => !v[k]);
    if (falta) {
      Swal.fire({icon: 'warning', title: 'Documentos incompletos', text: 'Debes cargar los 4 documentos requeridos.'});
      return;
    }

    if (this.form.invalid) return;

    // Ajustes según reglas del legado
    const sd = this.form.get('situacionDiscapacidad')?.value as string | undefined;
    const pc = this.form.get('perteneceComunidadEtnica')?.value as string | undefined;
    if (sd === 'NO') this.form.patchValue({ tipoDiscapacidad: '9' });
    if (pc === 'NO') this.form.patchValue({ tipoPoblacionEtnica: '7' });
    if (this.form.get('generoOtorgante')?.value === '') this.form.patchValue({ generoOtorgante: null });

    const payload: AutorizacionFormulario = this.form.getRawValue();

    this.guardarAutorizacion(ctx, payload);
  }

  // ----- Paramétricas y cascadas
  private cargarParametricas() {
    this.parametricas.obtenerParametrica<any[]>('listar-departamentos').subscribe((r) => this.departamentos.set(r ?? []));
    this.parametricas.obtenerParametrica<any[]>('listar-tipo-identificaciones').subscribe((r) => {
      const lista = r ?? [];
      this.tiposIdentificaciones.set(lista);
      // Excluir 1,2,4 para NNA como en legado
      const excl = new Set([1, 2, 4].map(String));
      this.tiposIdentificacionesNna.set(lista.filter((x: any) => !excl.has(String(x.codigo))));
    });
    this.parametricas.obtenerParametrica<any[]>('listar-tipo-discapacidades').subscribe((r) => this.discapacidades.set(r ?? []));
    this.parametricas.obtenerParametrica<any[]>('listar-tipo-poblaciones-etnicas').subscribe((r) => this.etnias.set(r ?? []));
    this.parametricas.obtenerParametrica<any[]>('listar-tipo-sexos').subscribe((r) => this.sexos.set(r ?? []));
    this.parametricas.obtenerParametrica<any[]>('listar-tipo-generos').subscribe((r) => this.generos.set(r ?? []));
    this.parametricas.obtenerParametrica<any[]>('listar-tipo-parentescos').subscribe((r) => this.parentescos.set(r ?? []));
  }

  onDepartamentoChange(tipo: 'origen' | 'destino') {
    const dep = this.form.get(tipo === 'origen' ? 'departamentoOrigen' : 'departamentoDestino')?.value;
    if (!dep) {
      if (tipo === 'origen') { this.municipiosOrigen.set([]); this.ubicacionesOrigen.set([]); this.form.patchValue({ municipioOrigen: null, origen: null }); }
      else { this.municipiosDestino.set([]); this.ubicacionesDestino.set([]); this.form.patchValue({ municipioDestino: null, destino: null }); }
      return;
    }
    this.parametricas.obtenerParametrica<any[]>(`listar-municipios?codigoDepartamento=${dep}`).subscribe((r) => {
      if (tipo === 'origen') { this.municipiosOrigen.set(r ?? []); this.ubicacionesOrigen.set([]); this.form.patchValue({ municipioOrigen: null, origen: null }); }
      else { this.municipiosDestino.set(r ?? []); this.ubicacionesDestino.set([]); this.form.patchValue({ municipioDestino: null, destino: null }); }
    });
  }

  onMunicipioChange(tipo: 'origen' | 'destino') {
    const mun = this.form.get(tipo === 'origen' ? 'municipioOrigen' : 'municipioDestino')?.value;
    if (!mun) {
      if (tipo === 'origen') { this.ubicacionesOrigen.set([]); this.form.patchValue({ origen: null }); }
      else { this.ubicacionesDestino.set([]); this.form.patchValue({ destino: null }); }
      return;
    }
    this.parametricas.obtenerParametrica<any[]>(`listar-centros-poblados?codigoMunicipio=${mun}`).subscribe((r) => {
      if (tipo === 'origen') this.ubicacionesOrigen.set(r ?? []);
      else this.ubicacionesDestino.set(r ?? []);
    });
  }

  private listarUbicacionesPorCodigo(codigo: string, tipo: 'origen' | 'destino') {
    this.parametricas.obtenerParametrica<any[]>(`listar-centros-poblados?codigo=${codigo}`).subscribe((r) => {
      if (tipo === 'origen') this.ubicacionesOrigen.set(r ?? []);
      else this.ubicacionesDestino.set(r ?? []);
    });
  }

  onSituacionDiscapacidad() {
    this.actualizarEstadoDiscapacidad(this.form.get('situacionDiscapacidad')?.value as string | undefined);
  }

  onPertenenciaEtnica() {
    this.actualizarEstadoPertenencia(this.form.get('perteneceComunidadEtnica')?.value as string | undefined);
  }

  soloNumeros(event: KeyboardEvent) {
    const charCode = event.charCode ? event.charCode : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }

  soloLetrasYNumeros(event: KeyboardEvent) {
    const charCode = event.charCode ? event.charCode : event.keyCode;
    if (!(charCode >= 48 && charCode <= 57) && // Números
        !(charCode >= 65 && charCode <= 90) && // Letras mayúsculas
        !(charCode >= 97 && charCode <= 122) && // Letras minúsculas
        charCode !== 32) { // Espacio
      event.preventDefault();
    }
  }

  private async guardarAutorizacion(ctx: AutorizacionFormContext, payload: AutorizacionFormulario) {
    this.enviando.set(true);
    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const crearRes: any = await this.service.crearMantenimiento(ctx.vigiladoId, ctx.placa).toPromise();
      const mantenimientoId = crearRes?.id ?? crearRes?.mantenimientoId ?? crearRes?.mantenimiento_id ?? crearRes;
      if (!mantenimientoId) {
        throw new Error('No se recibió el identificador del mantenimiento');
      }
      await this.service.guardar(payload, mantenimientoId).toPromise();
      Swal.fire({ icon: 'success', title: 'Autorización guardada', timer: 1400, showConfirmButton: false });
      this.saved.emit();
      this.cancel.emit();
    } catch (err: any) {
      console.error('Error guardando autorización', err);
      const msg = this.obtenerMensajeError(err);
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    } finally {
      this.enviando.set(false);
    }
  }

  private obtenerMensajeError(err: any): string {
    const src = (err && (err.error ?? err)) as any;
    if (typeof src === 'string') return src;
    const base = src?.mensaje ?? src?.message ?? err?.message;
    const errors = Array.isArray(src?.errors) ? src.errors : Array.isArray(src?.Messages) ? src.Messages : null;
    if (Array.isArray(errors) && errors.length) {
      const detail = errors.map((x: any) => x?.mensaje ?? x?.message ?? String(x)).join('; ');
      return base ? `${base}: ${detail}` : detail;
    }
    return base || 'No se pudo guardar la autorización';
  }

  private actualizarEstadoDiscapacidad(v: string | null | undefined) {
    const tipoCtrl = this.form.get('tipoDiscapacidad');
    if (!tipoCtrl) return;
    if (v === 'SI') {
      tipoCtrl.enable({ emitEvent: false });
      tipoCtrl.patchValue(null, { emitEvent: false });
    } else if (v === 'NO') {
      this.form.patchValue({ tipoDiscapacidad: '9' }, { emitEvent: false });
      tipoCtrl.disable({ emitEvent: false });
    } else {
      this.form.patchValue({ tipoDiscapacidad: null }, { emitEvent: false });
      tipoCtrl.disable({ emitEvent: false });
    }
    tipoCtrl.updateValueAndValidity({ emitEvent: false });
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private actualizarEstadoPertenencia(v: string | null | undefined) {
    const tipoCtrl = this.form.get('tipoPoblacionEtnica');
    if (!tipoCtrl) return;
    if (v === 'SI') {
      tipoCtrl.enable({ emitEvent: false });
      tipoCtrl.patchValue(null, { emitEvent: false });
    } else if (v === 'NO') {
      this.form.patchValue({ tipoPoblacionEtnica: '7' }, { emitEvent: false });
      tipoCtrl.disable({ emitEvent: false });
    } else {
      this.form.patchValue({ tipoPoblacionEtnica: null }, { emitEvent: false });
      tipoCtrl.disable({ emitEvent: false });
    }
    tipoCtrl.updateValueAndValidity({ emitEvent: false });
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private reiniciarCascadas() {
    this.form.patchValue(
      {
        departamentoOrigen: null,
        municipioOrigen: null,
        origen: null,
        departamentoDestino: null,
        municipioDestino: null,
        destino: null,
      },
      { emitEvent: false }
    );
    this.form.get('municipioOrigen')?.disable({ emitEvent: false });
    this.form.get('origen')?.disable({ emitEvent: false });
    this.form.get('municipioDestino')?.disable({ emitEvent: false });
    this.form.get('destino')?.disable({ emitEvent: false });
    this.municipiosOrigen.set([]);
    this.ubicacionesOrigen.set([]);
    this.municipiosDestino.set([]);
    this.ubicacionesDestino.set([]);
  }

  private getBogotaDate(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  }


}
