import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { MantenimientoCorrectivo, RegistroMantenimiento } from 'src/app/mantenimientos/modelos/RegistroMantenimiento';
import { NgForm } from '@angular/forms';
import Swal from 'sweetalert2';
import { ServiciosMantenimientos } from 'src/app/mantenimientos/servicios/mantenimientos.service';
import { ParametricasService } from 'src/app/parametricas/servicios/parametricas.service';
import { tiposIdentificaciones } from 'src/app/parametricas/modelos/Parametricas';
import { validacionNumero } from 'src/shared/validadores/validacion-numero';
import { soloLetras } from 'src/shared/validadores/validador-solo-letras';

@Component({
  selector: 'app-modal-registro-correctivo',
  templateUrl: './modal-registro.component.html',
  styleUrls: ['./modal-registro.component.css']
})
export class ModalRegistroCorrectivoComponent implements OnInit {
  @ViewChild('modal') modal!: ElementRef;
  @ViewChild('popup') popup!: PopupComponent;
  @Output() registroGuardado: EventEmitter<boolean> = new EventEmitter<boolean>();
  registro: RegistroMantenimiento = {};
  editar: boolean = false;
  vigiladoId: any;

  siHayRegistros: boolean = false; // Para verificar si hay registros cargados.

  maxDate: string;
  horaInvalida = false;
  tiposIdentificaciones: tiposIdentificaciones[] = [];

  mantenimientoCorrectivo: MantenimientoCorrectivo = {
    placa: '',
    fecha: '',
    hora: '',
    nit: undefined,
    razonSocial: '',
    tipoIdentificacion: '',
    numeroIdentificacion: 0,
    nombreIngeniero: '',
    detalleActividades: ''
  };

  isSupervisor: boolean = false;

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

  ngOnInit(): void { }

  public abrir(): void {
    this.servicioModal.open(this.modal, {
      windowClass: 'custom-modal-size'
    });
    this.listarTipoIdentificaciones();
    if (this.editar) {
      this.obtenerRegistro(this.registro.id!);
    } else {
      this.siHayRegistrosCargados();
      this.mantenimientoCorrectivo = {
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
    this.servicioMantenimientos.historial(2, this.vigiladoId, this.registro.placa!).subscribe({
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
    this.servicioMantenimientos.visualizarMantenimientoCorrectivo(id).subscribe(
      (response: any) => {
        this.mantenimientoCorrectivo = {
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
      { condicion: this.validarHora(this.mantenimientoCorrectivo.hora), mensaje: 'La hora no puede ser mayor que la actual.' }
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
    } else {
      this.servicioMantenimientos.guardarMantenimiento(this.vigiladoId, this.registro.placa, 2).subscribe(
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
    console.log('Guardando registro', this.mantenimientoCorrectivo);
    this.servicioMantenimientos.guardarMantenimientoCorrectivo(this.mantenimientoCorrectivo, id).subscribe(
      (response: any) => {
        let texto;
        if (this.editar) texto = 'Mantenimiento actualizado correctamente.';
        else texto = 'Mantenimiento guardado correctamente.';
        Swal.fire({
          icon: 'success',
          title: this.editar ? 'Mantenimiento actualizado' : 'Mantenimiento guardado',
          text: texto
        });
        this.registroGuardado.emit(true);
        this.cerrarModal();
      },
      (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ha ocurrido un error al guardar el registro.'
        });
        this.registroGuardado.emit(false);
      }
    );
  }

  validarHora(valor?: string): boolean {
    if (valor) {
      if (this.mantenimientoCorrectivo.fecha) {
        const fechaSeleccionada = this.mantenimientoCorrectivo.fecha;
        const fechaActual = this.maxDate;
        // Comparar solo si la fecha seleccionada es la actual
        if (
          this.mantenimientoCorrectivo.fecha === fechaActual
        ) {
          const [horas, minutos] = valor.split(':').map(Number);
          const horaIngresada = new Date();
          horaIngresada.setHours(horas, minutos, 0, 0);

          const ahora = new Date();
          ahora.setSeconds(0);
          ahora.setMilliseconds(0);

          if (horaIngresada > ahora) {
            return true; // Hora inválida
          } else {
            return false; // Hora válida
          }
        }
      }
    }
    return false; // No validar la hora si la fecha no es la actual
  }

  validarFecha() {
    return this.maxDate < this.mantenimientoCorrectivo.fecha!;
  }

  limitarNumero(event: any) {
    const input = event.target;
    const fieldName = input.name;
    const numeroLimpio = validacionNumero.esNumeroValido(event, 1);
    input.value = numeroLimpio;
    if (fieldName === 'nit') {
      this.mantenimientoCorrectivo.nit = numeroLimpio;
    }
    else if (fieldName === 'numeroIdentificacion') {
      this.mantenimientoCorrectivo.numeroIdentificacion = numeroLimpio;
    }
  }

  validarSoloLetras(event: KeyboardEvent) {
    soloLetras(event);
  }

  cerrarModal() {
    this.mantenimientoCorrectivo = {};
    this.servicioModal.dismissAll();
  }
}
