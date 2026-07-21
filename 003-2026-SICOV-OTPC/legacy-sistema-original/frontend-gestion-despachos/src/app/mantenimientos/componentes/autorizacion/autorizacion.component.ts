import { Component, OnInit } from '@angular/core';
import { ServicioLocalStorage } from 'src/app/administrador/servicios/local-storage.service';
import { ServiciosMantenimientos } from '../../servicios/mantenimientos.service';
import { RegistroMantenimiento } from '../../modelos/RegistroMantenimiento';
import { Usuario } from 'src/app/autenticacion/modelos/IniciarSesionRespuesta';
import { ActivatedRoute, Router } from '@angular/router';
import { Rol } from 'src/app/autenticacion/modelos/Rol';

@Component({
  selector: 'app-autorizacion',
  templateUrl: './autorizacion.component.html',
  styleUrls: ['./autorizacion.component.css']
})
export class AutorizacionComponent implements OnInit {
  usuario: Usuario | null = null;
  excedeTamanio: boolean = false;
  tipoIncorrecto: boolean = false;
  listarRegistros: Array<RegistroMantenimiento> = []
  listarRegistrosFiltrados: Array<RegistroMantenimiento> = []

  filteredID: string = '';
  pagePrevent: number = 1
  itemsPerPagePrevent: number = 5

  rol: Rol | null
  volverBtn: boolean = false
  isSupervisor: boolean = false


  constructor(private servicioLocalStorage: ServicioLocalStorage,
    private servicioMantenimientos: ServiciosMantenimientos,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.rol = servicioLocalStorage.obtenerRol()
    this.preCarga();
  }

  ngOnInit(): void {
    this.listarRegistrosAutorizacion();
  }

  preCarga() {  // Función para obtener el usuario autenticado
    if (this.rol?.id === 1) this.isSupervisor = true, this.volverBtn = true;
    this.route.queryParams.subscribe(params => {
      if (params['usuario']) {
        this.usuario = JSON.parse(params['usuario']);
        console.log(this.usuario);
      } else {
        this.usuario = this.servicioLocalStorage.obtenerUsuario();
        if (this.rol?.id === 1) this.router.navigate(['administrar/listado-usuarios'], { queryParams: { usuario: this.usuario, tipoRuta: 4 } });
      }
    });
    //console.log(this.isSupervisor);
  }

  listarRegistrosAutorizacion() {
    this.listarRegistros = []
    this.servicioMantenimientos.listarRegistros(4, this.usuario?.usuario, this.rol?.id).subscribe({
      next: (respuesta: any) => {
        this.listarRegistros = respuesta.map((registro: any) => ({
          ...registro,
          //fechaDiligenciamiento: registro.fechaDiligenciamiento ? this.formatearFechaUTC(registro.fechaDiligenciamiento) : "-",
        }))
        this.listarRegistrosFiltrados = this.listarRegistros
      }
    })
  }

  filtrarRegistros() {
    this.pagePrevent = 1;
    const lowerSearchText = this.filteredID.toLowerCase();
    const camposExcluidos = [
      'id'
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

  limpiar() {
    this.filteredID = ''
    this.listarRegistrosFiltrados = []
    this.listarRegistrosAutorizacion();
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
      this.router.navigate(['/administrar/autorizacion-historial'], { state: { info: info } });
      return
    } else {
      const info = {
        registro: registro,
        placa: registro.placa,
        editar: editar,
        estadoMantenimiento: true,
        vigiladoId: this.usuario?.usuario
      }
      this.router.navigate(['/administrar/autorizacion-registro'], { state: { info } });
    }
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

  volver() {
    this.router.navigate(['/administrar/autorizacion']);
  }

}
