import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import type { MultipartFileContract } from '@ioc:Adonis/Core/BodyParser'
import { Exception } from '@adonisjs/core/build/standalone'
import { ServicioMantenimeinto } from 'App/Dominio/Datos/Servicios/ServicioMantenimiento';
import TblArchivoPrograma from 'App/Infraestructura/Datos/Entidad/ArchivoPrograma';
import TblMantenimiento from 'App/Infraestructura/Datos/Entidad/Mantenimiento';
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario';
import { RepositorioMantenimientoDB } from 'App/Infraestructura/Implementacion/Lucid/RepositorioMantenimientoDB';
import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios';
import { ServicioExportacion } from 'App/Dominio/Datos/Servicios/ServicioExportacion';
import { guardarLogError } from 'App/Dominio/guardarLogError';
import ExcelJS from 'exceljs';
import { DateTime } from 'luxon';


type DefinicionTipoDato = {
  campo: string
  tipo: 'numero' | 'texto'
  etiqueta?: string
  alternativas?: string[]
  maxLongitud?: number
}

const DEFINICIONES_PREVENTIVO_CORRECTIVO: DefinicionTipoDato[] = [
  { campo: 'vigiladoId', tipo: 'numero' },
  { campo: 'placa', tipo: 'texto', maxLongitud: 6 },
  { campo: 'fecha', tipo: 'texto' },
  { campo: 'hora', tipo: 'texto' },
  { campo: 'nit', tipo: 'numero', etiqueta: 'nit' },
  { campo: 'razonSocial', tipo: 'texto' },
  { campo: 'tipoIdentificacion', tipo: 'numero' },
  { campo: 'numeroIdentificacion', tipo: 'texto', etiqueta: 'numeroIdentificacion' },
  { campo: 'nombresResponsable', tipo: 'texto' },
  { campo: 'detalleActividades', tipo: 'texto' },
];

const DEFINICIONES_ALISTAMIENTO: DefinicionTipoDato[] = [
  { campo: 'vigiladoId', tipo: 'numero' },
  { campo: 'placa', tipo: 'texto', maxLongitud: 6 },
  { campo: 'tipoIdentificacionResponsable', tipo: 'numero' },
  { campo: 'numeroIdentificacionResponsable', tipo: 'texto' },
  { campo: 'nombreResponsable', tipo: 'texto' },
  { campo: 'tipoIdentificacionConductor', tipo: 'numero' },
  { campo: 'numeroIdentificacionConductor', tipo: 'texto' },
  { campo: 'nombresConductor', tipo: 'texto' },
  { campo: 'detalleActividades', tipo: 'texto' },
  { campo: 'actividades', tipo: 'texto', alternativas: ['actividadesTexto', 'actividadestexto'] },
];


export default class ControladorMantenimiento {
  private servicioExportacion = new ServicioExportacion();
  private servicioMantenimiento: ServicioMantenimeinto
  constructor(){
    this.servicioMantenimiento = new ServicioMantenimeinto(new RepositorioMantenimientoDB())
  }

  /**
   * Maneja los errores de forma consistente en todos los métodos del controlador
   */
  private manejarError(error: any, response: any): any {
    // Si existe responseData del API externo, retornarla completa
    if(error.responseData) {
      return response.status(error.status || 500).send(error.responseData)
    }

    // Manejo de errores de sesión expirada (401)
    if(error.status === 401 || error.message?.includes('Su sesión ha expirado')) {
      return response.status(401).send({ mensaje: error.message || 'Su sesión ha expirado. Por favor, vuelva a iniciar sesión' })
    }

    // Manejo de datos inválidos (400)
    if(error.status === 400 || error.message?.includes('Token de autorización no encontrado')) {
      return response.status(400).send({ mensaje: error.message || 'Datos de autorización inválidos' })
    }

    // Manejo de recursos no encontrados (404)
    if(error.status === 404 || error.message?.includes('no encontrado')) {
      return response.status(404).send({ mensaje: error.message || 'Recurso no encontrado' })
    }

    // Error genérico del servidor
    return response.status(500).send({ mensaje: 'Error interno del servidor' })
  }

  private obtenerExtensionCliente(nombre?: string | null): string | null {
    if (!nombre) {
      return null
    }
    const indice = nombre.lastIndexOf('.')
    if (indice === -1 || indice === nombre.length - 1) {
      return null
    }
    return nombre.slice(indice + 1).toLowerCase()
  }

  private esArchivoExcelXlsx(archivo: MultipartFileContract): boolean {
    const extension = this.obtenerExtensionCliente(archivo.clientName ?? archivo.fileName)
    if (extension !== 'xlsx') {
      return false
    }

    const contentType = archivo.headers?.['content-type']?.toLowerCase()
    if (!contentType) {
      return true
    }

    if (contentType.includes('spreadsheetml')) {
      return true
    }

    return contentType === 'application/octet-stream'
  }

  private obtenerErrorArchivoExcel(archivo: MultipartFileContract): string | null {
    if (!archivo.isValid) {
      return archivo.errors?.map((error) => error.message).join(', ') || 'Archivo inválido'
    }

    if (!this.esArchivoExcelXlsx(archivo)) {
      return 'El archivo debe estar en formato XLSX'
    }

    return null
  }

