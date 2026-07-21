import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { MantenimientoPreventivo, RegistroMantenimiento } from 'src/app/mantenimientos/modelos/RegistroMantenimiento';
import { NgForm } from '@angular/forms';
import Swal from 'sweetalert2';
import { ServiciosMantenimientos } from 'src/app/mantenimientos/servicios/mantenimientos.service';
import { ParametricasService } from 'src/app/parametricas/servicios/parametricas.service';
import { tiposIdentificaciones } from 'src/app/parametricas/modelos/Parametricas';
import { validacionNumero } from 'src/shared/validadores/validacion-numero';
import { soloLetras } from 'src/shared/validadores/validador-solo-letras';

@Component({
  selector: 'app-modal-registro-preventivo',
  templateUrl: './modal-registro.component.html',
  styleUrls: ['./modal-registro.component.css']
})
export class ModalRegistroPreventivoComponent implements OnInit {
  @ViewChild('modal') modal!: ElementRef
  @ViewChild('popup') popup!: PopupComponent
  @Output() registroGuardado: EventEmitter<boolean> = new EventEmitter<boolean>();
  registro: RegistroMantenimiento = {};
  editar: boolean = false;
  vigiladoId: any;

  siHayRegistros: boolean = false; // Para verificar si hay registros cargados.

  maxDate: string;
  errorHora: boolean = false;
  tiposIdentificaciones: tiposIdentificaciones[] = [];

  mantenimientoPreventivo: MantenimientoPreventivo = {
    placa: '',
    fecha: '',
    hora: '',
    nit: undefined,
    razonSocial: '',
    tipoIdentificacion: '',
    numeroIdentificacion: 0,
    nombreIngeniero: '',
    detalleActividades: ''
  }

  isSupervisor: boolean = false; // Para verificar si el usuario es supervisor

  constructor(
    private servicioModal: NgbModal,
    private servicioMantenimientos: ServiciosMantenimientos,
    private servcioParametricas: ParametricasService,
  ) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Mes en formato 2 dígitos
    const day = String(today.getDate()).padStart(2, '0'); // Día en formato 2 dígitos

