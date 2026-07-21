import { Component, OnInit, ViewChild } from '@angular/core';
import { ServicioLocalStorage } from 'src/app/administrador/servicios/local-storage.service';
import { Usuario } from 'src/app/autenticacion/modelos/IniciarSesionRespuesta';
import { RegistroMantenimiento } from 'src/app/mantenimientos/modelos/RegistroMantenimiento';
import { ServiciosMantenimientos } from 'src/app/mantenimientos/servicios/mantenimientos.service';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { ModalRegistroCorrectivoComponent } from '../modal-registro/modal-registro.component';
import { ModalHistorialCorrectivoComponent } from '../modal-historial/modal-historial.component';
import { ActivatedRoute, Router } from '@angular/router';
import { Rol } from 'src/app/autenticacion/modelos/Rol';

@Component({
  selector: 'app-formulario',
  templateUrl: './formulario.component.html',
  styleUrls: ['./formulario.component.css']
})
export class FormularioCorrectivoComponent implements OnInit {
  usuario: Usuario | null = null; // Para almacenar el usuario autenticado

  filteredID: string = ''; // Para almacenar el texto buscado
  filteredDate: string = ''; // Para almacenar la fecha seleccionada (formato yyyy-MM-dd)

  listaResgitros: Array<RegistroMantenimiento> = [];
  listaResgitrosFiltrados: Array<RegistroMantenimiento> = [];

  itemsPerPageReg: number = 5;
  pageReg: number = 1;

  verificador: boolean = false // Para verificar si hay programa de mantenimiento cargado.

  rol: Rol | null
  volverBtn: boolean = false
  isSupervisor: boolean = false

  @ViewChild('modalRegistroCorrectivo') modalRegistro!: ModalRegistroCorrectivoComponent;
  @ViewChild('modalHistorialCorrectivo') modalHistorial!: ModalHistorialCorrectivoComponent;
  @ViewChild('popup') popup!: PopupComponent;

  constructor(
    private servicioLocalStorage: ServicioLocalStorage,
    private servicioMantenimientos: ServiciosMantenimientos,
    private route: ActivatedRoute, // Inyección del ActivatedRoute
    private router: Router // Inyección del Router
  ) {
    /* this.usuario = this.servicioLocalStorage.obtenerUsuario(); */
    this.rol = servicioLocalStorage.obtenerRol()
    this.preCarga();
  }

  ngOnInit(): void {
    this.listarRegistros();
  }

  preCarga() {  // Función para obtener el usuario autenticado
    if (this.rol?.id === 1) this.isSupervisor = true, this.volverBtn = true;
    this.route.queryParams.subscribe(params => {
      if (params['usuario']) {
        this.usuario = JSON.parse(params['usuario']);
        console.log(this.usuario);
      } else {
        this.usuario = this.servicioLocalStorage.obtenerUsuario();
        if (this.rol?.id === 1) this.router.navigate(['administrar/listado-usuarios'], { queryParams: { usuario: this.usuario, tipoRuta: 2 } });
      }
    });
    //console.log(this.isSupervisor);
  }

  listarRegistros() {
    this.listaResgitros = [];
    this.servicioMantenimientos.listarRegistros(2, this.usuario?.usuario).subscribe({
      next: (respuesta: any) => {
        console.log(respuesta);
        this.listaResgitros = respuesta;
        this.filtrarRutas();
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
      } // Manejar errores
    });
  }

  filtrarRutas() {
    const lowerSearchText = this.filteredID.toLowerCase();
    const camposExcluidos = [
      'tipoId',
    ]; // Reemplaza con los nombres de los campos a excluir
    this.listaResgitrosFiltrados = this.listaResgitros.map(ruta => {
      // Crear una copia del objeto excluyendo los campos no deseados, pero manteniendo el campo original
      const rutaFiltrada: any = { ...ruta };
      Object.entries(ruta).forEach(([key, value]) => {
        if (!camposExcluidos.includes(key)) {
          // Si el campo parece una fecha, agregamos un campo auxiliar para el filtro
          if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
            const date = new Date(value);
            rutaFiltrada[key + '_filtrado'] = date.toLocaleDateString('es-ES');
            rutaFiltrada[key + '_raw'] = value;
          }
        }
      });
      return rutaFiltrada;
    }).filter(ruta => {
      // Filtrado por texto (incluye campos auxiliares)
      const matchText = Object.values(ruta).some(value => {
        const valorCampo = value !== null && value !== undefined ? value.toString().toLowerCase() : '';
        return lowerSearchText === '' || valorCampo.includes(lowerSearchText);
      });

      // Filtrado por fecha
      let matchDate = true;
      if (this.filteredDate) {
        // Buscar campo de fecha en el registro
        const fechaRaw = ruta['fechaDiligenciamiento_raw'];
        if (fechaRaw) {
          // Extraer yyyy-MM-dd de la fecha
          const fechaSolo = fechaRaw.substring(0, 10);
          matchDate = fechaSolo === this.filteredDate;
        } else {
          matchDate = false;
        }
      }
      return matchText && matchDate;
    });

    console.log(this.listaResgitrosFiltrados);
  }

  limpiar() {
    this.filteredID = '';
    this.filteredDate = '';
    this.listaResgitrosFiltrados = [];
    this.listarRegistros();
  }

  abrirModalRegistro(registro: RegistroMantenimiento, editar: boolean) {
    if (this.modalRegistro) {
      this.modalRegistro.registro = registro;
      this.modalRegistro.editar = editar;
      this.modalRegistro.vigiladoId = this.usuario?.usuario;
      this.modalRegistro.isSupervisor = this.isSupervisor;
      this.modalRegistro.abrir();
    } else {
      console.error('modalRegistro is not initialized');
    }
  }

  abrirModalHistorial(registro: RegistroMantenimiento) {
    if (this.modalHistorial) {
      this.modalHistorial.registro = registro;
      this.modalHistorial.vigiladoId = this.usuario?.usuario;
      this.modalHistorial.isSupervisor = this.isSupervisor;
      this.modalHistorial.abrirModal();
    } else {
      console.error('modalRegistro is not initialized');
    }
  }

  onRegistroGuardado(success: boolean) {
    if (success) {
      this.listarRegistros();
    } else {
      console.error('Error al guardar el registro.');
    }
  }

  volver() {
    this.router.navigate(['/administrar/formulario-correctivo']);
  }
}
