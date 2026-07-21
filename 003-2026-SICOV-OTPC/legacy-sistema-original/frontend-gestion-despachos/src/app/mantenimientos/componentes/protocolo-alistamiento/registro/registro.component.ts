import { Component, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { ServicioLocalStorage } from 'src/app/administrador/servicios/local-storage.service';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { DetallesActividades, ProtocoloAlistamiento, RegistroProtocoloAlistamiento } from 'src/app/mantenimientos/modelos/RegistroProtocoloAlistamiento';
import { ServiciosMantenimientos } from 'src/app/mantenimientos/servicios/mantenimientos.service';
import { tiposIdentificaciones } from 'src/app/parametricas/modelos/Parametricas';
import { ParametricasService } from 'src/app/parametricas/servicios/parametricas.service';
import { validacionNombre } from 'src/shared/validadores/validacion-nombre';
import { SoloLetrasyNumeros, validacionNumero } from 'src/shared/validadores/validacion-numero';
import Swal from 'sweetalert2';
import { Usuario } from '../../../../autenticacion/modelos/IniciarSesionRespuesta';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css']
})
export class RegistroProtocoloAlistamientoComponent implements OnInit {
  @ViewChild('popup') popup!: PopupComponent
  registro: RegistroProtocoloAlistamiento = {};
  editar: boolean = false;
  vigiladoId: any;
  Usuario: any
  maxDate: Date = new Date();
  estadoMantenimiento = true;
  todosChecked = false;
  tiposIdentificaciones: tiposIdentificaciones[] = [];
  detallesActividades: DetallesActividades[] = [];
  detallesActividadesSeleccionadas: number[] = [];
  isSupervisor: boolean = false;
  tamanoMaximo: number = 15;

  protocoloAlistamiento: ProtocoloAlistamiento = {
    placa: '',
    tipoIdentificacion: '',
    numeroIdentificacion: undefined,
    nombreResponsable: '',
    tipoIdentificacionConductor: '',
    numeroIdentificacionConductor: undefined,
    nombreConductor: '',
    actividades: [],
    detalleActividades: ''
  }

  constructor(
    private router: Router,
    private servicioMantenimientos: ServiciosMantenimientos,
    private servcioParametricas: ParametricasService,
  ) {
    this.vigiladoId = history.state.info.vigiladoId
    this.registro = history.state.info.registro;//Ids necesarios para la consulta de la ruta.
    this.editar = history.state.info.editar;
    this.estadoMantenimiento = history.state.info.estadoMantenimiento;
    this.isSupervisor = history.state.info.isSupervisor;
    this.Usuario = history.state.info.usuario;
  }

  ngOnInit(): void {
    this.listarListarActividades();
    this.listarTipoIdentificaciones();
    this.detallesActividadesSeleccionadas = [];
    if (this.editar) {
      console.log(this.registro);

      this.obtenerRegistro(this.registro.mantenimiento_id!);
    } else {
      this.protocoloAlistamiento = {
        placa: this.registro.placa,
        tipoIdentificacion: '',
        numeroIdentificacion: undefined,
        nombreResponsable: '',
        tipoIdentificacionConductor: '',
        numeroIdentificacionConductor: undefined,
        nombreConductor: '',
        actividades: [],
        detalleActividades: ''
      };
    }
  }

  listarTipoIdentificaciones() {
    this.servcioParametricas.obtenerParametrica('listar-tipo-identificaciones').subscribe(
      (response: any) => {
        this.tiposIdentificaciones = response;
      },
      (error: any) => {
        console.error('Error obteniendo tipo de identificaciones', error);
      }
    );
  }

  listarListarActividades() {
    this.servicioMantenimientos.listarActividades().subscribe(
      (response: any) => {
        this.detallesActividades = response;
      },
      (error: any) => {
        console.error('Error obteniendo tipo de identificaciones', error);
      }
    );
  }

  obtenerRegistro(id: string) {
    this.servicioMantenimientos.visualizarAlistamiento(id).subscribe(
      (response: any) => {
        this.protocoloAlistamiento = {
          placa: response.placa,
          tipoIdentificacion: response.tipo_identificacion_responsable,
          numeroIdentificacion: response.numero_identificacion_responsable,
          nombreResponsable: response.nombre_responsable,
          tipoIdentificacionConductor: response.tipo_identificacion_conductor,
          numeroIdentificacionConductor: response.numero_identificacion_conductor,
          nombreConductor: response.nombres_conductor,
          actividades: response.actividades,
          detalleActividades: response.detalle_actividades
        };
        this.marcarCheckboxes();
        if (this.protocoloAlistamiento.actividades?.length === this.detallesActividades.length) {
          this.todosChecked = true
          console.log('Todos los checkboxes están marcados', this.todosChecked);
        }
        console.log('Visualizando registro', response);
      },
      (error: any) => {
        console.error('Error obteniendo registro', error);
      }
    );
  }

