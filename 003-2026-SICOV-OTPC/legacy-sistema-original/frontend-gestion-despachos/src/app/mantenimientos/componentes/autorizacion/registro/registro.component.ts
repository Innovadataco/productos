import { query } from '@angular/animations';
import { Component, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { PopupComponent } from 'src/app/alertas/componentes/popup/popup.component';
import { ServicioArchivos } from 'src/app/archivos/servicios/archivos.service';
import { Documento } from 'src/app/mantenimientos/modelos/Documento';
import { Autorizacion, RegistroAutorizacion } from 'src/app/mantenimientos/modelos/RegistroAutorizacion';
import { ServiciosMantenimientos } from 'src/app/mantenimientos/servicios/mantenimientos.service';
import { discapacidades, etnias, generos, parentescos, sexos, tiposIdentificaciones, ubicaciones } from 'src/app/parametricas/modelos/Parametricas';
import { ParametricasService } from 'src/app/parametricas/servicios/parametricas.service';
import { validacionNombre } from 'src/shared/validadores/validacion-nombre';
import { validacionNumero, SoloLetrasyNumeros } from 'src/shared/validadores/validacion-numero';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css']
})
export class RegistroAutorizacionComponent implements OnInit {
  @ViewChild('popup') popup!: PopupComponent
  registro: RegistroAutorizacion = {};
  editar: boolean = false;
  vigiladoId: any;
  minDate: string;
  tamanoMaximo: number = 15;

  AutorizacionViaje: File | null = null;
  DocumentoParentesco: File | null = null;
  DocumentoIdentidadAutorizado: File | null = null;
  ConstanciaEntrega: File | null = null;

  excedeTamanio: boolean = false;
  tipoIncorrecto: boolean = false;
  megasMaximas: number = 4;// 5 MB
  placa: string;
  estadoMantenimiento = true;
  isSupervisor: boolean = false;
  Usuario: any

  tiposIdentificaciones: tiposIdentificaciones[] = [];
  tiposIdentificacionesMenoresEdad: tiposIdentificaciones[] = [];
  ubicacionesOrigen: ubicaciones[] = [];
  ubicacionesDestino: ubicaciones[] = [];
  discapacidades: discapacidades[] = [];
  etnias: etnias[] = [];
  sexos: sexos[] = [];
  generos: generos[] = [];
  parentescos: parentescos[] = [];

  autorizacion: Autorizacion = {
    fechaViaje: undefined,
    origen: '',
    destino: '',
    tipoIdentificacionNna: '',
    numeroIdentificacionNna: undefined,
    nombresApellidosNna: '',
    situacionDiscapacidad: '',
    tipoDiscapacidad: '',
    perteneceComunidadEtnica: '',
    tipoPoblacionEtnica: '',
    tipoIdentificacionOtorgante: '',
    numeroIdentificacionOtorgante: undefined,
    nombresApellidosOtorgante: '',
    numeroTelefonicoOtorgante: undefined,
    correoElectronicoOtorgante: '',
    direccionFisicaOtorgante: '',
    sexoOtorgante: '',
    generoOtorgante: '',
    calidadActua: '',
    tipoIdentificacionAutorizadoViajar: '',
    numeroIdentificacionAutorizadoViajar: undefined,
    nombresApellidosAutorizadoViajar: '',
    numeroTelefonicoAutorizadoViajar: undefined,
    direccionFisicaAutorizadoViajar: '',
    tipoIdentificacionAutorizadoRecoger: '',
    numeroIdentificacionAutorizadoRecoger: undefined,
    nombresApellidosAutorizadoRecoger: '',
    numeroTelefonicoAutorizadoRecoger: undefined,
    direccionFisicaAutorizadoRecoger: '',
    copiaAutorizacionViajeNombreOriginal: '',
    copiaAutorizacionViajeDocumento: '',
    copiaAutorizacionViajeRuta: '',
    copiaDocumentoParentescoNombreOriginal: '',
    copiaDocumentoParentescoDocumento: '',
    copiaDocumentoParentescoRuta: '',
    copiaDocumentoIdentidadAutorizadoNombreOriginal: '',
    copiaDocumentoIdentidadAutorizadoDocumento: '',
    copiaDocumentoIdentidadAutorizadoRuta: '',
    copiaConstanciaEntregaNombreOriginal: '',
    copiaConstanciaEntregaDocumento: '',
    copiaConstanciaEntregaRuta: '',
    mantenimientoId: undefined,
  }

