import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { HistorialAlistamiento } from 'src/app/mantenimientos/modelos/Historial';
import { RegistroMantenimiento } from 'src/app/mantenimientos/modelos/RegistroMantenimiento';
import { ServiciosMantenimientos } from 'src/app/mantenimientos/servicios/mantenimientos.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-historial',
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.css']
})
export class HistorialProtocoloAlistamientoComponent implements OnInit {
  @ViewChild('popup') popup!: PopupComponent

  placa: string = '';
  editar: boolean = false;
  vigiladoId: any;
  listarRegistros: Array<HistorialAlistamiento> = []
  listarRegistrosFiltrados: Array<HistorialAlistamiento> = []

  filteredID: string = '';
  pagePrevent: number = 1
  itemsPerPagePrevent: number = 5
  isSupervisor: boolean = false;
  usuario: any;

  verificador = false;
  ngOnInit(): void {
    this.listarRegistrosAlistamiento();
  }

  constructor(
    private router: Router,
    private servicioMantenimientos: ServiciosMantenimientos,
  ) {
    this.placa = history.state.info.placa
    this.vigiladoId = history.state.info.vigiladoId
    this.editar = history.state.info.editar
    this.isSupervisor = history.state.info.isSupervisor
    this.usuario = history.state.info.usuario
  }

  listarRegistrosAlistamiento() {
    this.listarRegistros = []
    this.servicioMantenimientos.historial(3, this.vigiladoId, this.placa).subscribe({
      next: (respuesta: any) => {
        this.listarRegistros = respuesta
        this.listarRegistrosFiltrados = this.listarRegistros
      },
      error: (error: any) => {
        if (error.status === 500) {
          console.error('Error 500: Error Interno del Servidor');
        } else if (error.status === 404) {
          console.error('Error 404: No Encontrado');
          this.verificador = true;
        } else if (error.status === 401) {
          console.error('Error 401: No Autorizado');
        } else {
          console.error(`Error ${error.status}: ${error.message}`);
        }
      }
    })
  }

  filtrarRegistros() {
    this.pagePrevent = 1;
    let lowerSearchText = this.filteredID.toLowerCase();

    if (lowerSearchText === 'activo') {
      lowerSearchText = 'true';
    } else if (lowerSearchText === 'inactivo') {
      lowerSearchText = 'false';
    }
    const camposExcluidos = [
      'tipoId',
      'estado'
    ]; // Reemplaza con los nombres de los campos a excluir
    this.listarRegistrosFiltrados = this.listarRegistros.map(registro => {
      // Crear una copia del objeto excluyendo los campos no deseados
      const registroFiltrado = Object.entries(registro).reduce((obj, [key, value]) => {
        if (!camposExcluidos.includes(key)) {
          obj[key] = value;
        }
        return obj;
      }, {} as any);

      return registroFiltrado;
    }).filter(registro =>
      Object.values(registro).some(value => {
        const valorCampo = value !== null && value !== undefined ? value.toString().toLowerCase() : '';
        return valorCampo.includes(lowerSearchText);
      })
    );
  }

  limpiar() {
    this.filteredID = ''
    this.listarRegistrosFiltrados = []
    this.listarRegistrosAlistamiento();
  }

  exportarHistorial() {
    return this.servicioMantenimientos.exportarHistorial(3,this.vigiladoId, this.placa)
  }

  abrirRegistro(registro: HistorialAlistamiento, editar: boolean) {
    const info = {
      registro: registro,
      editar: editar,
      estadoMantenimiento: registro.estadoMantenimiento,
      vigiladoId: this.vigiladoId,
      isSupervisor: this.isSupervisor,
      usuario: this.usuario,
    }
    this.router.navigate(['/administrar/protocolo-alistamiento-registro'], { state: { info } });
  }

  volver(){
    if(this.isSupervisor){
      this.router.navigate(['/administrar/formulario-alistamiento'], { queryParams: { usuario: JSON.stringify(this.usuario), tipo: 3} });
    }else{
      this.router.navigate(['/administrar/formulario-alistamiento']);
    }
  }

}
