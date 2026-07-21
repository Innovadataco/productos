import { Component, OnInit, ViewChild } from '@angular/core';
import { ServicioLocalStorage } from 'src/app/administrador/servicios/local-storage.service';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { Usuario } from 'src/app/autenticacion/modelos/IniciarSesionRespuesta';
import { RegistroMantenimiento } from 'src/app/mantenimientos/modelos/RegistroMantenimiento';
import { ServiciosMantenimientos } from 'src/app/mantenimientos/servicios/mantenimientos.service';
import { Verificador } from '../../../../asignaciones/modelos/Verificador';
import { ActivatedRoute, Router } from '@angular/router';
import { Rol } from 'src/app/autenticacion/modelos/Rol';

@Component({
  selector: 'app-formulario',
  templateUrl: './formulario.component.html',
  styleUrls: ['./formulario.component.css']
})
export class FormularioAlistamientoComponent implements OnInit {
  @ViewChild('popup') popup!: PopupComponent

  usuario: Usuario | null = null;
  excedeTamanio: boolean = false;
  tipoIncorrecto: boolean = false;
  listarRegistros: Array<RegistroMantenimiento> = []
  listarRegistrosFiltrados: Array<RegistroMantenimiento> = []

  filteredID: string = '';
  pagePrevent: number = 1
  itemsPerPagePrevent: number = 5

  verificador = false;
  rol: Rol | null
  volverBtn: boolean = false
  isSupervisor: boolean = false

  constructor(private servicioLocalStorage: ServicioLocalStorage,
    private router: Router,
    private servicioMantenimientos: ServiciosMantenimientos,
    private route: ActivatedRoute, // Inyección del ActivatedRoute
  ) {
    this.rol = servicioLocalStorage.obtenerRol()
    this.preCarga();
  }

  ngOnInit(): void {
    this.listarRegistrosAlistamiento();
  }


  preCarga() {  // Función para obtener el usuario autenticado
    if (this.rol?.id === 1) this.isSupervisor = true, this.volverBtn = true;
    this.route.queryParams.subscribe(params => {
      if (params['usuario']) {
        this.usuario = JSON.parse(params['usuario']);
        console.log(this.usuario);
      } else {
        this.usuario = this.servicioLocalStorage.obtenerUsuario();
        if (this.rol?.id === 1) this.router.navigate(['administrar/listado-usuarios'], { queryParams: { usuario: this.usuario, tipoRuta: 3 } });
      }
    });
    //console.log(this.isSupervisor);
  }

  listarRegistrosAlistamiento() {
    this.listarRegistros = []
    this.servicioMantenimientos.listarRegistros(3, this.usuario?.usuario, this.rol?.id).subscribe({
      next: (respuesta: any) => {
        console.log(respuesta);
        this.listarRegistros = respuesta.map((registro: any) => ({
          ...registro,
          /* fechaDiligenciamiento: registro.fechaDiligenciamiento
            ? this.formatearFechaUTC(registro.fechaDiligenciamiento)
            : '-' */
        }));
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

      return registroFiltrado;
    }).filter(registro =>
      Object.values(registro).some(value => {
        const valorCampo = value !== null && value !== undefined ? value.toString().toLowerCase() : '';
        return valorCampo.includes(lowerSearchText);
      })
    );

    console.log(this.listarRegistros);
  }

  formatearFechaUTC(fechaISO: string): string {
    const date = new Date(fechaISO);

    // Obtener la hora en UTC-5 (Colombia)
    const offsetColombia = -5 * 60; // en minutos
    const fechaColombia = new Date(date.getTime() + offsetColombia * 60 * 1000);

    const dia = fechaColombia.getUTCDate().toString().padStart(2, '0');
    const mes = (fechaColombia.getUTCMonth() + 1).toString().padStart(2, '0');
    const anio = fechaColombia.getUTCFullYear();

    return `${dia}/${mes}/${anio}`;
  }


  limpiar() {
    this.filteredID = ''
    this.listarRegistrosFiltrados = []
    this.listarRegistrosAlistamiento();
  }

  abrirRegistro(registro: RegistroMantenimiento, editar: boolean, historial: boolean) {
    if (historial) {
      const info = {
        placa: registro.placa,
        editar: editar,
        vigiladoId: this.usuario?.usuario,
        isSupervisor: this.isSupervisor,
        usuario: this.usuario,
      }
      this.router.navigate(['/administrar/protocolo-alistamiento-historial'], { state: { info: info } });
      return
    } else {
      const info = {
        registro: registro,
        editar: editar,
        estadoMantenimiento: true,
        vigiladoId: this.usuario?.usuario
      }
      this.router.navigate(['/administrar/protocolo-alistamiento-registro'], { state: { info } });
    }
  }

  volver() {
    this.router.navigate(['/administrar/formulario-alistamiento']);
  }

}