  marcarCheckboxes() {
    for (let actividad of this.protocoloAlistamiento.actividades!) {
      this.detallesActividadesSeleccionadas.push(actividad.id);
    }
    setTimeout(() => {
      this.detallesActividadesSeleccionadas.forEach((id) => {
        const checkbox = document.getElementById(`checkbox-${id}`) as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = true;
        }
      });
      console.log('Actividades seleccionadas', this.detallesActividadesSeleccionadas);
    }, 70);
  }

  cambiarEstado(event: Event, id: number) {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      if (!this.detallesActividadesSeleccionadas.includes(id)) {
        this.detallesActividadesSeleccionadas.push(id);
      }
      if (this.detallesActividadesSeleccionadas?.length === (this.detallesActividades.length)) {
        this.todosChecked = true
      } else {
        this.todosChecked = false
      }
    } else {
      const index = this.detallesActividadesSeleccionadas.indexOf(id);
      if (index > -1) {
        this.detallesActividadesSeleccionadas.splice(index, 1);
      }
      if (this.detallesActividadesSeleccionadas?.length === (this.detallesActividades.length)) {
        this.todosChecked = true
      } else {
        this.todosChecked = false
      }
    }
    console.log('Detalles actividades seleccionadas', this.detallesActividadesSeleccionadas);
  }

  validarDetallesSeleccionados() {
    if (this.detallesActividadesSeleccionadas.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Debe seleccionar al menos una actividad.'
      });
      return false;
    } else {
      return true;
    }
  }

  guardarRegistro(form: NgForm) {
    if (form.invalid) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Diligenciar los campos del formulario.'
      });
      return;
    } else if (!this.validarDetallesSeleccionados()) {
      return;
    } else if (this.protocoloAlistamiento.detalleActividades == '') {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'La observación es obligatoria.'
      });
      return;
    }

    if (this.editar) {
      this.guardar(this.registro.mantenimiento_id);
    }
    else {
      this.servicioMantenimientos.guardarMantenimiento(this.vigiladoId, this.registro.placa, 3).subscribe(
        (response: any) => {
          this.guardar(response.id);
        },
        (error: any) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ha ocurrido un error al guardar el registro.'
          });
        }
      );
    }
  }

  guardar(id: any) {
    Swal.fire({
      title: 'Guardando información',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading(null)
      }
    });
    this.protocoloAlistamiento.actividades = this.detallesActividadesSeleccionadas;
    console.log('Guardando registro', this.protocoloAlistamiento);
    this.servicioMantenimientos.guardarAlistamiento(this.protocoloAlistamiento, id).subscribe(
      (response: any) => {
        let texto
        if (this.editar) texto = 'Alistamiento actualizado correctamente.'
        else texto = 'Alistamiento guardado correctamente.'
        Swal.fire({
          icon: 'success',
          title: this.editar ? 'Alistamiento actualizado' : 'Alistamiento guardado',
          text: texto
        });
        this.router.navigate(['/administrar/formulario-alistamiento']);
        this.detallesActividadesSeleccionadas = [];
      },
      (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ha ocurrido un error al guardar el registro.'
        });
      }
    );
  }

  manejarNombre(event: any) {
    const input = event.target;
    const fieldName = input.name;
    const nombreLimpio = validacionNombre.esNombreValido(event);

    input.value = nombreLimpio;

    if (fieldName === 'nombreResponsable') {
      this.protocoloAlistamiento.nombreResponsable = nombreLimpio;
    }
    else if (fieldName === 'nombreConductor') {
      this.protocoloAlistamiento.nombreConductor = nombreLimpio;
    }
  }

    validarSoloLetrasyNumeros(event: KeyboardEvent) {
      SoloLetrasyNumeros(event);
    }

  volver() {
    this.detallesActividadesSeleccionadas = [];
    if (this.editar) {
      const info = {
        placa: this.registro.placa,
        editar: this.editar,
        vigiladoId: this.vigiladoId,
        isSupervisor: this.isSupervisor,
        usuario: this.Usuario,
      }
      this.router.navigate(['/administrar/protocolo-alistamiento-historial'], { state: { info: info } });
    } else {
      this.router.navigate(['/administrar/formulario-alistamiento']);
    }
  }

}