    this.maxDate = `${year}-${month}-${day}`; // Formato YYYY-MM-DD
  }

  ngOnInit(): void {

  }

  public abrir(): void {
    this.servicioModal.open(this.modal, {
      windowClass: 'custom-modal-size'
    });
    this.listarTipoIdentificaciones();
    if (this.editar) {
      this.obtenerRegistro(this.registro.id!);
    } else {
      this.siHayRegistrosCargados();
      this.mantenimientoPreventivo = {
        placa: this.registro.placa,
        fecha: '',
        hora: '',
        nit: undefined,
        razonSocial: '',
        tipoIdentificacion: '',
        numeroIdentificacion: undefined,
        nombreIngeniero: '',
        detalleActividades: ''
      };
    }

  }

  siHayRegistrosCargados() {
    this.servicioMantenimientos.historial(1, this.vigiladoId, this.registro.placa!).subscribe({
      next: (respuesta: any) => {
        console.log(respuesta);
        this.siHayRegistros = respuesta.length > 0; // Cambia el valor a true si hay registros
      },
      error: (error: any) => {
        if (error.status === 500) {
          console.error('Error 500: Error Interno del Servidor');
        } else if (error.status === 404) {
          console.error('Error 404: No Encontrado');
          this.siHayRegistros = false; // Cambia el valor a true si no hay registros
        } else if (error.status === 401) {
          console.error('Error 401: No Autorizado');
        } else {
          console.error(`Error ${error.status}: ${error.message}`);
        }
      }
    });
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

  obtenerRegistro(id: string) {
    this.servicioMantenimientos.visualizarMantenimientoPreventivo(id).subscribe(
      (response: any) => {
        this.mantenimientoPreventivo = {
          placa: response.placa,
          fecha: response.fecha.split('T')[0],
          hora: response.hora,
          nit: response.nit,
          razonSocial: response.razon_social,
          tipoIdentificacion: response.tipo_identificacion,
          numeroIdentificacion: response.numero_identificacion,
          nombreIngeniero: response.nombres_responsable,
          detalleActividades: response.detalle_actividades
        };
        console.log('Visualizando registro', response);
      },
      (error: any) => {
        console.error('Error obteniendo registro', error);
      }
    );
  }

  guardarRegistro(form: NgForm) {
    const errores = [
      { condicion: form.invalid, mensaje: 'Todos los campos son obligatorios.' },
      { condicion: this.validarFecha(), mensaje: 'La fecha no puede ser mayor que la actual.' },
      { condicion: this.validarHora(this.mantenimientoPreventivo.hora), mensaje: 'La hora no puede ser mayor que la actual.' }
    ];

    for (const error of errores) {
      if (error.condicion) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.mensaje
      });
      return;
      }
    }

    if (this.editar) {
      this.guardar(this.registro.id);
    }
    else {
      this.servicioMantenimientos.guardarMantenimiento(this.vigiladoId, this.registro.placa, 1).subscribe(
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
    console.log('Guardando registro', this.mantenimientoPreventivo);
    this.servicioMantenimientos.guardarMantenimientoPreventivo(this.mantenimientoPreventivo, id).subscribe(
      (response: any) => {
        let texto;
        if (this.editar) texto = 'Manenimiento actualizado correctamente.';
        else texto = 'Mantenimiento guardado correctamente.';
        Swal.fire({
          icon: 'success',
          title: this.editar ? 'Mantenimiento actualizado' : 'Mantenimieno guardado',
          text: texto
        });
        this.registroGuardado.emit(true); // Emit true when the record is saved successfully
        this.cerrarModal();
      },
      (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ha ocurrido un error al guardar el registro.'
        });
        this.registroGuardado.emit(false); // Emit false if there is an error
      }
    );
  }

  validarHora(valor?: string): boolean {
    if (valor) {
      if (this.mantenimientoPreventivo.fecha) {
        const fechaSeleccionada = this.mantenimientoPreventivo.fecha;
        const fechaActual = this.maxDate;
        // Comparar solo si la fecha seleccionada es la actual
        if (
          this.mantenimientoPreventivo.fecha === fechaActual
        ) {
          const [horas, minutos] = valor.split(':').map(Number);
          const horaIngresada = new Date();
          horaIngresada.setHours(horas, minutos, 0, 0);

          const ahora = new Date();
          ahora.setSeconds(0);
          ahora.setMilliseconds(0);

          if (horaIngresada > ahora) {
            this.errorHora = true; // Hora inválida
            //this.mantenimientoPreventivo.hora = '';  Limpiar el campo de hora
            return true; // Hora inválida
          } else {
            this.errorHora = false; // Hora válida
            this.mantenimientoPreventivo.hora = valor; // Mantener el valor de hora
            return false; // Hora válida
          }
        }
      }
    }
    return false; // No validar la hora si la fecha no es la actual
  }

  validarFecha() {
    return this.maxDate < this.mantenimientoPreventivo.fecha!;
  }

  limitarNumero(event: any) {
    const input = event.target;
    const fieldName = input.name;
    const numeroLimpio = validacionNumero.esNumeroValido(event, 1);
    input.value = numeroLimpio;
    if (fieldName === 'nit') {
      this.mantenimientoPreventivo.nit = numeroLimpio;
    }
    else if (fieldName === 'numeroIdentificacion') {
      this.mantenimientoPreventivo.numeroIdentificacion = numeroLimpio;
    }
  }

  validarSoloLetras(event: KeyboardEvent) {
    soloLetras(event);
  }

  cerrarModal() {
    this.mantenimientoPreventivo = {};
    this.servicioModal.dismissAll();
  }
}
