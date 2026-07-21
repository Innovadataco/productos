import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { HistorialPreventivo } from 'src/app/mantenimientos/modelos/Historial';
import { RegistroMantenimiento } from 'src/app/mantenimientos/modelos/RegistroMantenimiento';
import { ServiciosMantenimientos } from 'src/app/mantenimientos/servicios/mantenimientos.service';
import { tiposIdentificaciones } from 'src/app/parametricas/modelos/Parametricas';
import { ParametricasService } from 'src/app/parametricas/servicios/parametricas.service';
import Swal from 'sweetalert2';

declare var bootstrap: any;

@Component({
  selector: 'app-modal-historial-preventivo',
  templateUrl: './modal-historial.component.html',
  styleUrls: ['./modal-historial.component.css']
})
export class ModalHistorialPreventivoComponent {
  @ViewChild('modal') modal!: ElementRef
  @ViewChild('popup') popup!: PopupComponent
  historialRegistros: HistorialPreventivo[] = []; // Array to hold the records passed to the modal
  registro: RegistroMantenimiento | null = null; // To hold the selected record
  vigiladoId?: string = ''; // To hold the selected vehicle's ID

  /* Paginación */
  pagePrevent: number = 1
  itemsPerPagePrevent: number = 5

  tiposIdentificaciones: tiposIdentificaciones[] = [];

  isSupervisor: boolean = false; // Variable to check if the user is a supervisor

  constructor(
    private servicioMantenimientos: ServiciosMantenimientos,
    private servcioParametricas: ParametricasService,
  ) {
  }

  abrirModal(): void {
    const modalElement = document.getElementById('modalHistorial');
    if (modalElement) {
      const bootstrapModal = new bootstrap.Modal(modalElement);
      bootstrapModal.show();
      console.log('Modal abierto con registros:', this.historialRegistros);
      this.historialRegistros = []; // Clear the records when opening the modal
      this.listarTipoIdentificaciones();
      this.consultarHistorial();
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

  tiposIdentificacion (id:any): string {
    const tipoIdentificacion = this.tiposIdentificaciones.find(tipo => tipo.codigo === id);
    return tipoIdentificacion ? tipoIdentificacion.descripcion : '';
  }

  consultarHistorial(){
    this.servicioMantenimientos.historial(1, this.vigiladoId, this.registro?.placa!).subscribe({
      next: (respuesta: any) => {
        console.log(respuesta);
        this.historialRegistros = respuesta;
      },
      error: (error: any) => {
        if (error.status === 500) {
          console.error('Error 500: Error Interno del Servidor');
        } else if (error.status === 404) {
          console.error('Error 404: No Encontrado');
        } else if (error.status === 401) {
          console.error('Error 401: No Autorizado');
        } else {
          console.error(`Error ${error.status}: ${error.message}`);
        }
      }
    });
  }

  exportarHistorial() {
      return this.servicioMantenimientos.exportarHistorial(1, this.vigiladoId, this.registro?.placa!)
    }

  cerrarModal(): void {
    const modalElement = document.getElementById('modalHistorial');
    if (modalElement) {
      const bootstrapModal = bootstrap.Modal.getInstance(modalElement);
      bootstrapModal?.hide();
      this.historialRegistros = []; // Clear the records when closing the modal
    }
  }
}