  departamentos: any[] = [];
  departamentoOrigen: any;
  departamentoDestino: any;

  municipiosOrigen: any[] = [];
  municipiosDestino: any[] = [];
  municipioOrigen: any;
  municipioDestino: any;

  constructor(
    private router: Router,
    private servicioMantenimientos: ServiciosMantenimientos,
    private servcioParametricas: ParametricasService,
    private servicioArchivos: ServicioArchivos
  ) {
    this.vigiladoId = history.state.info.vigiladoId
    this.registro = history.state.info.registro;//Ids necesarios para la consulta de la ruta.
    this.editar = history.state.info.editar;
    this.placa = history.state.info.placa;
    this.estadoMantenimiento = history.state.info.estadoMantenimiento;
    this.isSupervisor = history.state.info.isSupervisor;
    this.Usuario = history.state.info.usuario;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Mes en formato 2 dígitos
    const day = String(today.getDate()).padStart(2, '0'); // Día en formato 2 dígitos

    this.minDate = `${year}-${month}-${day}`;
  }

  ngOnInit(): void {
    this.listarDepartamentos();
    this.listarTipoIdentificaciones();
    this.listarTipoIdentificacionesMenoresEdad();
    this.listardiscapacidades();
    this.listaretnias();
    this.listarsexos();
    this.listargeneros();
    this.listarparentescos();
    if (this.editar) {
      this.obtenerRegistro(this.registro.mantenimiento_id!);
    } else {
      this.autorizacion = {
        fechaViaje: undefined,
        origen: '',
        destino: '',
        tipoIdentificacionNna: '',
        numeroIdentificacionNna: undefined,
        nombresApellidosNna: '',
        situacionDiscapacidad: '',
        tipoDiscapacidad: '',
        perteneceComunidadEtnica: '',
        tipoPoblacionEtnica: '',
        tipoIdentificacionOtorgante: '',
        numeroIdentificacionOtorgante: undefined,
        nombresApellidosOtorgante: '',
        numeroTelefonicoOtorgante: undefined,
        correoElectronicoOtorgante: '',
        direccionFisicaOtorgante: '',
        sexoOtorgante: '',
        generoOtorgante: '',
        calidadActua: '',
        tipoIdentificacionAutorizadoViajar: '',
        numeroIdentificacionAutorizadoViajar: undefined,
        nombresApellidosAutorizadoViajar: '',
        numeroTelefonicoAutorizadoViajar: undefined,
        direccionFisicaAutorizadoViajar: '',
        tipoIdentificacionAutorizadoRecoger: '',
        numeroIdentificacionAutorizadoRecoger: undefined,
        nombresApellidosAutorizadoRecoger: '',
        numeroTelefonicoAutorizadoRecoger: undefined,
        direccionFisicaAutorizadoRecoger: '',
        copiaAutorizacionViajeNombreOriginal: '',
        copiaAutorizacionViajeDocumento: '',
        copiaAutorizacionViajeRuta: '',
        copiaDocumentoParentescoNombreOriginal: '',
        copiaDocumentoParentescoDocumento: '',
        copiaDocumentoParentescoRuta: '',
        copiaDocumentoIdentidadAutorizadoNombreOriginal: '',
        copiaDocumentoIdentidadAutorizadoDocumento: '',
        copiaDocumentoIdentidadAutorizadoRuta: '',
        copiaConstanciaEntregaNombreOriginal: '',
        copiaConstanciaEntregaDocumento: '',
        copiaConstanciaEntregaRuta: '',
        mantenimientoId: undefined,
      };
    }
  }

  listarDepartamentos() {
    this.servcioParametricas.obtenerParametrica('listar-departamentos').subscribe(
      (response: any) => {
        this.departamentos = response;
      },
      (error: any) => {
        console.error('Error obteniendo departamentos', error);
      }
    );
  }