  private async leerRegistrosDesdeExcel(
    archivo: MultipartFileContract,
    columnasRequeridas?: Array<{ nombre: string; descripcion?: string }>
  ): Promise<{ registros: any[]; errores: string[]; totalFilas: number }> {
    const workbook = new ExcelJS.Workbook();
    if (archivo.tmpPath) {
      await workbook.xlsx.readFile(archivo.tmpPath);
    } else {
      const buffer = await (archivo as any).toBuffer();
      await workbook.xlsx.load(buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { registros: [], errores: [], totalFilas: 0 };
    }

    const headerRow = worksheet.getRow(1);
    const headers = ((headerRow.values as unknown as any[]) || [])
      .map((valor) => (typeof valor === 'string' ? valor.trim() : valor))
      .map((valor) => (typeof valor === 'number' ? String(valor) : valor))
      .filter((valor) => valor);

    const headersNormalizados = new Map<string, string>();
    headers.forEach((valor) => {
      const original = String(valor).trim();
      if (original) {
        headersNormalizados.set(original.toLowerCase(), original);
      }
    });

    if (columnasRequeridas && columnasRequeridas.length > 0) {
      const faltantes = columnasRequeridas.filter((columna) => {
        const llave = columna.nombre.trim().toLowerCase();
        return !headersNormalizados.has(llave);
      });

      if (faltantes.length > 0) {
        const detalle = faltantes
          .map((columna) => {
            if (columna.descripcion) {
              return `${columna.nombre} (${columna.descripcion})`;
            }
            return columna.nombre;
          })
          .join(', ');

        throw new Exception(
          `El archivo no contiene las columnas requeridas: ${detalle}`,
          400
        );
      }
    }

    const columnasParaValidar = columnasRequeridas
      ? columnasRequeridas.map((columna) => {
          const llave = columna.nombre.trim().toLowerCase();
          return {
            descriptor: columna,
            encabezado: headersNormalizados.get(llave) ?? columna.nombre,
          };
        })
      : [];

    const registros: any[] = [];
    const erroresFilas: string[] = [];
    let totalFilas = 0;

    worksheet.eachRow((fila, numeroFila) => {
      if (numeroFila === 1) {
        return;
      }

      const registro: Record<string, any> = {};
      headers.forEach((encabezado, index) => {
        const columna = index + 1;
        const celda = fila.getCell(columna);
        if (!encabezado) {
          return;
        }

        const clave = String(encabezado).trim();
        registro[clave] = this.normalizarValorExcel(clave, celda);
      });

      const tieneDatos = Object.values(registro).some((valor) => valor !== null && valor !== undefined && String(valor).trim() !== '');
      if (tieneDatos) {
        totalFilas += 1;
        if (columnasParaValidar.length > 0) {
          const faltantesEnFila: string[] = [];
          for (const { descriptor, encabezado } of columnasParaValidar) {
            const claveRegistro = encabezado ?? descriptor.nombre;
            const valor = registro[claveRegistro];
            const esVacio =
              valor === null ||
              valor === undefined ||
              (typeof valor === 'string' && valor.trim() === '');
            if (esVacio) {
              faltantesEnFila.push(
                descriptor.descripcion
                  ? `${descriptor.nombre} (${descriptor.descripcion})`
                  : descriptor.nombre
              );
            }
          }

          if (faltantesEnFila.length > 0) {
            erroresFilas.push(`Fila ${numeroFila}: ${faltantesEnFila.join(', ')}`);
            return;
          }
        }

        Object.defineProperty(registro, '__fila__', {
          value: numeroFila,
          enumerable: false,
        });

        registros.push(registro);
      }
    });

    return { registros, errores: erroresFilas, totalFilas };
  }

  private obtenerValorCampoRegistro(registro: Record<string, any>, definicion: DefinicionTipoDato): { valor: any, llave: string | null } {
    const candidatos = new Map<string, string>();
    const principal = definicion.campo.trim().toLowerCase();
    if (principal) {
      candidatos.set(principal, definicion.campo);
    }
    for (const alternativa of definicion.alternativas ?? []) {
      const llaveAlterna = alternativa.trim().toLowerCase();
      if (llaveAlterna && !candidatos.has(llaveAlterna)) {
        candidatos.set(llaveAlterna, alternativa);
      }
    }

    for (const llave of Object.keys(registro)) {
      const normalizada = llave.trim().toLowerCase();
      if (candidatos.has(normalizada)) {
        return { valor: registro[llave], llave };
      }
    }

    return { valor: undefined, llave: null };
  }

  private validarTiposDeDato(registros: any[], definiciones: DefinicionTipoDato[]): string[] {
    const errores: string[] = [];

    registros.forEach((registro, indice) => {
      const fila = (registro as any).__fila__ ?? (indice + 2);

      for (const definicion of definiciones) {
        const { valor, llave } = this.obtenerValorCampoRegistro(registro, definicion);
        const estaVacio =
          valor === null ||
          valor === undefined ||
          (typeof valor === 'string' && valor.trim() === '');

        if (estaVacio) {
          continue;
        }

        const etiqueta = definicion.etiqueta ?? definicion.campo;
        const esValido = definicion.tipo === 'numero'
          ? this.esNumeroValido(valor)
          : this.esTextoValido(valor);

        if (!esValido) {
          const tipoEsperado = definicion.tipo === 'numero' ? 'número' : 'texto';
          errores.push(`Fila ${fila}: la columna ${etiqueta} debe contener un ${tipoEsperado} válido.`);
          continue;
        }

        let valorNormalizado: any = valor;
        if (definicion.tipo === 'numero' && typeof valor === 'string') {
          valorNormalizado = valor.trim();
        }

        if (definicion.tipo === 'texto' && typeof valor === 'string') {
          valorNormalizado = valor.trim();
        }

        if (
          definicion.maxLongitud !== undefined &&
          definicion.tipo === 'texto' &&
          typeof valorNormalizado === 'string' &&
          valorNormalizado.length > definicion.maxLongitud
        ) {
          errores.push(
            `Fila ${fila}: la columna ${etiqueta} no puede superar ${definicion.maxLongitud} caracteres.`
          );
          continue;
        }

        if (llave) {
          if (definicion.tipo === 'numero' && typeof valorNormalizado === 'string') {
            registro[llave] = valorNormalizado;
          }

          if (definicion.tipo === 'texto' && typeof valorNormalizado === 'string') {
            registro[llave] = valorNormalizado;
          }
        }
      }
    });

    return errores;
  }

  private esNumeroValido(valor: any): boolean {
    if (typeof valor === 'number') {
      return Number.isFinite(valor);
    }

    if (typeof valor === 'string') {
      const texto = valor.trim();
      if (texto === '') {
        return false;
      }
      return /^[0-9]+$/.test(texto);
    }

    return false;
  }

  private esTextoValido(valor: any): boolean {
    return typeof valor === 'string';
  }

  private normalizarValorExcel(clave: string, celda: ExcelJS.Cell): any {
    const llave = clave.toLowerCase();
    const valor = celda.value ?? (celda.text || '').trim();

    if (llave === 'fecha') {
      return this.normalizarFechaExcel(valor);
    }

    if (llave === 'hora') {
      return this.normalizarHoraExcel(valor);
    }

    if (valor instanceof Date) {
      return DateTime.fromJSDate(valor).toISO();
    }

    if (typeof valor === 'string') {
      const limpio = valor.trim();
      if (limpio === '') {
        return null;
      }
      return limpio;
    }

    if (typeof valor === 'number') {
      const texto = (celda.text || '').trim();
      if (texto !== '') {
        return texto;
      }
      return valor;
    }

    if (valor && typeof valor === 'object' && 'text' in valor) {
      const texto = String((valor as any).text).trim();
      return texto === '' ? null : texto;
    }

    const texto = (celda.text || '').trim();
    return texto === '' ? null : texto;
  }

  private normalizarFechaExcel(valor: any): string | null {
    if (valor instanceof Date) {
      // Tomar solo el componente de fecha, ignorando la zona horaria del servidor
      return DateTime.fromObject(
        {
          year: valor.getFullYear(),
          month: valor.getMonth() + 1,
          day: valor.getDate(),
        },
        { zone: 'utc' }
      ).toISODate();
    }

    if (typeof valor === 'number') {
      // Excel almacena fechas como serie numérica; construir fecha por componentes para evitar corrimientos
      const jsDate = new Date(Math.round((valor - 25569) * 86400 * 1000));
      return DateTime.fromObject(
        {
          year: jsDate.getFullYear(),
          month: jsDate.getMonth() + 1,
          day: jsDate.getDate(),
        },
        { zone: 'utc' }
      ).toISODate();
    }

    if (typeof valor === 'string') {
      const limpio = valor.trim();
      if (limpio === '') {
        return null;
      }

      const candidatos = [
        DateTime.fromISO(limpio),
        DateTime.fromFormat(limpio, 'dd/MM/yyyy'),
        DateTime.fromFormat(limpio, 'MM/dd/yyyy'),
        DateTime.fromFormat(limpio, 'dd-MM-yyyy'),
        DateTime.fromFormat(limpio, 'MM-dd-yyyy'),
        DateTime.fromRFC2822(limpio),
      ];

      for (const candidato of candidatos) {
        if (candidato.isValid) {
          return candidato.toISODate();
        }
      }

      const desdeJS = DateTime.fromJSDate(new Date(limpio));
      if (desdeJS.isValid) {
        return desdeJS.toISODate();
      }

      return limpio;
    }

    return null;
  }

  private normalizarHoraExcel(valor: any): string | null {
    if (valor instanceof Date) {
      return DateTime.fromJSDate(valor).toFormat('HH:mm');
    }

    if (typeof valor === 'number') {
      const totalSegundos = Math.round(valor * 24 * 60 * 60);
      const horas = Math.floor(totalSegundos / 3600) % 24;
      const minutos = Math.floor((totalSegundos % 3600) / 60);
      return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
    }

    if (typeof valor === 'string') {
      const limpio = valor.trim();
      if (limpio === '') {
        return null;
      }

      const candidatos = [
        DateTime.fromISO(limpio),
        DateTime.fromFormat(limpio, 'HH:mm'),
        DateTime.fromFormat(limpio, 'H:mm'),
        DateTime.fromFormat(limpio, 'HH:mm:ss'),
        DateTime.fromFormat(limpio, 'H:mm:ss'),
        DateTime.fromFormat(limpio, 'hh:mm a'),
        DateTime.fromFormat(limpio, 'h:mm a'),
        DateTime.fromFormat(limpio, 'hh:mm:ss a'),
        DateTime.fromFormat(limpio, 'h:mm:ss a'),
      ];

      for (const candidato of candidatos) {
        if (candidato.isValid) {
          return candidato.toFormat('HH:mm');
        }
      }

      if (limpio.toLowerCase().includes('gmt') || limpio.toLowerCase().includes('utc')) {
        const desdeJS = DateTime.fromJSDate(new Date(limpio));
        if (desdeJS.isValid) {
          return desdeJS.toFormat('HH:mm');
        }
      }

      return limpio;
    }

    return null;
  }

  private construirResumen(total: number, exitosos: number, errores: string[] = []): { total: number; exitosos: number; errores: string[] } {
    return {
      total,
      exitosos,
      errores,
    };
  }

  private normalizarErroresResumen(errores: any[]): string[] {
    return errores.map((error) => {
      if (typeof error === 'string') {
        return error;
      }

      if (error && typeof error === 'object') {
        const indice = typeof error.indice === 'number' ? error.indice + 1 : undefined;
        const mensaje = typeof error.mensaje === 'string' && error.mensaje.trim() !== ''
          ? error.mensaje
          : typeof error.error === 'string' && error.error.trim() !== ''
            ? error.error
            : JSON.stringify(error);

        if (indice !== undefined) {
          return `Registro ${indice}: ${mensaje}`;
        }

        return mensaje;
      }

      return String(error);
    });
  }

  private formatearResumen(resumen: { total?: number; exitosos?: number; errores?: any[] } | null | undefined): { total: number; exitosos: number; errores: string[] } {
    const total = typeof resumen?.total === 'number' ? resumen.total : 0;
    const exitosos = typeof resumen?.exitosos === 'number' ? resumen.exitosos : 0;
    const errores = resumen?.errores;
    const erroresNormalizados = Array.isArray(errores) ? this.normalizarErroresResumen(errores) : [];

    return this.construirResumen(total, exitosos, erroresNormalizados);
  }
  public async listarPlacas ({ request, response }:HttpContextContract) {
    try {
      const { tipoId } = request.all();
      if (!tipoId) {
        return response.status(400).send({ mensaje: 'Todos los campos son requeridos'});
      }

      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;



      const placas = await this.servicioMantenimiento.listarPlacas(tipoId, usuario, idRol)
      return placas
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'listarPlacas')
      return this.manejarError(error, response)
    }
  }

