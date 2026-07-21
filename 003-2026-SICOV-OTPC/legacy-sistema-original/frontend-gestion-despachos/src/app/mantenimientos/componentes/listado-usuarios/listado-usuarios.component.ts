import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ServicioLocalStorage } from 'src/app/administrador/servicios/local-storage.service';
import { Usuario } from 'src/app/autenticacion/modelos/IniciarSesionRespuesta';
// importaciones de terminales removidas porque el módulo/servicio ya no existe en el workspace
interface Vigilado { [key: string]: any; }
// Placeholder para el servicio eliminado; evitar error de DI
class TerminalesService {
  listarVigilados() { return { subscribe: (_: any, __?: any) => {} }; }
}

@Component({
  selector: 'app-listado-usuarios',
  templateUrl: './listado-usuarios.component.html',
  styleUrls: ['./listado-usuarios.component.css']
})
export class ListadoUsuariosComponent {
  filteredID: string = ''; // Para almacenar el ID buscado
    vigilados: Vigilado[] = []; // Para almacenar los vigilados
    vigiladosMostrados: Vigilado[] = []; // Para almacenar los vigilados mostrados
    loading: boolean = false; // Para controlar el estado de carga
    usuario: Usuario | null = null; // Para almacenar el usuario autenticado

    pageRutas: number = 1; // Variable para controlar la página actual
    itemsPerPage: number = 5; // Variable para controlar la cantidad de registros mostrados por página
    sortDirection: 'asc' | 'desc' | '' = ''; // Para almacenar la dirección de ordenamiento
    sortField: string = ''; // Para almacenar el campo de ordenamiento

    tipoRuta: number = 0; // Para almacenar el tipo de usuario
    nombreModulo: string = ''; // Para almacenar el nombre del módulo

    private servicioTerminales: TerminalesService = new TerminalesService();

    constructor(
      // Servicio original eliminado del módulo, se usa placeholder local
      private servicioLocalStorage: ServicioLocalStorage, // Inyección del servicio de local storage
      private router: Router, // Inyección del Router
      private route: ActivatedRoute, // Inyección del ActivatedRoute
    ) {
      this.usuario = servicioLocalStorage.obtenerUsuario(); // Obtener el usuario autenticado
      this.route.queryParams.subscribe(params => {
        console.log(params);
        if (params['usuario']) {
          this.tipoRuta = Number(params['tipoRuta']); // Obtener el tipo de usuario desde los parámetros de la ruta
          if (this.tipoRuta === 1) {
            this.nombreModulo = 'Mantenimientos Preventivos'; // Asignar el nombre del módulo
          } else if (this.tipoRuta === 2) {
            this.nombreModulo = 'Mantenimientos Correctivos'; // Asignar el nombre del módulo
          } else if (this.tipoRuta === 3) {
            this.nombreModulo = 'Protocolos de Alistamiento'; // Asignar el nombre del módulo
          } else if (this.tipoRuta === 4) {
            this.nombreModulo = 'Autorizaciones'; // Asignar el nombre del módulo
          }
          this.usuario = params['usuario']; // Obtener el usuario desde los parámetros de la ruta
        } else {
          this.usuario = this.servicioLocalStorage.obtenerUsuario(); // Obtener el usuario desde el local storage
        }
      })
    }

    ngOnInit(): void {
      this.listadoVigilados(); // Llamado al método para listar los vigilados
    }

    listadoVigilados() {  // Método para listar los vigilados
      this.loading = true; // Iniciar el estado de carga
      this.servicioTerminales.listarVigilados().subscribe((vigilados: any) => {
        this.vigilados = vigilados.usuarios;
        this.filtrarVigilados();
        this.loading = false; // Finalizar el estado de carga
      }, (error: unknown) => {
        console.error('Error al listar vigilados', error);
        this.loading = false; // Finalizar el estado de carga en caso de error
      });
    }