  listarMunicipios(departamentoId: any, tipo?: string) {
    this.servcioParametricas.obtenerParametrica(`listar-municipios?codigoDepartamento=${departamentoId}`).subscribe(
      (response: any) => {
        if (tipo === 'origen') {
          this.municipiosOrigen = response;
        } else if (tipo === 'destino') {
          this.municipiosDestino = response;
        }
      },
      (error: any) => {
        console.error('Error obteniendo municipios', error);
      }
    );
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

  listarTipoIdentificacionesMenoresEdad() {
    this.servcioParametricas.obtenerParametrica('listar-tipo-identificaciones').subscribe(
      (response: any) => {
        const codigosExcluidos = [1,2,4];
        this.tiposIdentificacionesMenoresEdad = response.filter(
          (tipo: tiposIdentificaciones) => !codigosExcluidos.includes(Number(tipo.codigo))
        );
        console.log(this.tiposIdentificacionesMenoresEdad);

      },
      (error: any) => {
        console.error('Error obteniendo tipo de identificaciones', error);
      }
    );
  }

  filtrarIdentificaciones() {
    const codigosExcluidos = [1, 2, 4];
    this.tiposIdentificacionesMenoresEdad = this.tiposIdentificacionesMenoresEdad.filter(
      tipo => !codigosExcluidos.includes(Number(tipo.codigo))
    );
  }

  listarUbicaciones(municipioId?: any, tipo?: string, editar?: boolean, codigo?: any) {
    if (editar) {
      this.servcioParametricas.obtenerParametrica(`listar-centros-poblados?codigo=${codigo}`).subscribe(
        (response: any) => {
          if (tipo === 'origen') {
            this.ubicacionesOrigen = response;
          } else if (tipo === 'destino') {
            this.ubicacionesDestino = response;
          }
        },
        (error: any) => {
          console.error('Error obteniendo tipo de identificaciones', error);
        }
      );
    } else {
      this.servcioParametricas.obtenerParametrica(`listar-centros-poblados?codigoMunicipio=${municipioId}`).subscribe(
        (response: any) => {
          if (tipo === 'origen') {
            this.ubicacionesOrigen = response;
          } else if (tipo === 'destino') {
            this.ubicacionesDestino = response;
          }
        },
        (error: any) => {
          console.error('Error obteniendo tipo de identificaciones', error);
        }
      );
    }
  }

  listardiscapacidades() {
    this.servcioParametricas.obtenerParametrica('listar-tipo-discapacidades').subscribe(
      (response: any) => {
        this.discapacidades = response;
      },
      (error: any) => {
        console.error('Error obteniendo tipo de identificaciones', error);
      }
    );
  }

  listaretnias() {
    this.servcioParametricas.obtenerParametrica('listar-tipo-poblaciones-etnicas').subscribe(
      (response: any) => {
        this.etnias = response;
      },
      (error: any) => {
        console.error('Error obteniendo tipo de identificaciones', error);
      }
    );
  }

  listarsexos() {
    this.servcioParametricas.obtenerParametrica('listar-tipo-sexos').subscribe(
      (response: any) => {
        this.sexos = response;
      },
      (error: any) => {
        console.error('Error obteniendo tipo de identificaciones', error);
      }
    );
  }

  listargeneros() {
    this.servcioParametricas.obtenerParametrica('listar-tipo-generos').subscribe(
      (response: any) => {
        this.generos = response;
      },
      (error: any) => {
        console.error('Error obteniendo tipo de identificaciones', error);
      }
    );
  }

  listarparentescos() {
    this.servcioParametricas.obtenerParametrica('listar-tipo-parentescos').subscribe(
      (response: any) => {
        this.parentescos = response;
      },
      (error: any) => {
        console.error('Error obteniendo tipo de identificaciones', error);
      }
    );
  }

  obtenerRegistro(id: string) {
    this.servicioMantenimientos.visualizarAutorizacion(id).subscribe(
      (response: any) => {
        this.autorizacion = {
          fechaViaje: new Date(response.fecha_viaje).toISOString().split('T')[0],
          origen: response.origen,
          destino: response.destino,
          tipoIdentificacionNna: response.tipo_identificacion_nna,
          numeroIdentificacionNna: response.numero_identificacion_nna,
          nombresApellidosNna: response.nombres_apellidos_nna,
          situacionDiscapacidad: response.situacion_discapacidad,
          tipoDiscapacidad: response.tipo_discapacidad,
          perteneceComunidadEtnica: response.pertenece_comunidad_etnica,
          tipoPoblacionEtnica: response.tipo_poblacion_etnica,
          tipoIdentificacionOtorgante: response.tipo_identificacion_otorgante,
          numeroIdentificacionOtorgante: response.numero_identificacion_otorgante,
          nombresApellidosOtorgante: response.nombres_apellidos_otorgante,
          numeroTelefonicoOtorgante: response.numero_telefonico_otorgante,
          correoElectronicoOtorgante: response.correo_electronico_otorgante,
          direccionFisicaOtorgante: response.direccion_fisica_otorgante,
          sexoOtorgante: response.sexo_otorgante,
          generoOtorgante: response.genero_otorgante,
          calidadActua: response.calidad_actua,
          tipoIdentificacionAutorizadoViajar: response.tipo_identificacion_autorizado_viajar,
          numeroIdentificacionAutorizadoViajar: response.numero_identificacion_autorizado_viajar,
          nombresApellidosAutorizadoViajar: response.nombres_apellidos_autorizado_viajar,
          numeroTelefonicoAutorizadoViajar: response.numero_telefonico_autorizado_viajar,
          direccionFisicaAutorizadoViajar: response.direccion_fisica_autorizado_viajar,
          tipoIdentificacionAutorizadoRecoger: response.tipo_identificacion_autorizado_recoger,
          numeroIdentificacionAutorizadoRecoger: response.numero_identificacion_autorizado_recoger,
          nombresApellidosAutorizadoRecoger: response.nombres_apellidos_autorizado_recoger,
          numeroTelefonicoAutorizadoRecoger: response.numero_telefonico_autorizado_recoger,
          direccionFisicaAutorizadoRecoger: response.direccion_fisica_autorizado_recoger,
          copiaAutorizacionViajeNombreOriginal: response.copia_autorizacion_viaje_nombre_original,
          copiaAutorizacionViajeDocumento: response.copia_autorizacion_viaje_documento,
          copiaAutorizacionViajeRuta: response.copia_autorizacion_viaje_ruta,
          copiaDocumentoParentescoNombreOriginal: response.copia_documento_parentesco_nombre_original,
          copiaDocumentoParentescoDocumento: response.copia_documento_parentesco_documento,
          copiaDocumentoParentescoRuta: response.copia_documento_parentesco_ruta,
          copiaDocumentoIdentidadAutorizadoNombreOriginal: response.copia_documento_identidad_autorizado_nombre_original,
          copiaDocumentoIdentidadAutorizadoDocumento: response.copia_documento_identidad_autorizado_documento,
          copiaDocumentoIdentidadAutorizadoRuta: response.copia_documento_identidad_autorizado_ruta,
          copiaConstanciaEntregaNombreOriginal: response.copia_constancia_entrega_nombre_original,
          copiaConstanciaEntregaDocumento: response.copia_constancia_entrega_documento,
          copiaConstanciaEntregaRuta: response.copia_constancia_entrega_ruta,
          mantenimientoId: response.mantenimiento_id,
        };
        this.listarUbicaciones(undefined, 'origen', this.editar, this.autorizacion.origen);
        this.listarUbicaciones(undefined, 'destino', this.editar, this.autorizacion.destino);
        console.log('Visualizando registro', response);
      },
      (error: any) => {
        console.error('Error obteniendo registro', error);
      }
    );
  }

  guardarRegistro(form: NgForm) {
    const errores = [
      { condicion: !this.validarCorreo(this.autorizacion.correoElectronicoOtorgante!) || !this.validarTelefono(this.autorizacion.numeroTelefonicoOtorgante!) || !this.validarTelefono(this.autorizacion.numeroTelefonicoAutorizadoRecoger!) || !this.validarTelefono(this.autorizacion.numeroTelefonicoAutorizadoViajar!), mensaje: 'Error al digitar el formulario.' },
      { condicion: form.invalid, mensaje: 'Todos los campos son obligatorios.' },
    ];

    for (const error of errores) {
      if (error.condicion) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.mensaje
        });
        return;
      }
    }

    if (this.editar) {
      this.guardar(this.registro.mantenimiento_id);
    }
    else {
      if (this.ConstanciaEntrega == null || this.AutorizacionViaje == null || this.DocumentoIdentidadAutorizado == null || this.DocumentoParentesco == null) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Debe cargar la documentación.'
        });
        return;
      }
      this.servicioMantenimientos.guardarMantenimiento(this.vigiladoId, this.placa, 4).subscribe(
        (response: any) => {
          if (response.id) {
            this.guardar(response.id);
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se pudo guardar el mantenimiento.'
            });
          }
        },
        (error: any) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ha ocurrido un error al guardar el registro.'
          });
        }
      );
    }
  }

  guardar(id: any) {
    Swal.fire({
      title: 'Guardando información',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading(null)
      }
    });
    if (this.autorizacion.situacionDiscapacidad == 'NO') {
      this.autorizacion.tipoDiscapacidad = '7';
    }
    if (this.autorizacion.perteneceComunidadEtnica == 'NO') {
      this.autorizacion.tipoPoblacionEtnica = '6';
    }

    if (this.autorizacion.generoOtorgante == '') {
      this.autorizacion.generoOtorgante = null;
    }
    console.log('Guardando registro', this.autorizacion);
    this.servicioMantenimientos.guardarAutorizacion(this.autorizacion, id).subscribe(
      (response: any) => {
        let texto
        if (this.editar) texto = 'Autorización actualizada correctamente.'
        else texto = 'Autorización guardada correctamente.'
        Swal.fire({
          icon: 'success',
          title: this.editar ? 'Autorización actualizada' : 'Autorización guardada',
          text: texto
        });
        this.router.navigate(['/administrar/autorizacion']);
      },
      (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ha ocurrido un error al guardar el registro.'
        });
      }
    );
  }

  setArchivo(archivo: File | null, tipo: number) {
    if (archivo) {
      Swal.fire({
        title: 'Cargando archivo...',
        text: 'Por favor espera mientras se procesa el archivo.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading(null);
        }
      });
      this.servicioArchivos.guardarArchivo(archivo, 'sicov', this.vigiladoId!).subscribe({
        next: (respuesta: any) => {
          if (tipo == 1) {
            this.AutorizacionViaje = archivo;
            this.autorizacion.copiaAutorizacionViajeNombreOriginal = respuesta.nombreOriginalArchivo;
            this.autorizacion.copiaAutorizacionViajeDocumento = respuesta.nombreAlmacenado;
            this.autorizacion.copiaAutorizacionViajeRuta = respuesta.ruta;
          }
          if (tipo == 2) {
            this.DocumentoParentesco = archivo;
            this.autorizacion.copiaDocumentoParentescoNombreOriginal = respuesta.nombreOriginalArchivo;
            this.autorizacion.copiaDocumentoParentescoDocumento = respuesta.nombreAlmacenado;
            this.autorizacion.copiaDocumentoParentescoRuta = respuesta.ruta;
          }
          if (tipo == 3) {
            this.DocumentoIdentidadAutorizado = archivo;
            this.autorizacion.copiaDocumentoIdentidadAutorizadoNombreOriginal = respuesta.nombreOriginalArchivo;
            this.autorizacion.copiaDocumentoIdentidadAutorizadoDocumento = respuesta.nombreAlmacenado;
            this.autorizacion.copiaDocumentoIdentidadAutorizadoRuta = respuesta.ruta;
          }
          if (tipo == 4) {
            this.ConstanciaEntrega = archivo;
            this.autorizacion.copiaConstanciaEntregaNombreOriginal = respuesta.nombreOriginalArchivo;
            this.autorizacion.copiaConstanciaEntregaDocumento = respuesta.nombreAlmacenado;
            this.autorizacion.copiaConstanciaEntregaRuta = respuesta.ruta;
          }
          Swal.close();
        }
      })
    }
  }

  descargarArchivo(documento: Autorizacion, tipo: number) {
    if (tipo == 1) {
      if (documento.copiaAutorizacionViajeDocumento && documento.copiaAutorizacionViajeRuta && documento.copiaAutorizacionViajeNombreOriginal) {
        this.servicioArchivos.descargarArchivo(documento.copiaAutorizacionViajeDocumento, documento.copiaAutorizacionViajeRuta, documento.copiaAutorizacionViajeNombreOriginal)
      }
    }
    if (tipo == 2) {
      if (documento.copiaDocumentoParentescoDocumento && documento.copiaDocumentoParentescoRuta && documento.copiaDocumentoParentescoNombreOriginal) {
        this.servicioArchivos.descargarArchivo(documento.copiaDocumentoParentescoDocumento, documento.copiaDocumentoParentescoRuta, documento.copiaDocumentoParentescoNombreOriginal);
      }
    }
    if (tipo == 3) {
      if (documento.copiaDocumentoIdentidadAutorizadoDocumento && documento.copiaDocumentoIdentidadAutorizadoRuta && documento.copiaDocumentoIdentidadAutorizadoNombreOriginal) {
        this.servicioArchivos.descargarArchivo(documento.copiaDocumentoIdentidadAutorizadoDocumento, documento.copiaDocumentoIdentidadAutorizadoRuta, documento.copiaDocumentoIdentidadAutorizadoNombreOriginal);
      }
    }
    if (tipo == 4) {
      if (documento.copiaConstanciaEntregaDocumento && documento.copiaConstanciaEntregaRuta && documento.copiaConstanciaEntregaNombreOriginal) {
        this.servicioArchivos.descargarArchivo(documento.copiaConstanciaEntregaDocumento, documento.copiaConstanciaEntregaRuta, documento.copiaConstanciaEntregaNombreOriginal);
      }
    }
  }

  manejarCambioArchivo(archivo: File | null, tipo: number) {
    if (this.excedeTamanio || this.tipoIncorrecto) {
      return;
    }
    this.setArchivo(archivo, tipo)
  }

  manejarExcedeTamanio() {
    Swal.fire({
      icon: 'warning',
      title: 'El archivo pesa más de ' + this.megasMaximas + ' Mb',
    });
  }

  manejarTipoIncorrecto() {
    Swal.fire({
      icon: 'warning',
      title: 'El tipo de archivo seleccionado es incorrecto',
    });
  }

  validarCorreo(correo: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(correo);
  }

  validarTelefono(telefono: number): boolean {
    const telefonoString = telefono?.toString() ?? '';
    return /^[0-9]{7,10}$/.test(telefonoString);
  }

  manejarNombre(event: any) {
    const input = event.target;
    const fieldName = input.name;
    const nombreLimpio = validacionNombre.esNombreValido(event);

    input.value = nombreLimpio;

    if (fieldName === 'nombresApellidosNna') {
      this.autorizacion.nombresApellidosNna = nombreLimpio;
    }
    else if (fieldName === 'nombresApellidosOtorgante') {
      this.autorizacion.nombresApellidosOtorgante = nombreLimpio;
    } else if (fieldName === 'nombresApellidosAutorizadoViajar') {
      this.autorizacion.nombresApellidosAutorizadoViajar = nombreLimpio;
    } else if (fieldName === 'nombresApellidosAutorizadoRecoger') {
      this.autorizacion.nombresApellidosAutorizadoRecoger = nombreLimpio;
    }
  }

  limitarNumero(event: any) {
    const input = event.target;
    const fieldName = input.name;

    const numeroLimpio = validacionNumero.esNumeroValido(event, 2, 10);

    input.value = numeroLimpio;
    if (fieldName === 'numeroTelefonicoOtorgante') {
      this.autorizacion.numeroTelefonicoOtorgante = numeroLimpio;
    } else if (fieldName === 'numeroTelefonicoAutorizadoRecoger') {
      this.autorizacion.numeroTelefonicoAutorizadoRecoger = numeroLimpio;
    } else if (fieldName === 'numeroTelefonicoAutorizadoViajar') {
      this.autorizacion.numeroTelefonicoAutorizadoViajar = numeroLimpio;
    }
  }

  validarSoloLetrasyNumeros(event: KeyboardEvent) {
    SoloLetrasyNumeros(event);
  }

  bloquearEscritura(event: KeyboardEvent) {
    event.preventDefault(); // Bloquea cualquier tecla
  }

  cargarMunicipioOrigen(event: Event) {
    const departamentoId = (event.target as HTMLSelectElement).value;
    if (departamentoId) {
      this.listarMunicipios(departamentoId, 'origen');
    }
  }

  cargarMunicipioDestino(event: Event) {
    const departamentoId = (event.target as HTMLSelectElement).value;
    if (departamentoId) {
      this.listarMunicipios(departamentoId, 'destino');
    }
  }

  cargarCentrosPobladosOrigen(event: Event) {
    const municipioId = (event.target as HTMLSelectElement).value;
    if (municipioId) {
      this.listarUbicaciones(municipioId, 'origen');
    }
  }

  cargarCentrosPobladosDestino(event: Event) {
    const municipioId = (event.target as HTMLSelectElement).value;
    if (municipioId) {
      this.listarUbicaciones(municipioId, 'destino');
    }
  }


  volver() {
    if (this.editar) {
      const info = {
        placa: this.placa,
        editar: this.editar,
        vigiladoId: this.vigiladoId,
        isSupervisor: this.isSupervisor,
        usuario: this.Usuario,
      }
      this.router.navigate(['/administrar/autorizacion-historial'], { state: { info: info } });
    } else {
      this.router.navigate(['/administrar/autorizacion']);
    }
  }
}
