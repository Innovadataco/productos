import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { PaginationControlsComponent } from 'ngx-pagination';
import { ServicioLocalStorage } from 'src/app/administrador/servicios/local-storage.service';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { Rol } from 'src/app/autenticacion/modelos/Rol';
import { HistorialAutorizacion } from 'src/app/mantenimientos/modelos/Historial';
import { RegistroMantenimiento } from 'src/app/mantenimientos/modelos/RegistroMantenimiento';
import { ServiciosMantenimientos } from 'src/app/mantenimientos/servicios/mantenimientos.service';
import { ubicaciones } from 'src/app/parametricas/modelos/Parametricas';
import { ParametricasService } from 'src/app/parametricas/servicios/parametricas.service';

@Component({
  selector: 'app-historial',
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.css']
})
export class HistorialAutorizacionComponent implements OnInit {
  @ViewChild('popup') popup!: PopupComponent
  @ViewChild('paginador1', { static: false }) paginador1!: PaginationControlsComponent;

  placa: string = '';
  editar: boolean = false;
  vigiladoId: any;
  isSupervisor: boolean = false;
  usuario: any;

  listarRegistros: Array<HistorialAutorizacion> = []
  listarRegistrosFiltrados: Array<HistorialAutorizacion> = []
  centrosPoblados: ubicaciones[] = [];
  origen: string = '';
  destino: string = '';

  filteredID: string = '';
  pagePrevent: number = 1
  itemsPerPagePrevent: number = 5

  verificador = false;
  ngOnInit(): void {
    this.listarUbicaciones();
    this.listarRegistrosAlistamiento();
  }

  constructor(
    private router: Router,
    private servicioMantenimientos: ServiciosMantenimientos,
    private servcioParametricas: ParametricasService,
  ) {
    this.placa = history.state.info.placa
    this.vigiladoId = history.state.info.vigiladoId
    this.editar = history.state.info.editar
    this.isSupervisor = history.state.info.isSupervisor;
    this.usuario = history.state.info.usuario
  }

  listarRegistrosAlistamiento() {
    this.listarRegistros = []
    this.servicioMantenimientos.historial(4, this.vigiladoId, this.placa).subscribe({
      next: (respuesta: any) => {
        this.listarRegistros = respuesta.map((registro: any) => ({
          ...registro,
          //fecha_viaje: registro.fecha_viaje ? this.formatearFechaUTC(registro.fecha_viaje) : "-",
        }
        ))
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

  mostrarOrigenDestino(codigo: string, tipo: number) {
    if (tipo == 1) {
      const origen = this.centrosPoblados.find(centro => centro.codigo === codigo)?.descripcion || codigo!;
      return origen;
    } else if (tipo == 2) {
      const destino = this.centrosPoblados.find(centro => centro.codigo === codigo)?.descripcion || codigo!;
      return destino;
    }
    return codigo;
  }

  filtrarRegistros() {
    this.pagePrevent = 1;
    const lowerSearchText = this.filteredID.toLowerCase();
    const camposExcluidos = [
      'tipoId'
    ]; // Reemplaza con los nombres de los campos a excluir
    this.listarRegistrosFiltrados = this.listarRegistros.map(registro => {
      // Crear una copia del objeto excluyendo los campos no deseados
      const registroFiltrado = Object.entries(registro).reduce((obj, [key, value]) => {
        if (!camposExcluidos.includes(key)) {
          obj[key] = value;
        }
        return obj;
      }, {} as any);

      registroFiltrado.origenNombre = this.mostrarOrigenDestino(registro.origen!, 1);
      registroFiltrado.destinoNombre = this.mostrarOrigenDestino(registro.destino!, 2);

      return registroFiltrado;
    }).filter(registro =>
      Object.values(registro).some(value => {
        const valorCampo = value !== null && value !== undefined ? value.toString().toLowerCase() : '';
        return valorCampo.includes(lowerSearchText);
      })
    );
    console.log(this.listarRegistros);
  }

  limpiar() {
    this.filteredID = ''
    this.listarRegistrosFiltrados = []
    this.listarRegistrosAlistamiento();
  }

  exportarHistorial() {
    return this.servicioMantenimientos.exportarHistorial(4,this.vigiladoId, this.placa)
  }

  listarUbicaciones() {
    this.servcioParametricas.obtenerParametrica('listar-centros-poblados').subscribe(
      (response: any) => {
        this.centrosPoblados = response;
      },
      (error: any) => {
        console.error('Error obteniendo tipo de identificaciones', error);
      }
    );

  }

  formatearFechaUTC(fechaISO: string): string {
    const date = new Date(fechaISO);
    const dia = date.getUTCDate().toString().padStart(2, '0');
    const mes = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const anio = date.getUTCFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  abrirRegistro(registro: HistorialAutorizacion, editar: boolean) {
    const info = {
      registro: registro,
      placa: this.placa,
      editar: editar,
      estadoMantenimiento: registro.estadoMantenimiento,
      vigiladoId: this.vigiladoId,
      isSupervisor: this.isSupervisor,
      usuario: this.usuario,
    }
    this.router.navigate(['/administrar/autorizacion-registro'], { state: { info } });
  }

  volver() {
    if (this.isSupervisor) {
      this.router.navigate(['/administrar/autorizacion'], { queryParams: { usuario: JSON.stringify(this.usuario), tipo: 4 } });
    } else {
      this.router.navigate(['/administrar/autorizacion']);
    }
  }

}