    redirigir(vigilado: any,tipoRuta?: number, tipo?: number) { // Método para consultar las rutas de un vigilado
      const usuario: Usuario = {
        id: vigilado.id,
        nombre: vigilado.razon_social,
        correo: vigilado.correo,
        telefono: '',
        usuario: vigilado.nit,
        apellido: '',
        idEmpresa: '',
        logoEmpresa: '',
        abrirModal: false,
        departamentoId: 0,
        municipioId: 0,
        esDepartamental: 0,
        nombreCiudad: '',
        nombreDepartamento: '',
        reportaOtroMunicipio: false
      };
      /* console.log(usuario, tipoRuta, tipo); */
      if (tipoRuta === 1) {
        if (tipo === 1) {
          this.router.navigate(['/administrar/mantenimientos-preventivos'], { queryParams: { usuario: JSON.stringify(usuario), tipo: tipo } });
        }
        else if (tipo === 2) {
          this.router.navigate(['/administrar/formulario-preventivo'], { queryParams: { usuario: JSON.stringify(usuario), tipo: tipoRuta } });
        }
      } else if (tipoRuta === 2) {
        if (tipo === 1) {
          this.router.navigate(['/administrar/mantenimientos-correctivos'], { queryParams: { usuario: JSON.stringify(usuario), tipo: tipo } });
        }
        else if (tipo === 2) {
          this.router.navigate(['/administrar/formulario-correctivo'], { queryParams: { usuario: JSON.stringify(usuario), tipo: tipoRuta } });
        }
      } else if (tipoRuta === 3) {
        if (tipo === 1) {
          this.router.navigate(['/administrar/protocolo-alistamiento'], { queryParams: { usuario: JSON.stringify(usuario), tipo: tipo } });
        }
        else if (tipo === 2) {
          this.router.navigate(['/administrar/formulario-alistamiento'], { queryParams: { usuario: JSON.stringify(usuario), tipo: tipoRuta } });
        }
      } else if (tipoRuta === 4) {
        this.router.navigate(['/administrar/autorizacion'], { queryParams: { usuario: JSON.stringify(usuario), tipo: tipo } });
      }
    }

    filtrarVigilados(){ // Método para filtrar los vigilados
      if (!Array.isArray(this.vigilados)) {
        console.error('vigilados is not an array');
        return;
      }
      const lowerSearchText = this.filteredID.toLowerCase();
      const camposExcluidos = [
        '', // Excluye el campo ID
      ]; // Reemplaza con los nombres de los campos a excluir
      //console.log('Filtrando...', lowerSearchText)
      this.vigiladosMostrados = this.vigilados.map(vigilado => {
        // Crear una copia del objeto excluyendo los campos no deseados
        const rutaFiltrada = Object.entries(vigilado).reduce((obj, [key, value]) => {
          if (!camposExcluidos.includes(key)) {
            obj[key] = value;
          }
          return obj;
        }, {} as any);
        return rutaFiltrada;
      }).filter(vigilado =>
        Object.values(vigilado).some(value => {
          const valorCampo = value !== null && value !== undefined ? value.toString().toLowerCase() : '';
          return valorCampo.includes(lowerSearchText);
        })
      );
      this.sortByField(); // Ordenar los vigilados por el campo seleccionado
      this.pageRutas = 1; // Reset pagination to the first page
      //console.log(this.vigilados, this.vigiladosMostrados);
    }

    limpiar() { // Método para limpiar el campo de búsqueda
      this.filteredID = '';
      this.vigiladosMostrados = this.vigilados;
      this.sortField = ''; // Resetear el campo de ordenamiento
      this.sortDirection = ''; // Resetear la dirección de ordenamiento
    }

    sortByState() { // Método para ordenar los vigilados por estado
      this.vigiladosMostrados.sort((a, b) => {
        const estadoA = String(a['estado'] ?? '').toLowerCase();
        const estadoB = String(b['estado'] ?? '').toLowerCase();
        if (estadoA < estadoB) {
          return this.sortDirection === 'asc' ? -1 : 1;
        }
        if (estadoA > estadoB) {
          return this.sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      });
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'; // Alternar la dirección de ordenamiento
    }

    sortByField() { // Método para ordenar los vigilados por el campo seleccionado
      if (this.sortDirection === '') return; // No ordenar si la dirección es vacía
      this.vigiladosMostrados.sort((a, b) => {
        const fieldA = a[this.sortField]?.toString().toLowerCase() || '';
        const fieldB = b[this.sortField]?.toString().toLowerCase() || '';
        if (fieldA < fieldB) {
          return this.sortDirection === 'asc' ? -1 : 1;
        }
        if (fieldA > fieldB) {
          return this.sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    sortBy(field: string) { // Método para establecer el campo de ordenamiento
      if (this.sortField === field) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : (this.sortDirection === 'desc' ? '' : 'asc');
      } else {
        this.sortField = field;
        this.sortDirection = 'asc';
      }
      this.sortByField();
    }
}
