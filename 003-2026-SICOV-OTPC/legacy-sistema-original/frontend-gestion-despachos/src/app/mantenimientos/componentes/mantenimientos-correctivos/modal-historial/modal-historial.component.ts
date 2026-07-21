import { Component, ElementRef, ViewChild } from '@angular/core';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { HistorialCorrectivo } from 'src/app/mantenimientos/modelos/Historial';
import { RegistroMantenimiento } from 'src/app/mantenimientos/modelos/RegistroMantenimiento';
import { ServiciosMantenimientos } from 'src/app/mantenimientos/servicios/mantenimientos.service';
import { tiposIdentificaciones } from 'src/app/parametricas/modelos/Parametricas';
import { ParametricasService } from 'src/app/parametricas/servicios/parametricas.service';
import Swal from 'sweetalert2';

declare var bootstrap: any;

@Component({
  selector: 'app-modal-historial-correctivo',
  templateUrl: './modal-historial.component.html',
  styleUrls: ['./modal-historial.component.css']
})
export class ModalHistorialCorrectivoComponent {
  @ViewChild('modal') modal!: ElementRef;
  @ViewChild('popup') popup!: PopupComponent;
  historialRegistros: HistorialCorrectivo[] = [];
  registro: RegistroMantenimiento | null = null;
  vigiladoId?: string = '';

  /* Paginación */
  pageCorrect: number = 1
  itemsPerPageCorrect: number = 5

  tiposIdentificaciones: tiposIdentificaciones[] = [];

  isSupervisor: boolean = false; // Variable to check if the user is a supervisor

  constructor(
    private servicioMantenimientos: ServiciosMantenimientos,
    private servcioParametricas: ParametricasService,
  ) {}

  abrirModal(): void {
    const modalElement = document.getElementById('modalHistorial');
    if (modalElement) {
      const bootstrapModal = new bootstrap.Modal(modalElement);
      bootstrapModal.show();
      console.log('Modal abierto con registros:', this.historialRegistros);
      this.historialRegistros = [];
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

  consultarHistorial(): void {
    this.servicioMantenimientos.historial(2, this.vigiladoId, this.registro?.placa!).subscribe({
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
    return this.servicioMantenimientos.exportarHistorial(2, this.vigiladoId, this.registro?.placa!)
  }

  cerrarModal(): void {
    const modalElement = document.getElementById('modalHistorial');
    if (modalElement) {
      const bootstrapModal = bootstrap.Modal.getInstance(modalElement);
      bootstrapModal?.hide();
      this.historialRegistros = [];
    }
  }
}