  public async listarPlacasTodas ({ request, response }:HttpContextContract) {
    try {
      const { tipoId, vigiladoId } = request.all();
      if (!tipoId || !vigiladoId) {
        return response.status(400).send({ mensaje: 'Todos los campos son requeridos'});
      }
      if(tipoId != 4 && tipoId != 3){
        const usuario = await TblUsuarios.query().where('identificacion', vigiladoId).first();
        if(!usuario){
          return response.status(404).json({message: 'Vigilado no encontrado'})
        }
      }
      const placas = await this.servicioMantenimiento.listarPlacasTodas(tipoId,vigiladoId)
      return placas
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'listarPlacasTodas')
      return this.manejarError(error, response)
    }
  }

  public async guardarMantenimiento ({ request, response }:HttpContextContract) {
    try {
      let  proveedorId: string | undefined;;
      const { vigiladoId, placa, tipoId } = request.all()
      if (!tipoId || !vigiladoId || !placa) {
        return response.status(400).send({ mensaje: 'Todos los campos son requeridos'});
      }
      if(tipoId != 1 && tipoId != 2 && tipoId != 3 && tipoId != 4){
        return response.status(400).send({ mensaje: 'El tipoId no es valido'})
      }
      if(placa.length < 6 || placa.length >= 7){
        return response.status(400).send({ mensaje: 'La placa debe tener 6 caracteres' })
      }
      if (request?.respuestaDatos?.idRol == 5) {
        proveedorId = request.respuestaDatos.documento;
      }
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const mantenimiento = await this.servicioMantenimiento.guardarMantenimiento(request.all(), usuario, idRol, proveedorId)
      return response.status(201).json(mantenimiento)
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarMantenimiento')
      return this.manejarError(error, response)
    }
  }

  public async guardarPreventivo ({ request, response }:HttpContextContract) {
    try {
      const {mantenimientoId, tipoIdentificacion} = request.all()
      if (!mantenimientoId || isNaN(Number(mantenimientoId)) || !Number.isInteger(Number(mantenimientoId))) {
        return response.status(400).send({ mensaje: 'El mantenimientoId es requerido y debe ser un número entero' });
      }

      const datos = request.all()

      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const preventivo = await this.servicioMantenimiento.guardarPreventivo(datos, usuario, idRol)
      return response.status(201).json(preventivo)
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarPreventivo')
      return this.manejarError(error, response)
    }
  }

  public async guardarCorrectivo ({ request, response }:HttpContextContract) {
    try {
      const {mantenimientoId, tipoIdentificacion} = request.all()
       if (!mantenimientoId || isNaN(Number(mantenimientoId)) || !Number.isInteger(Number(mantenimientoId))) {
        return response.status(400).send({ mensaje: 'El mantenimientoId es requerido y debe ser un número entero' });
      }

      const datos = request.all()

      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const correctivo = await this.servicioMantenimiento.guardarCorrectivo(request.all(), usuario, idRol)
      return response.status(201).json(correctivo)
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarCorrectivo')
      return this.manejarError(error, response)
    }
  }

  public async guardarAlistamiento ({ request, response }:HttpContextContract) {
    try {
      const {
        mantenimientoId,
        tipoIdentificacionResponsable,
        numeroIdentificacionResponsable,
        nombreResponsable,
        tipoIdentificacionConductor,
        numeroIdentificacionConductor,
        nombresConductor,
        detalleActividades,
        actividades
      } = request.all();
      if (!mantenimientoId || !tipoIdentificacionResponsable || !numeroIdentificacionResponsable ||
          !nombreResponsable || !tipoIdentificacionConductor || !numeroIdentificacionConductor ||
          !nombresConductor || !detalleActividades || !actividades) {
        return response.status(400).send({ mensaje: 'Todos los campos son requeridos' });
      }

      const datos = request.all();

      const actividadesDb = await this.servicioMantenimiento.listarActividades();
      const actividadesInvalidas = actividades.some((actividad) =>
        !actividadesDb.some((actividadDb) => actividadDb.id === actividad)
      );
      if (actividadesInvalidas) {
        return response.status(400).send({ mensaje: 'Alguna actividad no es válida' });
      }
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const alistamiento = await this.servicioMantenimiento.guardarAlistamiento(request.all(), usuario, idRol);
      return response.status(201).json(alistamiento);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarAlistamiento')
      return this.manejarError(error, response)
    }
  }

  public async guardarAutorizacion ({ request, response }:HttpContextContract) {
    try {
      const {
        fechaViaje,
        origen,
        destino,
        tipoIdentificacionNna,
        numeroIdentificacionNna,
        nombresApellidosNna,
        situacionDiscapacidad,
        tipoDiscapacidad,
        perteneceComunidadEtnica,
        tipoPoblacionEtnica,
        tipoIdentificacionOtorgante,
        numeroIdentificacionOtorgante,
        nombresApellidosOtorgante,
        numeroTelefonicoOtorgante,
        correoElectronicoOtorgante,
        direccionFisicaOtorgante,
        sexoOtorgante,
        calidadActua,
        tipoIdentificacionAutorizadoViajar,
        numeroIdentificacionAutorizadoViajar,
        nombresApellidosAutorizadoViajar,
        numeroTelefonicoAutorizadoViajar,
        direccionFisicaAutorizadoViajar,
        tipoIdentificacionAutorizadoRecoger,
        numeroIdentificacionAutorizadoRecoger,
        nombresApellidosAutorizadoRecoger,
        numeroTelefonicoAutorizadoRecoger,
        direccionFisicaAutorizadoRecoger,
        copiaAutorizacionViajeNombreOriginal,
        copiaAutorizacionViajeDocumento,
        copiaAutorizacionViajeRuta,
        copiaDocumentoParentescoNombreOriginal,
        copiaDocumentoParentescoDocumento,
        copiaDocumentoParentescoRuta,
        copiaDocumentoIdentidadAutorizadoNombreOriginal,
        copiaDocumentoIdentidadAutorizadoDocumento,
        copiaDocumentoIdentidadAutorizadoRuta,
        copiaConstanciaEntregaNombreOriginal,
        copiaConstanciaEntregaDocumento,
        copiaConstanciaEntregaRuta,
        mantenimientoId
      } = request.all();
      if (!fechaViaje || !origen || !destino || !tipoIdentificacionNna || !numeroIdentificacionNna ||
          !nombresApellidosNna || !situacionDiscapacidad || !tipoDiscapacidad || !perteneceComunidadEtnica ||
          !tipoPoblacionEtnica || !tipoIdentificacionOtorgante || !numeroIdentificacionOtorgante ||
          !nombresApellidosOtorgante || !numeroTelefonicoOtorgante || !correoElectronicoOtorgante ||
          !direccionFisicaOtorgante || !sexoOtorgante || !calidadActua || !tipoIdentificacionAutorizadoViajar ||
          !numeroIdentificacionAutorizadoViajar || !nombresApellidosAutorizadoViajar ||
          !numeroTelefonicoAutorizadoViajar || !direccionFisicaAutorizadoViajar ||
          !tipoIdentificacionAutorizadoRecoger || !numeroIdentificacionAutorizadoRecoger ||
          !nombresApellidosAutorizadoRecoger || !numeroTelefonicoAutorizadoRecoger ||
          !direccionFisicaAutorizadoRecoger || !copiaAutorizacionViajeNombreOriginal ||
          !copiaAutorizacionViajeDocumento || !copiaAutorizacionViajeRuta ||
          !copiaDocumentoParentescoNombreOriginal || !copiaDocumentoParentescoDocumento ||
          !copiaDocumentoParentescoRuta || !copiaDocumentoIdentidadAutorizadoNombreOriginal ||
          !copiaDocumentoIdentidadAutorizadoDocumento || !copiaDocumentoIdentidadAutorizadoRuta ||
          !copiaConstanciaEntregaNombreOriginal || !copiaConstanciaEntregaDocumento ||
          !copiaConstanciaEntregaRuta || !mantenimientoId) {
        return response.status(400).send({ mensaje: 'Todos los campos son requeridos' });
      }

      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const autorizacion = await this.servicioMantenimiento.guardarAutorizacion(request.all(), usuario, idRol)
      return response.status(201).json(autorizacion);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'guardarAutorizacion')
      return this.manejarError(error, response)
    }
  }

  public async visualizarPreventivo ({ request, response }:HttpContextContract) {
    try {
      const { mantenimientoId } = request.all();
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const mantenimiento = await this.servicioMantenimiento.visualizarPreventivo(mantenimientoId, usuario, idRol)
      return mantenimiento
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarPreventivo')
      return this.manejarError(error, response)
    }
  }

  public async visualizarCorrectivo ({ request, response }:HttpContextContract) {
    try {
      const { mantenimientoId } = request.all();
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const mantenimiento = await this.servicioMantenimiento.visualizarCorrectivo(mantenimientoId, usuario, idRol)
      return mantenimiento
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarCorrectivo')
      return this.manejarError(error, response)
    }
  }

  public async visualizarAlistamiento ({ request, response }:HttpContextContract) {
    try {
      const { mantenimientoId } = request.all();
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const mantenimiento = await this.servicioMantenimiento.visualizarAlistamiento(mantenimientoId, usuario, idRol)
      return mantenimiento
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarAlistamiento')
      return this.manejarError(error, response)
    }
  }

  public async visualizarAutorizacion ({ request, response }:HttpContextContract) {
    try {
      const { mantenimientoId } = request.all();
      const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const mantenimiento = await this.servicioMantenimiento.visualizarAutorizacion(mantenimientoId, usuario, idRol)
      return mantenimiento
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'visualizarAutorizacion')
      return this.manejarError(error, response)
    }
  }


  public async listarHistorial ({ request, response }:HttpContextContract) {
    try {
      const { tipoId, vigiladoId, placa } = request.all();
       const payload = await request.obtenerPayloadJWT()
      const usuario = payload.documento;
      const idRol = payload.idRol;
      const historial = await this.servicioMantenimiento.listarHistorial(tipoId, vigiladoId, placa, idRol)
      return historial
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'listarHistorial')
      return this.manejarError(error, response)
    }
  }

  public async listarActividades ({ request, response }:HttpContextContract) {
    try {
      const actividades = await this.servicioMantenimiento.listarActividades()
      return actividades.map(actividad => ({
        id: actividad.id,
        nombre: actividad.nombre
      }));
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'listarActividades')
      return this.manejarError(error, response)
    }
  }

  public async descargarPlantillaAlistamiento ({ request, response }: HttpContextContract) {
    let payloadJWT: any
    try {
      payloadJWT = await request.obtenerPayloadJWT()
      const [actividades, tiposIdentificacion] = await Promise.all([
        this.servicioMantenimiento.listarActividades(),
        this.servicioMantenimiento.listarTiposIdentificacion()
      ])

      const workbook = new ExcelJS.Workbook()
      const hojaPrincipal = workbook.addWorksheet('alistamiento')
      hojaPrincipal.columns = [
        { header: 'vigiladoId', key: 'vigiladoId', width: 18 },
        { header: 'placa', key: 'placa', width: 12 },
        { header: 'tipoIdentificacionResponsable', key: 'tipoIdentificacionResponsable', width: 34 },
        { header: 'numeroIdentificacionResponsable', key: 'numeroIdentificacionResponsable', width: 32 },
        { header: 'nombreResponsable', key: 'nombreResponsable', width: 28 },
        { header: 'tipoIdentificacionConductor', key: 'tipoIdentificacionConductor', width: 32 },
        { header: 'numeroIdentificacionConductor', key: 'numeroIdentificacionConductor', width: 32 },
        { header: 'nombresConductor', key: 'nombresConductor', width: 26 },
        { header: 'detalleActividades', key: 'detalleActividades', width: 30 },
        { header: 'actividades', key: 'actividades', width: 18 }
      ]
      hojaPrincipal.addRow({})

      const hojaActividades = workbook.addWorksheet('actividades')
      hojaActividades.columns = [
        { header: 'id', key: 'id', width: 12 },
        { header: 'nombre', key: 'nombre', width: 40 }
      ]
      actividades.forEach((actividad) => {
        hojaActividades.addRow({ id: actividad.id, nombre: actividad.nombre })
      })

      const hojaTiposIdentificacion = workbook.addWorksheet('tipos_identificacion')
      hojaTiposIdentificacion.columns = [
        { header: 'codigo', key: 'codigo', width: 16 },
        { header: 'descripcion', key: 'descripcion', width: 40 }
      ]
      tiposIdentificacion.forEach((tipo: any) => {
        hojaTiposIdentificacion.addRow({ codigo: tipo.codigo, descripcion: tipo.descripcion })
      })

      const buffer = await workbook.xlsx.writeBuffer()

      response.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      response.header('Content-Disposition', 'attachment; filename=plantilla_alistamiento.xlsx')
      return response.send(buffer)
    } catch (error: any) {
      const documento = payloadJWT?.documento ?? ''
      await guardarLogError(error, documento, 'descargarPlantillaAlistamiento')
      return this.manejarError(error, response)
    }
  }

  public async descargarPlantillaPreventivoCorrectivo ({ request, response }: HttpContextContract) {
    let payloadJWT: any
    try {
      payloadJWT = await request.obtenerPayloadJWT()
      const tiposIdentificacion = await this.servicioMantenimiento.listarTiposIdentificacion()

      const workbook = new ExcelJS.Workbook()
      const hojaPrincipal = workbook.addWorksheet('mantenimiento')
      hojaPrincipal.columns = [
        { header: 'vigiladoId', key: 'vigiladoId', width: 18 },
        { header: 'placa', key: 'placa', width: 12 },
        { header: 'fecha', key: 'fecha', width: 16 },
        { header: 'hora', key: 'hora', width: 12 },
        { header: 'nit', key: 'nit', width: 18 },
        { header: 'razonSocial', key: 'razonSocial', width: 28 },
        { header: 'tipoIdentificacion', key: 'tipoIdentificacion', width: 24 },
        { header: 'numeroIdentificacion', key: 'numeroIdentificacion', width: 26 },
        { header: 'nombresResponsable', key: 'nombresResponsable', width: 28 },
        { header: 'detalleActividades', key: 'detalleActividades', width: 30 }
      ]
      hojaPrincipal.addRow({})

      const hojaTiposIdentificacion = workbook.addWorksheet('tipos_identificacion')
      hojaTiposIdentificacion.columns = [
        { header: 'codigo', key: 'codigo', width: 16 },
        { header: 'descripcion', key: 'descripcion', width: 40 }
      ]
      tiposIdentificacion.forEach((tipo: any) => {
        hojaTiposIdentificacion.addRow({ codigo: tipo.codigo, descripcion: tipo.descripcion })
      })

      const buffer = await workbook.xlsx.writeBuffer()

      response.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      response.header('Content-Disposition', 'attachment; filename=plantilla_mantenimiento_preventivo_correctivo.xlsx')
      return response.send(buffer)
    } catch (error: any) {
      const documento = payloadJWT?.documento ?? ''
      await guardarLogError(error, documento, 'descargarPlantillaPreventivoCorrectivo')
      return this.manejarError(error, response)
    }
  }

  public async listarTrabajosFallidos ({ request, response }: HttpContextContract) {
    let payloadJWT: any;
    try {
      payloadJWT = await request.obtenerPayloadJWT();
      const { documento: usuario, idRol } = payloadJWT;
      const { tipo, estado, nit } = request.qs();

      const filtros: { tipo?: string; estado?: string; nit?: string } = {};
      if (tipo) {
        filtros.tipo = String(tipo);
      }
      if (estado) {
        filtros.estado = String(estado);
      }
      if (nit) {
        filtros.nit = String(nit);
      }

      const trabajos = await this.servicioMantenimiento.listarTrabajosFallidos(usuario, idRol, filtros);
      return trabajos;
    } catch (error: any) {
      const documento = payloadJWT?.documento ?? '';
      await guardarLogError(error, documento, 'listarTrabajosFallidos');
      return this.manejarError(error, response);
    }
  }

  public async listarTrabajosProgramados ({ request, response }: HttpContextContract) {
    let payloadJWT: any;
    try {
      payloadJWT = await request.obtenerPayloadJWT();
      const { documento: usuario, idRol } = payloadJWT;

      const {
        pagina,
        limite,
        estado,
        tipo,
        placa,
        vin,
        usuario: usuarioFiltro,
        proveedor,
        sincronizacionEstado,
        nit,
        fecha,
        terminoTipo,
        terminoPlaca,
        termino,
        ordenCampo,
        ordenDireccion,
      } = request.qs();

      const filtros: {
        estado?: string
        tipo?: string
        placa?: string
        vin?: string
        usuario?: string
        proveedor?: string
        sincronizacionEstado?: string
        nit?: string
        fecha?: string
        terminoTipo?: string
        terminoPlaca?: string
      } = {};

      if (estado) filtros.estado = String(estado);
      if (tipo) filtros.tipo = String(tipo);
      if (placa) filtros.placa = String(placa);
      if (vin) filtros.vin = String(vin);
      if (usuarioFiltro) filtros.usuario = String(usuarioFiltro);
      if (proveedor) filtros.proveedor = String(proveedor);
      if (sincronizacionEstado) filtros.sincronizacionEstado = String(sincronizacionEstado);
      if (nit) filtros.nit = String(nit);
      if (terminoTipo) filtros.terminoTipo = String(terminoTipo);
      if (terminoPlaca) filtros.terminoPlaca = String(terminoPlaca);
      if (termino && !terminoTipo && !terminoPlaca) {
        const terminoNormalizado = String(termino);
        filtros.terminoTipo = terminoNormalizado;
        filtros.terminoPlaca = terminoNormalizado;
      }

      if (fecha) {
        const fechaNormalizada = DateTime.fromISO(String(fecha));
        if (!fechaNormalizada.isValid) {
          return response.status(400).send({ mensaje: 'La fecha debe tener formato ISO (YYYY-MM-DD)' });
        }
        filtros.fecha = fechaNormalizada.toISODate();
      }

      let paginaNumero: number | undefined;
      if (pagina !== undefined) {
        paginaNumero = Number(pagina);
        if (!Number.isInteger(paginaNumero) || paginaNumero < 1) {
          return response.status(400).send({ mensaje: 'La página debe ser un número entero mayor o igual a 1' });
        }
      }

      let limiteNumero: number | undefined;
      if (limite !== undefined) {
        limiteNumero = Number(limite);
        if (!Number.isInteger(limiteNumero) || limiteNumero < 1) {
          return response.status(400).send({ mensaje: 'El límite debe ser un número entero mayor o igual a 1' });
        }
      }

      let orden: { campo?: string; direccion?: 'asc' | 'desc' } | undefined;
      if (ordenCampo || ordenDireccion) {
        const direccionNormalizada = String(ordenDireccion ?? 'desc').toLowerCase();
        if (ordenDireccion && direccionNormalizada !== 'asc' && direccionNormalizada !== 'desc') {
          return response.status(400).send({ mensaje: 'La dirección de orden solo admite los valores asc o desc' });
        }
        orden = {
          campo: ordenCampo ? String(ordenCampo) : undefined,
          direccion: (direccionNormalizada as 'asc' | 'desc') ?? 'desc',
        };
      }

      const resultado = await this.servicioMantenimiento.listarTrabajosProgramados(
        usuario,
        idRol,
        filtros,
        paginaNumero,
        limiteNumero,
        orden,
      );

      return response.status(200).json(resultado);
    } catch (error: any) {
      console.log(error);

      const documento = payloadJWT?.documento ?? '';
      await guardarLogError(error, documento, 'listarTrabajosProgramados');
      return this.manejarError(error, response);
    }
  }

  public async obtenerTrabajo ({ request, response, params }: HttpContextContract) {
    let payloadJWT: any;
    try {
      const jobId = Number(params.jobId ?? params.id);
      if (!Number.isInteger(jobId)) {
        return response.status(400).send({ mensaje: 'El jobId es requerido y debe ser un número entero' });
      }

      payloadJWT = await request.obtenerPayloadJWT();
      const { documento: usuario, idRol } = payloadJWT;

      const trabajo = await this.servicioMantenimiento.obtenerTrabajoProgramado(jobId, usuario, idRol);
      return response.status(200).json(trabajo);
    } catch (error: any) {
      const documento = payloadJWT?.documento ?? '';
      await guardarLogError(error, documento, 'obtenerTrabajo');
      return this.manejarError(error, response);
    }
  }

  public async reintentarTrabajoFallido ({ request, response, params }: HttpContextContract) {
    let payloadJWT: any;
    try {
      const jobId = Number(params.jobId ?? params.id);
      if (!Number.isInteger(jobId)) {
        return response.status(400).send({ mensaje: 'El jobId es requerido y debe ser un número entero' });
      }

      payloadJWT = await request.obtenerPayloadJWT();
      const { documento: usuario, idRol } = payloadJWT;

      const body = request.body() || {};
      const { accion } = body ?? {};
      const accionesPermitidas = new Set(['reprogramar', 'actualizar', 'marcarProcesado']);

      if (accion && typeof accion !== 'string') {
        return response.status(400).send({ mensaje: 'La acción debe ser una cadena válida' });
      }

      if (accion && !accionesPermitidas.has(accion)) {
        return response.status(400).send({ mensaje: 'La acción indicada no es válida' });
      }

      let overridePayload: Record<string, any> | null | undefined = undefined;
      let incluirPayload = false;
      if (Object.prototype.hasOwnProperty.call(body, 'payload')) {
        incluirPayload = true;
        overridePayload = body.payload;
        if (overridePayload !== null && typeof overridePayload !== 'object') {
          return response.status(400).send({ mensaje: 'El payload debe ser un objeto o nulo' });
        }
      }

      const opciones: {
        accion: 'reprogramar' | 'actualizar' | 'marcarProcesado';
        payload?: Record<string, any> | null;
      } = {
        accion: (accion as 'reprogramar' | 'actualizar' | 'marcarProcesado') ?? 'reprogramar',
      };

      if (incluirPayload) {
        opciones.payload = overridePayload ?? null;
      }

      const resultado = await this.servicioMantenimiento.reintentarTrabajoFallido(jobId, usuario, idRol, opciones);
      return response.status(200).json(resultado);
    } catch (error: any) {
      console.log(error);

      const documento = payloadJWT?.documento ?? '';
      await guardarLogError(error, documento, 'reintentarTrabajoFallido');
      return this.manejarError(error, response);
    }
  }

  private async obtenerParametrica(endpoint:string){
    const host = Env.get('URL_PARAMETRICAS')
    const headers = {
      'Authorization': `Bearer REDACTED-TOKEN-PARAMETRICO`
    };

    try {
      const respuesta = await axios.get(`${host}/parametrica/${endpoint}`, { headers });
      return respuesta.data;
    } catch (error) {
      return []
    }
  }


  public async exportarAXLSX({ request, response }: HttpContextContract) {
    try {
      const { tipoId, vigiladoId, placa } = request.all();
      const data = await this.servicioMantenimiento.listarHistorialExportar(tipoId,vigiladoId, placa)
      const cabeceras = Object.keys(data[0] || {}).map((key) => ({
        header: key,
        key: key,
        width: 20,
      }));
      const buffer = await this.servicioExportacion.encuestaToXLSX(data, cabeceras, 'datos')
      // Configurar opciones de respuesta
      response.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      response.header('Content-Disposition', 'attachment; filename=Historial.xlsx');
      // Enviar el archivo XLSX como respuesta
      response.send(buffer);
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT()
      await guardarLogError(error, documento??'', 'exportarAXLSX')
      return this.manejarError(error, response)
    }
  }

  public async cargaMasivaPreventivo({ request, response }: HttpContextContract) {
    try {
      const registros = request.input('registros');
      if (!Array.isArray(registros) || registros.length === 0) {
        return response
          .status(400)
          .json(this.construirResumen(Array.isArray(registros) ? registros.length : 0, 0, ['Debe proporcionar al menos un registro para procesar']));
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarPreventivoMasivo(registros, usuario, idRol);
      return response.status(202).json(this.formatearResumen(resumen));
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaPreventivo');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaPreventivoExcel({ request, response }: HttpContextContract) {
    try {
      const archivo = request.file('archivo', { size: '5mb' });
      if (!archivo) {
        return response.status(400).json(this.construirResumen(0, 0, ['Debe adjuntar el archivo en el campo "archivo"']));
      }
      const mensajeError = this.obtenerErrorArchivoExcel(archivo);
      if (mensajeError) {
        return response.status(400).json(this.construirResumen(0, 0, [mensajeError]));
      }

      const columnasRequeridas = [
        { nombre: 'vigiladoId', descripcion: 'Nit de la empresa de transporte' },
        { nombre: 'placa', descripcion: 'placa del vehiculo al que se le realiza el mantenimiento' },
        { nombre: 'fecha', descripcion: 'fecha del mantenimiento preventivo' },
        { nombre: 'hora', descripcion: 'hora del mantenimiento preventivo' },
        { nombre: 'nit', descripcion: 'nit de la empresa que realiza el mantenimiento preventivo' },
        { nombre: 'razonSocial', descripcion: 'razón social de la empresa que realiza el mantenimiento preventivo' },
        { nombre: 'tipoIdentificacion', descripcion: 'tipo de identificación del responsable' },
        { nombre: 'numeroIdentificacion', descripcion: 'número de identificación del responsable' },
        { nombre: 'nombresResponsable', descripcion: 'nombre del responsable del mantenimiento preventivo' },
        { nombre: 'detalleActividades', descripcion: 'descripción detallada del mantenimiento preventivo realizado' }
      ];
      let registrosExcel;
      try {
        registrosExcel = await this.leerRegistrosDesdeExcel(archivo, columnasRequeridas);
      } catch (error: any) {
        console.log({error});

        if (error?.status === 400 && typeof error.message === 'string') {
          return response.status(400).json(this.construirResumen(0, 0, [error.message]));
        }
        throw error;
      }

      const { registros, errores, totalFilas } = registrosExcel;

      if (errores.length > 0) {
        return response.status(400).json(this.construirResumen(totalFilas, 0, errores));
      }

      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).json(this.construirResumen(totalFilas, 0, ['El archivo no contiene registros para procesar']));
      }

      const erroresTipos = this.validarTiposDeDato(registros, DEFINICIONES_PREVENTIVO_CORRECTIVO);
      if (erroresTipos.length > 0) {
        return response.status(400).json(this.construirResumen(totalFilas, 0, erroresTipos));
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarPreventivoMasivo(registros, usuario, idRol);
      return response.status(202).json(this.formatearResumen(resumen));
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaPreventivoExcel');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaCorrectivo({ request, response }: HttpContextContract) {
    try {
      const registros = request.input('registros');
      if (!Array.isArray(registros) || registros.length === 0) {
        return response
          .status(400)
          .json(this.construirResumen(Array.isArray(registros) ? registros.length : 0, 0, ['Debe proporcionar al menos un registro para procesar']));
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarCorrectivoMasivo(registros, usuario, idRol);
      return response.status(202).json(this.formatearResumen(resumen));
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaCorrectivo');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaCorrectivoExcel({ request, response }: HttpContextContract) {
    try {
      const archivo = request.file('archivo', { size: '5mb' });
      if (!archivo) {
        return response.status(400).json(this.construirResumen(0, 0, ['Debe adjuntar el archivo en el campo "archivo"']));
      }
      const mensajeError = this.obtenerErrorArchivoExcel(archivo);
      if (mensajeError) {
        return response.status(400).json(this.construirResumen(0, 0, [mensajeError]));
      }

      const columnasRequeridas = [
        { nombre: 'vigiladoId', descripcion: 'Nit de la empresa de transporte' },
        { nombre: 'placa', descripcion: 'placa del vehiculo al que se le realiza el mantenimiento' },
        { nombre: 'fecha', descripcion: 'fecha del mantenimiento correctivo' },
        { nombre: 'hora', descripcion: 'hora del mantenimiento correctivo' },
        { nombre: 'nit', descripcion: 'nit de la empresa que realiza el mantenimiento correctivo' },
        { nombre: 'razonSocial', descripcion: 'razón social de la empresa que realiza el mantenimiento correctivo' },
        { nombre: 'tipoIdentificacion', descripcion: 'tipo de identificación del responsable' },
        { nombre: 'numeroIdentificacion', descripcion: 'número de identificación del responsable' },
        { nombre: 'nombresResponsable', descripcion: 'nombre del responsable del mantenimiento correctivo' },
        { nombre: 'detalleActividades', descripcion: 'descripción detallada del mantenimiento correctivo realizado' }
      ];
      let registrosExcel;
      try {
        registrosExcel = await this.leerRegistrosDesdeExcel(archivo, columnasRequeridas);
      } catch (error: any) {
        if (error?.status === 400 && typeof error.message === 'string') {
          return response.status(400).json(this.construirResumen(0, 0, [error.message]));
        }
        throw error;
      }

      const { registros, errores, totalFilas } = registrosExcel;

      if (errores.length > 0) {
        return response.status(400).json(this.construirResumen(totalFilas, 0, errores));
      }

      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).json(this.construirResumen(totalFilas, 0, ['El archivo no contiene registros para procesar']));
      }

      const erroresTipos = this.validarTiposDeDato(registros, DEFINICIONES_PREVENTIVO_CORRECTIVO);
      if (erroresTipos.length > 0) {
        return response.status(400).json(this.construirResumen(totalFilas, 0, erroresTipos));
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarCorrectivoMasivo(registros, usuario, idRol);
      return response.status(202).json(this.formatearResumen(resumen));
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaCorrectivoExcel');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaAlistamiento({ request, response }: HttpContextContract) {
    try {
      const registros = request.input('registros');
      if (!Array.isArray(registros) || registros.length === 0) {
        return response
          .status(400)
          .json(this.construirResumen(Array.isArray(registros) ? registros.length : 0, 0, ['Debe proporcionar al menos un registro para procesar']));
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarAlistamientoMasivo(registros, usuario, idRol);
      return response.status(202).json(this.formatearResumen(resumen));
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaAlistamiento');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaAlistamientoExcel({ request, response }: HttpContextContract) {
    try {
      const archivo = request.file('archivo', { size: '5mb' });
      if (!archivo) {
        return response.status(400).json(this.construirResumen(0, 0, ['Debe adjuntar el archivo en el campo "archivo"']));
      }
      const mensajeError = this.obtenerErrorArchivoExcel(archivo);
      if (mensajeError) {
        return response.status(400).json(this.construirResumen(0, 0, [mensajeError]));
      }

      const columnasRequeridas = [
        { nombre: 'vigiladoId', descripcion: 'Nit de la empresa de transporte' },
        { nombre: 'placa', descripcion: 'placa del vehiculo al que se le realiza el alistamiento' },
        { nombre: 'tipoIdentificacionResponsable', descripcion: 'tipo de identificación del responsable' },
        { nombre: 'numeroIdentificacionResponsable', descripcion: 'número de identificación del responsable' },
        { nombre: 'nombreResponsable', descripcion: 'nombre del responsable del alistamiento' },
        { nombre: 'tipoIdentificacionConductor', descripcion: 'tipo de identificación del conductor' },
        { nombre: 'numeroIdentificacionConductor', descripcion: 'número de identificación del conductor' },
        { nombre: 'nombresConductor', descripcion: 'nombre del conductor' },
        { nombre: 'detalleActividades', descripcion: 'descripción detallada del alistamiento realizado' },
        { nombre: 'actividades', descripcion: 'lista de actividades realizadas (1,2,3), revisar la hoja de actividades' }
      ];
      let registrosExcel;
      try {
        registrosExcel = await this.leerRegistrosDesdeExcel(archivo, columnasRequeridas);
      } catch (error: any) {
        if (error?.status === 400 && typeof error.message === 'string') {
          return response.status(400).json(this.construirResumen(0, 0, [error.message]));
        }
        throw error;
      }

      const { registros, errores, totalFilas } = registrosExcel;

      if (errores.length > 0) {
        return response.status(400).json(this.construirResumen(totalFilas, 0, errores));
      }

      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).json(this.construirResumen(totalFilas, 0, ['El archivo no contiene registros para procesar']));
      }

      const erroresTipos = this.validarTiposDeDato(registros, DEFINICIONES_ALISTAMIENTO);
      if (erroresTipos.length > 0) {
        return response.status(400).json(this.construirResumen(totalFilas, 0, erroresTipos));
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarAlistamientoMasivo(registros, usuario, idRol);
      return response.status(202).json(this.formatearResumen(resumen));
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaAlistamientoExcel');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaAutorizacion({ request, response }: HttpContextContract) {
    try {
      const registros = request.input('registros');
      if (!Array.isArray(registros) || registros.length === 0) {
        return response
          .status(400)
          .json(this.construirResumen(Array.isArray(registros) ? registros.length : 0, 0, ['Debe proporcionar al menos un registro para procesar']));
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarAutorizacionMasiva(registros, usuario, idRol);
      return response.status(202).json(this.formatearResumen(resumen));
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaAutorizacion');
      return this.manejarError(error, response);
    }
  }

  public async cargaMasivaAutorizacionExcel({ request, response }: HttpContextContract) {
    try {
      const archivo = request.file('archivo', { size: '5mb' });
      if (!archivo) {
        return response.status(400).json(this.construirResumen(0, 0, ['Debe adjuntar el archivo en el campo "archivo"']));
      }
      const mensajeError = this.obtenerErrorArchivoExcel(archivo);
      if (mensajeError) {
        return response.status(400).json(this.construirResumen(0, 0, [mensajeError]));
      }

      let registrosExcel;
      try {
        registrosExcel = await this.leerRegistrosDesdeExcel(archivo);
      } catch (error: any) {
        if (error?.status === 400 && typeof error.message === 'string') {
          return response.status(400).json(this.construirResumen(0, 0, [error.message]));
        }
        throw error;
      }

      const { registros, errores, totalFilas } = registrosExcel;

      if (errores.length > 0) {
        return response.status(400).json(this.construirResumen(totalFilas, 0, errores));
      }

      if (!Array.isArray(registros) || registros.length === 0) {
        return response.status(400).json(this.construirResumen(totalFilas, 0, ['El archivo no contiene registros para procesar']));
      }

      const payload = await request.obtenerPayloadJWT();
      const usuario = payload.documento;
      const idRol = payload.idRol;

      const resumen = await this.servicioMantenimiento.guardarAutorizacionMasiva(registros, usuario, idRol);
      return response.status(202).json(this.formatearResumen(resumen));
    } catch (error: any) {
      const { documento } = await request.obtenerPayloadJWT();
      await guardarLogError(error, documento ?? '', 'cargaMasivaAutorizacionExcel');
      return this.manejarError(error, response);
    }
  }

}
