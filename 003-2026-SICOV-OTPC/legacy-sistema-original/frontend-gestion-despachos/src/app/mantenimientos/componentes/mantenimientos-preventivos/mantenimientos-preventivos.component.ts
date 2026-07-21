import { Component, OnInit, ViewChild } from '@angular/core';
import { ServicioLocalStorage } from 'src/app/administrador/servicios/local-storage.service';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { Usuario } from 'src/app/autenticacion/modelos/IniciarSesionRespuesta';
import { ServiciosMantenimientos } from '../../servicios/mantenimientos.service';
import { ServicioArchivos } from 'src/app/archivos/servicios/archivos.service';
import Swal from 'sweetalert2';
import { Documento } from '../../modelos/Documento';
import { Rol } from 'src/app/autenticacion/modelos/Rol';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-mantenimientos-preventivos',
  templateUrl: './mantenimientos-preventivos.component.html',
  styleUrls: ['./mantenimientos-preventivos.component.css']
})
export class MantenimientosPreventivosComponent implements OnInit {
  @ViewChild('popup') popup!: PopupComponent
  usuario: Usuario | null = null; // Para almacenar el usuario autenticado
  rol: Rol | null

  listaDocumentos: Array<Documento> = []

  mantenimientoPreventivo: File | null = null;
  exedeTamano: boolean = false
  tipoIncorrecto: boolean = false

  pagePrevent: number = 1
  itemsPerPagePrevent: number = 5

  megasMaximas: number = 4;

  volverBtn: boolean = false
  isSupervisor: boolean = false

  constructor(
    private servicioLocalStorage: ServicioLocalStorage,
    private servicioMantenimientos: ServiciosMantenimientos,
    private servicioArchivos: ServicioArchivos,
    private route: ActivatedRoute, // Inyección del ActivatedRoute
    private router: Router // Inyección del Router
  ) {
    /* this.usuario = this.servicioLocalStorage.obtenerUsuario(); */
    this.rol = servicioLocalStorage.obtenerRol()
    this.preCarga();
  }

  ngOnInit() {
    this.listarDocumentos(1)
  }

  preCarga() {  // Función para obtener el usuario autenticado
    if (this.rol?.id === 1) this.isSupervisor = true, this.volverBtn = true;
    this.route.queryParams.subscribe(params => {
      if (params['usuario']) {
        this.usuario = JSON.parse(params['usuario']);
        console.log(this.usuario);
      } else {
        this.usuario = this.servicioLocalStorage.obtenerUsuario();
        if (this.rol?.id === 1) this.router.navigate(['administrar/listado-usuarios'], { queryParams: { usuario: this.usuario, tipoRuta: 1 } });
      }
    });
    //console.log(this.isSupervisor);
  }

  manejarCambioArchivo(archivo: File | null) {
    if (this.exedeTamano) { return; }
    if (this.tipoIncorrecto) { return; }
    this.setArchivo(archivo)
  }

  setArchivo(archivo: File | null, emitir: boolean = true) {
    this.mantenimientoPreventivo = archivo
    if (archivo) {
      Swal.fire({
        title: 'Cargando archivo...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading(null)
        }
      });
      this.servicioArchivos.guardarArchivo(archivo, 'sicov', this.usuario?.usuario!).subscribe({
        next: (respuesta) => {
          console.log('1', respuesta)
          this.servicioMantenimientos.guardarArchivo(1, respuesta.nombreAlmacenado, respuesta.nombreOriginalArchivo, respuesta.ruta, this.usuario?.usuario).subscribe({
            next: (respuesta2: any) => {
              console.log(respuesta2)
              Swal.fire({
                icon: 'success',
                title: 'Archivo cargado correctamente',
                showConfirmButton: false,
                timer: 1500
              });
              this.mantenimientoPreventivo = null
              this.listarDocumentos(respuesta2.tipo_id)
            },
            error: (error: any) => {
              console.error('Error al guardar el archivo', error)
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al guardar el archivo'
              });
            }
          })
        }
      })
    }
  }

  descargarArchivo(documento: Documento) {
    if (documento.documento && documento.ruta && documento.nombreOriginal) {
      this.servicioArchivos.descargarArchivo(documento.documento, documento.ruta, documento.nombreOriginal)
    }
  }

  listarDocumentos(tipoId: any) {
    this.servicioMantenimientos.listarDocumentos(tipoId, this.usuario?.usuario).subscribe({
      next: (respuesta: any) => {
        console.log(respuesta)
        this.listaDocumentos = respuesta
      }
    })
  }

  manejarExcedeTamanio() {
    Swal.fire({
      icon: 'warning',
      title: 'El archivo pesa más de ' + this.megasMaximas + 'Mb',
    });
  }
  manejarTipoIncorrecto() {
    Swal.fire({
      icon: 'warning',
      title: 'El tipo de archivo seleccionado es incorrecto',
    });
  }

  volver() {
    this.router.navigate(['/administrar/mantenimientos-preventivos']);
  }
}
