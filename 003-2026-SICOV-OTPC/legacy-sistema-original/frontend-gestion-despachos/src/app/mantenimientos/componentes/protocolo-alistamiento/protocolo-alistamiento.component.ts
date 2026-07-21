import { Component, OnInit, ViewChild } from '@angular/core';
import { ServicioLocalStorage } from 'src/app/administrador/servicios/local-storage.service';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { Usuario } from 'src/app/autenticacion/modelos/IniciarSesionRespuesta';
import Swal from 'sweetalert2';
import { ServiciosMantenimientos } from '../../servicios/mantenimientos.service';
import { ServicioArchivos } from 'src/app/archivos/servicios/archivos.service';
import { Documento } from '../../modelos/Documento';
import { ActivatedRoute, Router } from '@angular/router';
import { Rol } from 'src/app/autenticacion/modelos/Rol';
@Component({
  selector: 'app-protocolo-alistamiento',
  templateUrl: './protocolo-alistamiento.component.html',
  styleUrls: ['./protocolo-alistamiento.component.css']
})

export class ProtocoloAlistamientoComponent implements OnInit {
  @ViewChild('popup') popup!: PopupComponent
  usuario: Usuario | null = null;
  rol: Rol | null

  archivoProtocolo: File | null = null;
  excedeTamanio: boolean = false;
  tipoIncorrecto: boolean = false;
  listaDocumentos: Array<Documento> = []
  megasMaximas: number = 4;// 5 MB
  pagePrevent: number = 1
  itemsPerPagePrevent: number = 5

  volverBtn: boolean = false
  isSupervisor: boolean = false

  constructor(private servicioLocalStorage: ServicioLocalStorage,
    private servicioMantenimientos: ServiciosMantenimientos,
    private servicioArchivos: ServicioArchivos,
    private route: ActivatedRoute, // Inyección del ActivatedRoute
    private router: Router) {
    this.rol = servicioLocalStorage.obtenerRol()
    this.preCarga();
  }

  ngOnInit() {
    this.listarDocumentos(3)
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

  listarDocumentos(tipoId: any) {
    this.servicioMantenimientos.listarDocumentos(tipoId, this.usuario?.usuario).subscribe({
      next: (respuesta: any) => {
        console.log(respuesta)
        this.listaDocumentos = respuesta.map((documento: any) => ({
          ...documento,
          //fecha: documento.fecha ? this.formatearFechaUTC(documento.fecha) : '-',
        }))
      }
    })
  }

  setArchivo(archivo: File | null, emitir: boolean = true) {
    this.archivoProtocolo = archivo
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
          this.servicioMantenimientos.guardarArchivo(3, respuesta.nombreAlmacenado, respuesta.nombreOriginalArchivo, respuesta.ruta, this.usuario?.usuario).subscribe({
            next: (respuesta2: any) => {
              Swal.fire({
                icon: 'success',
                title: 'Archivo cargado correctamente',
                showConfirmButton: false,
                timer: 1500
              });
              this.archivoProtocolo = null
              this.listarDocumentos(respuesta2.tipo_id)
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

  manejarCambioArchivo(archivo: File | null) {
    if (this.excedeTamanio || this.tipoIncorrecto) {
      return;
    }
    this.setArchivo(archivo)
  }

  manejarExcedeTamanio() {
    Swal.fire({
      icon: 'warning',
      title: 'El archivo pesa más de ' + this.megasMaximas + ' Mb',
    });
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

  manejarTipoIncorrecto() {
    Swal.fire({
      icon: 'warning',
      title: 'El tipo de archivo seleccionado es incorrecto',
    });
  }

  volver() {
    this.router.navigate(['/administrar/protocolo-alistamiento']);
  }
}
