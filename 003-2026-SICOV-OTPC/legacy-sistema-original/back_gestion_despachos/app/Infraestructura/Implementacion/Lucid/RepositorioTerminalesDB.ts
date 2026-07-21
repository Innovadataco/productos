import { Paginador } from "../../../Dominio/Paginador";
import { MapeadorPaginacionDB } from "./MapeadorPaginacionDB";
import { RepositorioTerminales } from "App/Dominio/Repositorios/RepositorioTerminales";
import { RespuestaRutas } from '../../../Dominio/Dto/RespuestaRutas';
import TblRutaEmpresas from "App/Infraestructura/Datos/Entidad/RutaEmpresa";
import Database from "@ioc:Adonis/Lucid/Database";
import { RespuestaParadas } from "App/Dominio/Dto/RespuestaParadas";
import { RespuestaClases } from "App/Dominio/Dto/RespuestaClases";
import { Nodo } from "App/Dominio/Datos/Entidades/Nodo";
import TblNodos from "App/Infraestructura/Datos/Entidad/Nodos";
import { error, log } from "console";
import TblRutaCodigoRutas from "App/Infraestructura/Datos/Entidad/RutaCodigoRutas";
import TblRutas from "App/Infraestructura/Datos/Entidad/Rutas";
import { RutaCodigoRuta } from "App/Dominio/Datos/Entidades/RutaCodigoRuta";
import { RutaEmpresa } from "App/Dominio/Datos/Entidades/RutaEmpresa";
import { Ruta } from "App/Dominio/Datos/Entidades/Ruta";
import TblRutaEmpresaVias from "App/Infraestructura/Datos/Entidad/RutaEmpresaVia";
import { RutaEmpresaVia } from "App/Dominio/Datos/Entidades/RutaEmpresaVia";
import TblRutaHabilitadas from "App/Infraestructura/Datos/Entidad/RutaHabilitadas";
import { RutaHabilitada } from "App/Dominio/Datos/Entidades/RutaHabilitada";
import { RutaDireccion } from "App/Dominio/Datos/Entidades/RutaDireccion";
import TblRutasDirecciones from "App/Infraestructura/Datos/Entidad/RutaDireccion";
import { Parada } from "App/Dominio/Datos/Entidades/Parada";
import TblParadas from "App/Infraestructura/Datos/Entidad/Paradas";
import { NodoDespacho } from "App/Dominio/Datos/Entidades/NodoDespacho";
import TblNodosDespachos from "App/Infraestructura/Datos/Entidad/NodosDespachos";
import TblRutaVehiculos from "App/Infraestructura/Datos/Entidad/RutaVehiculo";
import { ClaseVehiculo } from "App/Dominio/Datos/Entidades/ClaseVehiculo";
import TblSolicitudes from "App/Infraestructura/Datos/Entidad/Solicitudes";
import { ServicioEstados } from "App/Dominio/Datos/Servicios/ServicioEstados";
import TblClaseVehiculos from "App/Infraestructura/Datos/Entidad/ClaseVehiculos";

export class RepositorioTerminalesDB implements RepositorioTerminales {
  private servicioEstados = new ServicioEstados();
  async numeroTotalRutasPorUsuario(id: number) {
    try {
      const totalCountQuery = `SELECT COUNT(*) as total
      FROM tbl_ruta_empresas tre
        LEFT JOIN tbl_ruta_codigo_rutas trcr ON trcr.rcr_codigo_unico_ruta = tre.tre_codigo_unico_ruta
        LEFT JOIN tbl_rutas tr ON tr.trt_codigo_ruta = trcr.rcr_codigo_ruta
        LEFT JOIN tbl_centro_poblados tcp ON tcp.tcp_codigo_centro_poblado = tr.trt_codigo_cp_origen
        LEFT JOIN tbl_centro_poblados tcpd ON tcpd.tcp_codigo_centro_poblado = tr.trt_codigo_cp_destino
        LEFT JOIN tbl_municipios tm ON tcp.tcp_codigo_municipio = tm.tms_codigo_municipio
        LEFT JOIN tbl_municipios tmd ON tcpd.tcp_codigo_municipio = tmd.tms_codigo_municipio
        LEFT JOIN tbl_departamentos td ON tm.tms_departamento_codigo = td.tdp_codigo_departamento
        LEFT JOIN tbl_departamentos tdd ON tmd.tms_departamento_codigo = tdd.tdp_codigo_departamento
        LEFT JOIN tbl_rutas_direcciones trd ON trd.trd_id_ruta = tr.trt_id
        LEFT JOIN tbl_nodos tn ON tn.tnd_id = trd.trd_id_nodo
        LEFT JOIN tbl_tipo_despachos ttd ON ttd.ttd_id = tn.tnd_despacho_id
        LEFT JOIN tbl_ruta_empresa_vias trev ON trev.rev_codigo_unico_ruta = trcr.rcr_codigo_unico_ruta
        LEFT JOIN tbl_ruta_habilitadas trh ON trh.trh_codigo_unico_ruta = trcr.rcr_codigo_unico_ruta
      WHERE tre.tre_id_usuario = ${id} and tr.trt_ida_vuelta = 'A'`;

      const totalCountResult = await Database.rawQuery(totalCountQuery);
      const totalRecords = totalCountResult.rows[0].total;
      return { TotalRegistros: totalRecords };
    } catch (error) {
      return { message: "No se pudieron obtener las rutas de ese usuario" };
    }
  }

  async visualizarParadasPorRuta(
    param: any,
    id: number
  ): Promise<{ paradas: RespuestaParadas[]; paginacion: Paginador }> {
    const { pagina, limite, rutaId } = param;
    try {
      const totalCountQuery = `SELECT COUNT(*) as total
      FROM tbl_ruta_empresas tre
      LEFT JOIN tbl_ruta_codigo_rutas trcr ON trcr.rcr_codigo_unico_ruta = tre.tre_codigo_unico_ruta
      left join tbl_nodos_despachos tnd on tnd.tnd_codigo_unico_ruta = trcr.rcr_codigo_unico_ruta
      inner join tbl_paradas tp on tp.tps_id = tnd_paradas_id
      left join tbl_centro_poblados tcp on tcp.tcp_codigo_centro_poblado = tp.tps_codigo_cp
      left join tbl_municipios tm on tm.tms_codigo_municipio = tcp.tcp_codigo_municipio
      left join tbl_departamentos td on td.tdp_codigo_departamento = tm.tms_departamento_codigo
      left join tbl_nodos tn on tn.tnd_id = tp.tps_nodo_id
      left join tbl_ruta_empresa_vias trev on trev.rev_id = tp.tps_via_id
      WHERE tre.tre_id_usuario = ${id} and tre.tre_codigo_unico_ruta = ${rutaId}`;

      const totalCountResult = await Database.rawQuery(totalCountQuery);
      const totalRecords = totalCountResult.rows[0].total;
      let consulta;
      if (!pagina && !limite) {
        consulta = await Database.rawQuery(`SELECT
          tp.tps_id as parada_Id,
          tnd.tnd_id  as nodo_despacho_id,
          td.tdp_nombre as departamento,
          tm.tms_nombre as municipio,
          tcp.tcp_nombre as centro_Poblado,
          tcp.tcp_codigo_centro_poblado  as codigo_cp,
          tn.tnd_despacho_id as tipoLlegada_Id,
          tn.tnd_id as direccion_Id,
          trev.rev_id as via_id
            FROM
            tbl_ruta_empresas tre
          LEFT JOIN tbl_ruta_codigo_rutas trcr ON trcr.rcr_codigo_unico_ruta = tre.tre_codigo_unico_ruta
          left join tbl_nodos_despachos tnd on tnd.tnd_codigo_unico_ruta = trcr.rcr_codigo_unico_ruta
          inner join tbl_paradas tp on tp.tps_id = tnd_paradas_id
          left join tbl_centro_poblados tcp on tcp.tcp_codigo_centro_poblado = tp.tps_codigo_cp
          left join tbl_municipios tm on tm.tms_codigo_municipio = tcp.tcp_codigo_municipio
          left join tbl_departamentos td on td.tdp_codigo_departamento = tm.tms_departamento_codigo
          left join tbl_nodos tn on tn.tnd_id = tp.tps_nodo_id
          left join tbl_ruta_empresa_vias trev on trev.rev_id = tp.tps_via_id
          WHERE tre.tre_id_usuario = ${id} and tre.tre_codigo_unico_ruta = ${rutaId} ORDER By tp.tps_id desc`);
      } else {
        consulta = await Database.rawQuery(`SELECT
          tp.tps_id as parada_Id,
          tnd.tnd_id  as nodo_despacho_id,
          td.tdp_nombre as departamento,
          tm.tms_nombre as municipio,
          tcp.tcp_nombre as centro_Poblado,
          tcp.tcp_codigo_centro_poblado  as codigo_cp,
          tn.tnd_despacho_id as tipoLlegada_Id,
          tn.tnd_id as direccion_Id,
          trev.rev_id as via_id
            FROM
            tbl_ruta_empresas tre
          LEFT JOIN tbl_ruta_codigo_rutas trcr ON trcr.rcr_codigo_unico_ruta = tre.tre_codigo_unico_ruta
          left join tbl_nodos_despachos tnd on tnd.tnd_codigo_unico_ruta = trcr.rcr_codigo_unico_ruta
          inner join tbl_paradas tp on tp.tps_id = tnd_paradas_id
          left join tbl_centro_poblados tcp on tcp.tcp_codigo_centro_poblado = tp.tps_codigo_cp
          left join tbl_municipios tm on tm.tms_codigo_municipio = tcp.tcp_codigo_municipio
          left join tbl_departamentos td on td.tdp_codigo_departamento = tm.tms_departamento_codigo
          left join tbl_nodos tn on tn.tnd_id = tp.tps_nodo_id
          left join tbl_ruta_empresa_vias trev on trev.rev_id = tp.tps_via_id
          WHERE tre.tre_id_usuario = ${id} and tre.tre_codigo_unico_ruta = ${rutaId}
            LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`);
      }

      const paradas: RespuestaParadas[] = consulta.rows ?? [];

      const totalPages = Math.ceil(totalRecords / limite);
      const paginacion = {
        totalRegistros: totalRecords,
        paginaActual: pagina,
        totalPaginas: totalPages,
      };

      return { paradas, paginacion };
    } catch (error) {
      throw new Error(error);
    }
  }

  async visualizarClasesPorRuta(
    param: any
  ): Promise<{ clases: RespuestaClases[]; paginacion: Paginador }> {
    const { pagina, limite, rutaId, id} = param;
    try {
      const totalCountQuery = `SELECT COUNT(*) as total
      FROM tbl_ruta_empresas tre
      LEFT JOIN tbl_ruta_codigo_rutas trcr ON trcr.rcr_codigo_unico_ruta = tre.tre_codigo_unico_ruta
      left join tbl_ruta_vehiculos trv on trv.trv_codigo_unico_ruta = trcr.rcr_codigo_unico_ruta
      left join tbl_clase_vehiculos tcv on tcv.tcv_id = trv.trv_clase_vehiculo_id
      left join tbl_codigo_clase_por_grupos tccpg on tccpg.cpg_id = tcv.tcv_clase_por_grupo_id
      WHERE tre.tre_id_usuario = ${id} and tre.tre_codigo_unico_ruta = ${rutaId}`;

      const totalCountResult = await Database.rawQuery(totalCountQuery);
      const totalRecords = totalCountResult.rows[0].total;
      let consulta;
      if (!pagina && !limite) {
        consulta = await Database.rawQuery(`SELECT
          trv.trv_id as id_ruta_vehiculos,
          tccpg.cpg_id as clase_id,
          tccpg.cpg_descripcion as clase,
          tcv.tcv_id as tipo_vehiculo_id,
          tcv.tcv_estado as estado
          FROM
            tbl_ruta_empresas tre
          LEFT JOIN tbl_ruta_codigo_rutas trcr ON trcr.rcr_codigo_unico_ruta = tre.tre_codigo_unico_ruta
          inner join tbl_ruta_vehiculos trv on trv.trv_codigo_unico_ruta = trcr.rcr_codigo_unico_ruta
          left join tbl_clase_vehiculos tcv on tcv.tcv_id = trv.trv_clase_vehiculo_id
          left join tbl_codigo_clase_por_grupos tccpg on tccpg.cpg_id = tcv.tcv_clase_por_grupo_id
          WHERE tre.tre_id_usuario = ${id} and tre.tre_codigo_unico_ruta = ${rutaId} ORDER By tccpg.cpg_id desc`);
      } else {
        consulta = await Database.rawQuery(`SELECT
          trv.trv_id as id_ruta_vehiculos,
          tccpg.cpg_id as clase_id,
          tccpg.cpg_descripcion as clase,
          tcv.tcv_id as tipo_vehiculo_id,
          tcv.tcv_estado as estado
          FROM
            tbl_ruta_empresas tre
          LEFT JOIN tbl_ruta_codigo_rutas trcr ON trcr.rcr_codigo_unico_ruta = tre.tre_codigo_unico_ruta
          inner join tbl_ruta_vehiculos trv on trv.trv_codigo_unico_ruta = trcr.rcr_codigo_unico_ruta
          left join tbl_clase_vehiculos tcv on tcv.tcv_id = trv.trv_clase_vehiculo_id
          left join tbl_codigo_clase_por_grupos tccpg on tccpg.cpg_id = tcv.tcv_clase_por_grupo_id
          WHERE tre.tre_id_usuario = ${id} and tre.tre_codigo_unico_ruta = ${rutaId}
          LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`);
      }

      const clases: RespuestaClases[] = consulta.rows ?? [];

      const totalPages = Math.ceil(totalRecords / limite);
      const paginacion = {
        totalRegistros: totalRecords,
        paginaActual: pagina,
        totalPaginas: totalPages,
      };

      return { clases, paginacion };
    } catch (error) {
      throw new Error(error);
    }
  }

  async guardarDireccion(nodo: Nodo): Promise<any> {
    const nodoDb = new TblNodos();
    try {
      const existe = await TblNodos.query()
        .where({
          idDespacho: nodo.despachoId,
          descripcion: nodo.descripcion,
          direccion: nodo.direccion,
          codigoCp: nodo.codigoCentroPoblado,
        })
        .first();

      if (!existe) {
        nodoDb.establecerNodoDb(nodo);
        await nodoDb.save();
      }
    } catch (error) {
      throw new Error(error);
    }
    const nodosRespuesta = await TblNodos.query().where({
      idDespacho: nodo.despachoId,
      codigoCp: nodo.codigoCentroPoblado,
    });

    const respuestaDirecciones = nodosRespuesta.map((nodoR) => {
      return {
        id: nodoR.id,
        descripcion: nodoR.descripcion,
      };
    });
    return { respuestaDirecciones };
  }

  // guarda todo
  async guardar(rutaInfo: any, id: number) {
    const solicitud = await TblSolicitudes.query().where('vigiladoId', id).first();
    if (solicitud?.estado == 2 || solicitud?.estado == 7) this.servicioEstados.ActualizarEstado(solicitud?.id!, 3)
    try {
      const ruta = {
        id: rutaInfo.id,
        idRuta: rutaInfo.idRuta,
        idUnicoRuta: rutaInfo.idUnicoRuta,
        centroPobladoOrigen: rutaInfo.centroPobladoOrigen,
        centroPobladoDestino: rutaInfo.centroPobladoDestino,
        tipoLLegada: rutaInfo.tipoLLegada,
        idaOVuelta: 'A',
        direccion: rutaInfo.direccion,
        isAsignada:rutaInfo.isAsignada,
        isConvenio:rutaInfo.isConvenio,
        nueva: rutaInfo.nueva,
        fecha: rutaInfo.fecha,
        fechaConvenio: rutaInfo.fechaConvenio,
        convenio: rutaInfo.convenio,
        documento: rutaInfo.documento,
        nombreOriginal: rutaInfo.nombreOriginal,
        rutaArchivo: rutaInfo.rutaArchivo,
        documentoConvenio: rutaInfo.documentoConvenio,
        nombreOriginalConvenio: rutaInfo.nombreOriginalConvenio,
        rutaArchivoConvenio: rutaInfo.rutaArchivoConvenio,
        observacion: rutaInfo.observacion,
        rutaHabilitada: rutaInfo.rutaHabilitada,
        corresponde: rutaInfo.corresponde,
        resolucionActual: rutaInfo.resolucionActual,
      }
      await this.actualizarRuta(ruta, id)

      for (let via of rutaInfo.vias) {
        const viaRecibida = {
          id: via.id,
          codigoRuta: rutaInfo.idUnicoRuta,
          via: via.via,
          corresponde: via.corresponde,
          nuevaVia: via.viaNueva
        }
        await this.guardarVia(viaRecibida)
        for (let parada of via.paradas) {
          const paradaRecibida = {
            id: parada.id,
            idRuta: rutaInfo.idUnicoRuta,
            centroPobladoId: parada.centroPobladoId,
            direccionId: parada.direccionId,
            estado: parada.estado,
            idVia: via.id,
            nodoDespachoId: parada.nodoDespachoId
          }
          await this.guardarParadas(paradaRecibida)
        }
      }

      for (let clase of rutaInfo.clases) {
        const claseRecibida = {
          id: clase.id,
          idRuta: rutaInfo.idUnicoRuta,
          idClaseVehiculo: clase.idClaseVehiculo,
          estado: clase.estado,
        }
        await this.guardarClases(claseRecibida)
      }

      return { Message: "Ruta actualizada correctamente", Ruta: rutaInfo, editable: false };
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }

  async actualizarRuta(ruta: RespuestaRutas, id: number) {
    try {
      const rutaEmpresa = {
        idUsuario: id,
        idRuta: ruta.idUnicoRuta
      }
      const rutaDireccion = {
        idRuta: ruta.id,
        idNodo: ruta.direccion,
      };

      if (ruta.idaOVuelta == "A") {
        const rutaHabilitada = {
          idRuta: ruta.idUnicoRuta,
          resolucion: ruta.resolucion,
          resolucionActual: ruta.resolucionActual,
          direccionTerritorial: ruta.direccionTerritorial,
          fecha: ruta.fecha,
          fechaConvenio: ruta.fechaConvenio,
          convenio: ruta.convenio,
          documento: ruta.documento,
          nombreOriginal: ruta.nombreOriginal,
          rutaArchivo: ruta.rutaArchivo,
          documentoConvenio: ruta.documentoConvenio,
          nombreOriginalConvenio: ruta.nombreOriginalConvenio,
          rutaArchivoConvenio: ruta.rutaArchivoConvenio,
          observacion: ruta.observacion,
          corresponde: ruta.corresponde
        }

        const rutaRecibida = {
          codigoRuta: ruta.idRuta,
          IsAsignada: ruta.isAsignada,
          IsConvenio: ruta.isConvenio,
          nueva: ruta.nueva,
          estado: ruta.rutaHabilitada
        }

        await this.guardarRutaHabilitada(rutaHabilitada, ruta.idUnicoRuta);
        await this.guardarTablaRutas(rutaRecibida, ruta.idRuta);
      } else if (ruta.idaOVuelta == "B") {
        console.log(`no puede actualizar estos aspectos en la ruta de vuelta ${ruta.idaOVuelta}`);
      }
      await this.guardarRutaEmpresa(rutaEmpresa, ruta.idUnicoRuta);
      await this.guardarRutaDireccion(rutaDireccion, ruta.id);
      return console.log('ruta actualizada exitosamente');

    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }

  async guardarRuta(ruta: RespuestaRutas, id: number): Promise<{ rutaCreada: RespuestaRutas, ids: object }> {
    try {
      const ultimoIdCodigoRuta = await TblRutaCodigoRutas.query().orderBy("id", "desc").first();
      const ultimoIdRuta = await TblRutas.query().orderBy("trt_codigo_ruta", "desc").first();

      if (ultimoIdCodigoRuta?.id == null || ultimoIdRuta?.codigoRuta == null) {
        throw new Error(`No se puede guardar con codigo unico de ruta = ${ultimoIdCodigoRuta?.id} y codigo ruta ${ultimoIdRuta?.codigoRuta}, ${ultimoIdRuta?.id}`);
      }

      const nuevoIdCodigoRuta = ultimoIdCodigoRuta ? ultimoIdCodigoRuta.id + 1 : 1;
      const nuevoIdRuta = ultimoIdRuta ? ultimoIdRuta.codigoRuta + 1 : 1;

      const rutaCodigoRuta = {
        id: nuevoIdCodigoRuta,
        codigoRuta: nuevoIdRuta,
      };

      const rutaEmpresa = {
        idUsuario: id,
        idRuta: nuevoIdCodigoRuta,
      };

      const rutaIda = {
        codigoRuta: nuevoIdRuta,
        codigoCpOrigen: ruta.centroPobladoOrigen,
        codigoCpDestino: ruta.centroPobladoDestino,
        idaaVuelta: "A",
        isAsignada: ruta.isAsignada,
        isConvenio:ruta.isConvenio,
        nueva:ruta.nueva,
        estado: ruta.rutaHabilitada,
      };

      const rutaVuelta = {
        codigoRuta: nuevoIdRuta,
        codigoCpOrigen: ruta.centroPobladoDestino,
        codigoCpDestino: ruta.centroPobladoOrigen,
        isAsignada: ruta.isAsignada,
        isConvenio:ruta.isConvenio,
        nueva:ruta.nueva,
        idaaVuelta: "B",
        estado: ruta.rutaHabilitada,
      };
      const rutaHabilitada = {
        idRuta: nuevoIdCodigoRuta,
        resolucion: ruta.resolucion,
        resolucionActual: ruta.resolucionActual,
        direccionTerritorial: ruta.direccionTerritorial,
        fecha: ruta.fecha,
        fechaConvenio: ruta.fechaConvenio,
        convenio: ruta.convenio,
        documento: ruta.documento,
        nombreOriginal: ruta.nombreOriginal,
        rutaArchivo: ruta.rutaArchivo,
        documentoConvenio: ruta.documentoConvenio,
        nombreOriginalConvenio: ruta.nombreOriginalConvenio,
        rutaArchivoConvenio: ruta.rutaArchivoConvenio,
        observacion: ruta.observacion,
        corresponde: ruta.corresponde
      };

      const idRutaida = await this.guardarTablaRutas(rutaIda);
      const idRutaVuelta = await this.guardarTablaRutas(rutaVuelta);
      await this.guardarRutaCodigoRuta(rutaCodigoRuta);
      await this.guardarRutaHabilitada(rutaHabilitada);

      const rutaDireccion = {
        idRuta: idRutaida,
        idNodo: ruta.direccion,
      };

      const rutaDireccionVuelta = {
        idRuta: idRutaVuelta,
        idNodo: undefined,
      };

      await this.guardarRutaDireccion(rutaDireccion);
      await this.guardarRutaDireccion(rutaDireccionVuelta);

      await this.guardarRutaEmpresa(rutaEmpresa);

      const ids = {
        id: idRutaida,
        idRuta: nuevoIdRuta,
        idUnicoRuta: nuevoIdCodigoRuta
      }

      return { rutaCreada: ruta, ids: ids };
    } catch (error) {
      throw new Error(error);
    }
  }

  async guardarTablaRutas(ruta: Ruta, id?: number) {
    try {
      if (!id || id == undefined || id == 0) {
        const rutaDb = new TblRutas();
        rutaDb.establecerRuta(ruta);
        await rutaDb.save();
        return rutaDb.id
      } else {
        const rutasRetorno = await TblRutas.query().where('codigoRuta', id)
        await rutasRetorno.forEach(rutaRetorno => {
          rutaRetorno.establecerRutaConId(ruta)
          rutaRetorno.save()
        });
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  async guardarRutaCodigoRuta(rutaCodigoRuta: RutaCodigoRuta) {
    try {
      const rutaCodigoRutaDb = new TblRutaCodigoRutas();
      rutaCodigoRutaDb.establecerRutaCodigoRuta(rutaCodigoRuta);
      await rutaCodigoRutaDb.save();
    } catch (error) {
      throw new Error(error);
    }
  }

  async guardarRutaEmpresa(rutaEmpresa: RutaEmpresa, codigoUnicoRuta?: number) {
    try {
      if (!codigoUnicoRuta || codigoUnicoRuta == undefined || codigoUnicoRuta == 0) {
        const rutaEmpresaDb = new TblRutaEmpresas();
        rutaEmpresaDb.establecerRutaEmpresa(rutaEmpresa);
        await rutaEmpresaDb.save();
      } else {
        const rutaEmpresaRetorno = await TblRutaEmpresas.query().where('idRuta', codigoUnicoRuta).first()
        if (!rutaEmpresaRetorno) { throw new Error(`No se encontró una ruta empresa con idRuta: ${codigoUnicoRuta}`); }
        rutaEmpresaRetorno.establecerRutaEmpresaConId(rutaEmpresa);
        await rutaEmpresaRetorno.save();
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  async guardarVia(via: RutaEmpresaVia): Promise<{ via: RutaEmpresaVia }> {
    try {
      const viaRecibida = {
        id: via.id,
        codigoRuta: via.codigoRuta,
        via: via.via,
        codigoVia: via.codigoVia,
        corresponde: via.corresponde,
        nuevaVia: via.nuevaVia
      }
      await this.guardarRutaEmpresavia(viaRecibida)
      return { via: via }
    } catch (error) {
      return error
    }
  }

  async guardarRutaEmpresavia(rutaEmpresavia: RutaEmpresaVia) {
    try {
      if (!rutaEmpresavia) {
        throw new Error(`Faltan datos para crear o actualizar la via`);
      }
      if (!rutaEmpresavia.id || rutaEmpresavia.id == 0) {
        const rutaEmpresaviaDb = new TblRutaEmpresaVias();
        rutaEmpresaviaDb.establecerRutaEmpresaVia(rutaEmpresavia);
        await rutaEmpresaviaDb.save();
      } else {
        const rutaEmpresaviaRetorno = await TblRutaEmpresaVias.findBy('id', rutaEmpresavia.id)
        if (!rutaEmpresaviaRetorno) { throw new Error(`No se encontró una via con Id: ${rutaEmpresavia.id}`); }
        rutaEmpresaviaRetorno.establecerRutaEmpresaViaConId(rutaEmpresavia);
        await rutaEmpresaviaRetorno.save();
      }
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }

  async guardarRutaHabilitada(rutaHabilitada: RutaHabilitada, codigoUnicoRuta?: number) {
    try {
      if (!codigoUnicoRuta || codigoUnicoRuta == undefined || codigoUnicoRuta == 0) {
        const rutaHabilitadaDb = new TblRutaHabilitadas();
        rutaHabilitadaDb.establecerRutaHabilitada(rutaHabilitada);
        await rutaHabilitadaDb.save();
      } else {
        const rutaHabilitadaRetorno = await TblRutaHabilitadas.query().where('idRuta', codigoUnicoRuta).first()
        if (!rutaHabilitadaRetorno) { throw new Error(`No se encontró una ruta habilitada con idRuta: ${codigoUnicoRuta}`); }
        rutaHabilitadaRetorno.establecerRutaHabilitadaConId(rutaHabilitada);
        await rutaHabilitadaRetorno.save();
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  async guardarRutaDireccion(rutaDireccion: RutaDireccion, idRuta?: number) {
    try {
      if (!idRuta) {
        const rutaDireccionDb = new TblRutasDirecciones();
        rutaDireccionDb.establecerRutaDireccion(rutaDireccion);
        await rutaDireccionDb.save();
      } else {
        const rutaDireccionRetorno = await TblRutasDirecciones.query().where('idRuta', idRuta).first();
        if (!rutaDireccionRetorno) {
          console.log(`No se encontró una direccion con idRuta: ${idRuta}`);
          const rutaDireccionDb = new TblRutasDirecciones();
          rutaDireccionDb.establecerRutaDireccion(rutaDireccion);
          await rutaDireccionDb.save();
        } else {
          rutaDireccionRetorno.establecerRutaDireccionConid(rutaDireccion);
          await rutaDireccionRetorno.save();
        }
      }

    } catch (error) {
      throw new Error(error);
    }
  }

  async guardarParadas(parada: RespuestaParadas): Promise<{ parada: RespuestaParadas, nodoDespachoId: number }> {
    try {
      const paradaRecibida = {
        id: parada.id,
        codigoCp: parada.centroPobladoId,
        nodoId: parada.direccionId,
        idVia: parada.idVia
      }
      const idParada = await this.guardarParada(paradaRecibida)

      const nodoDespacho = {
        id: parada.nodoDespachoId,
        codigoUnicoRuta: parada.idRuta,
        idNodo: parada.direccionId,
        idParada: idParada,
        estado: parada.estado,
      };
      const nodoDespachoId = await this.guardarNodoDespacho(nodoDespacho)
      return { parada, nodoDespachoId: nodoDespachoId! }
    } catch (error) {
      throw new Error(error.message)
    }
  }

  async guardarNodoDespacho(nodoDespacho: NodoDespacho) {
    try {
      if (!nodoDespacho || nodoDespacho.idParada == 0 || nodoDespacho.codigoUnicoRuta == 0 || !nodoDespacho.codigoUnicoRuta || nodoDespacho.codigoUnicoRuta == undefined || !nodoDespacho.idParada || nodoDespacho.idParada == undefined) {
        throw new Error(`Faltan datos para crear o actualizar la parada de esa ruta`);
      }
      if (!nodoDespacho.id || nodoDespacho.id === 0) {
        const nodoDespachoDb = new TblNodosDespachos();
        nodoDespachoDb.establecerNodoDespacho(nodoDespacho);
        await nodoDespachoDb.save();
        return nodoDespachoDb.id
      } else {
        const nodoDespachoRetorno = await TblNodosDespachos.query().where('id', nodoDespacho.id!).first();
        console.log(`Nodo despacho encontrado: ${JSON.stringify(nodoDespachoRetorno)}`);
        if (!nodoDespachoRetorno) {
          throw new Error(`No se encontró una parada con id: ${nodoDespacho.id}`);
        }
        nodoDespachoRetorno.establecerNodoDespachoConId(nodoDespacho);
        await nodoDespachoRetorno.save();
        return nodoDespachoRetorno.id;
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  async guardarParada(parada: Parada) {
    try {
      if (!parada) {
        throw new Error(`Faltan datos para crear o actualizar la parada`);
      }
      console.log(`ID de parada: ${parada.id}`);
      if (!parada.id || parada.id === 0) {
        const paradaDb = new TblParadas();
        paradaDb.establecerParada(parada);
        await paradaDb.save();
        return paradaDb.id;
      } else {
        const paradaRetorno = await TblParadas.query().where('id', parada.id).first();
        console.log(`Parada encontrada: ${JSON.stringify(paradaRetorno)}`);
        if (!paradaRetorno) {
          throw new Error(`No se encontró una parada con id: ${parada.id}`);
        }
        paradaRetorno.establecerParadaConId(parada);
        await paradaRetorno.save();
        return paradaRetorno.id;
      }
    } catch (error) {
      throw new Error(error);
    }
  }
  async guardarClases(clase: ClaseVehiculo): Promise<RespuestaClases> {
    try {
      const claseVehiculo = {
        id: clase.id,
        idRuta: clase.idRuta,
        idClaseVehiculo: clase.idClaseVehiculo,
        estado: clase.estado,
      };
      await this.guardarRutaVehiculo(claseVehiculo)
      return clase
    } catch (error) {
      throw new Error(error.message)
    }
  }

  async guardarRutaVehiculo(rutaVehiculo: ClaseVehiculo) {
    try {
      if (!rutaVehiculo ||
        !rutaVehiculo.idRuta ||
        !rutaVehiculo.idClaseVehiculo ||
        !rutaVehiculo.estado) {
        throw new Error(`Faltan datos para crear o actualizar la clase de vehículos de esa ruta`);
      }
      if (!rutaVehiculo.id) {
        const rutaVehiculoDb = new TblRutaVehiculos();
        rutaVehiculoDb.establecerRutaVehiculo(rutaVehiculo);
        await rutaVehiculoDb.save();
      } else {
        const rutaVehiculoRetorno = await TblRutaVehiculos.query().where('id', rutaVehiculo.id).first();
        console.log(`Resultado de la consulta: ${JSON.stringify(rutaVehiculoRetorno)}`);
        if (!rutaVehiculoRetorno) {
          throw new Error(`No se encontró una ruta con clase de vehículo con id: ${rutaVehiculo.id}`);
        }
        rutaVehiculoRetorno.establecerRutaVehiculoConId(rutaVehiculo);
        await rutaVehiculoRetorno.save();
      }
    } catch (error) {
      throw new Error(`Error al guardar la ruta de vehículo: ${error.message}`);
    }
  }

  async enviarSt(
    param: any) {
    try {
      const { vigiladoId } = param
      const { rutasVigilado } = await this.visualizarRutasVigilado(param)
      let aprobado = true;
      const faltantes = new Array();
      for await (const ruta of rutasVigilado) {
        if (ruta.rutas.idCodigoUnicoRuta) {
          // console.log({ CodigoUnicoRuta: ruta.rutas.idCodigoUnicoRuta , idRuta: ruta.rutas?.idRuta, codigoRuta: ruta.rutas?.idCodigoRuta});
          const { clases } = await this.visualizarClasesPorRuta({ rutaId: ruta.rutas.idCodigoUnicoRuta, id:vigiladoId })
          const params = {
            idRuta: ruta.rutas.idRuta, codigoUnicoRuta: ruta.rutas.idCodigoUnicoRuta, vigiladoId
          }
          const rutaVigilado = await this.visualizarRuta(params)
          let porLlenar = false;
          let clasesFaltantes = false;
          let viasFaltantes = false;
          let rutasFaltantes = false;

          if (rutaVigilado.rutaActiva) {
          if (clases.length === 0) {
            clasesFaltantes = true;
            porLlenar = true;
          }

          if (rutaVigilado.vias.length === 0) {
            viasFaltantes = true;
            porLlenar = true;
          }else{
            for await (const via of rutaVigilado.vias){
              if(via.corresponde == null){
                viasFaltantes = true;
                porLlenar = true;
              }else if(via.corresponde == 2){
                  if(via.viaNueva === ''){
                    viasFaltantes = true;
                    porLlenar = true;
                  }
              }
            }
          }

          if (rutaVigilado.idTipoLlegada == null || rutaVigilado.idTipoLlegada == '') {
            porLlenar = true;
            rutasFaltantes = true;
          }

          if (rutaVigilado.Iddireccion == null || rutaVigilado.Iddireccion == '') {
            porLlenar = true;
            rutasFaltantes = true;
          }

            if (rutaVigilado.corresponde == 2) {
              if (rutaVigilado.resolucionActual == null || rutaVigilado.resolucionActual == '') {
                porLlenar = true;
                rutasFaltantes = true;
              }
              if (rutaVigilado.documento == null || rutaVigilado.documento == '') {
                porLlenar = true;
                rutasFaltantes = true;
              }
            }
          } else {
              if (rutaVigilado.resolucionActual == null || rutaVigilado.resolucionActual == '') {
                porLlenar = true;
                rutasFaltantes = true;
              }
              if (rutaVigilado.documento == null || rutaVigilado.documento == '') {
                porLlenar = true;
                rutasFaltantes = true;
              }
          }
          if (porLlenar) {
            faltantes.push({
              idRuta: ruta.rutas.idRuta,
              clasesFaltantes,
              viasFaltantes,
              rutasFaltantes
            })
            aprobado = false
          }
        }
      }
       if (aprobado) {
         const solicitud = await TblSolicitudes.query().where('vigiladoId', vigiladoId).first();
         this.servicioEstados.ActualizarEstado(solicitud?.id!, 1)
       }
      return { faltantes, aprobado }
    } catch (error) {
      throw new Error(`Error al enviar a ST: ${error.message}`);
    }
  }

  async visualizarRutasVigilado(
    param: any
  ): Promise<{ rutasVigilado: any[]; paginacion: Paginador, editable: boolean, verificacionVisible: boolean, verificacionEditable: boolean }> {
    const { pagina, limite, vigiladoId } = param;
    let editable = false;
    let verificacionVisible = false;
    let verificacionEditable = false;
    try {

      const solicitud = await TblSolicitudes.query().where('vigiladoId', vigiladoId).first();
      if (!solicitud) {
        const nuevaSolicitiud = new TblSolicitudes()
        nuevaSolicitiud.vigiladoId = vigiladoId;
        nuevaSolicitiud.estado = 2
        await nuevaSolicitiud.save()

        const estados = await this.servicioEstados.consultarEditable(2, 3);
        editable = estados.editable
        verificacionVisible = estados.verificacionVisible
        verificacionEditable = estados.verificacionEditable
        //solicitudId = nuevaSolicitiud.id

      } else {
        const estados = await this.servicioEstados.consultarEditable(solicitud.estado, 3, solicitud.estadoVeri);
        editable = estados.editable
        verificacionVisible = estados.verificacionVisible
        verificacionEditable = estados.verificacionEditable
        //solicitudId = solicitud.id
      }
      this.servicioEstados.Log(vigiladoId, 2);

      const consulta = TblRutaEmpresas.query().preload('codigoUnicoRuta', sqlcodigoRuta => {
        sqlcodigoRuta.preload('ruta', sqlruta => {
          sqlruta.preload('cpOrigen', sqlCentroOrigen => {
            sqlCentroOrigen.preload('municipio', sqlmunicipioOri => {
              sqlmunicipioOri.preload('departamento')
            })
          }).preload('cpDestino', sqlCentroDestino => {
            sqlCentroDestino.preload('municipio', sqlmunicipioDesti => {
              sqlmunicipioDesti.preload('departamento')
            })
          }).where('idaaVuelta', 'A')
        }).preload('rutaVias')
      }).where('idUsuario', vigiladoId).orderBy('id', 'desc')

      let consultaDb;
      if (pagina && limite) {
        consultaDb = await consulta.paginate(pagina, limite);
      } else {
        consultaDb = await consulta;
      }

      const rutasVigilado = (consultaDb.rows || consultaDb).map(sqlRuta => {
        let rutas = new Object();
        const idRuta = sqlRuta.codigoUnicoRuta.id
        const numeroVias = sqlRuta.codigoUnicoRuta.rutaVias.length
        sqlRuta.codigoUnicoRuta.ruta.forEach((ruta) => {
          rutas = {
            numeroVias: numeroVias,
            idCodigoUnicoRuta: idRuta,
            idCodigoRuta: sqlRuta.codigoUnicoRuta.codigoRuta,
            idRuta: ruta.id,
            nueva: ruta.nueva,
            codCpOrigen: ruta.codigoCpOrigen,
            descripcionOrigen: ruta.cpOrigen.nombre,
            CoddepartamentoOrigen: ruta.cpOrigen.municipio.departamento.codigoDepartamento,
            departamentoOrigen: ruta.cpOrigen.municipio.departamento.nombre,
            CodmunicipioOrigen: ruta.cpOrigen.municipio.codigoMunicipio,
            municipioOrigen: ruta.cpOrigen.municipio.nombre,
            codCpDestino: ruta.codigoCpDestino,
            descripcionDestino: ruta.cpDestino.nombre,
            CoddepartamentoDestino: ruta.cpDestino.municipio.departamento.codigoDepartamento,
            departamentoDestino: ruta.cpDestino.municipio.departamento.nombre,
            CodmunicipioDestino: ruta.cpDestino.municipio.codigoMunicipio,
            municipioDestino: ruta.cpDestino.municipio.nombre,
          }
        })
        return {
          rutas: rutas
        }
      })
      const paginacion = MapeadorPaginacionDB.obtenerPaginacion(consultaDb)
      return { rutasVigilado, paginacion, editable, verificacionVisible, verificacionEditable };
    } catch (error) {
      throw new Error(error);
    }
  }

  async visualizarRuta(param: any): Promise<any> {
    try {
      const { idRuta, codigoUnicoRuta, vigiladoId } = param;
      const consulta = TblRutaEmpresas.query().preload('codigoUnicoRuta', sqlCodigoUnico => {
        sqlCodigoUnico.preload('ruta', sqlRuta => {
          sqlRuta.preload('rutaDireccion')
          sqlRuta.preload('cpOrigen', sqlCpOrigen => {
            sqlCpOrigen.preload('municipio', sqlMunicipio => {
              sqlMunicipio.preload('departamento')
            })
          })
          sqlRuta.preload('cpDestino', sqlDestino => {
            sqlDestino.preload('municipio', sqlMunicipioDestino => {
              sqlMunicipioDestino.preload('departamento')
            })
          })
          sqlRuta.where('id', idRuta)
        })
        sqlCodigoUnico.whereHas('ruta', sqlRuta => {
          sqlRuta.where('id', idRuta)
        })
        sqlCodigoUnico.preload('rutasHabilitada').preload('rutaVias')
        sqlCodigoUnico.where('id', codigoUnicoRuta)
      }).where('idUsuario', vigiladoId).where('idRuta', codigoUnicoRuta).first()

      const consultaDb = await consulta;
      const vias = new Array()
      consultaDb!.codigoUnicoRuta.rutaVias.forEach((via) => {
        vias.push({
          id: via.id,
          via: via.via,
          corresponde: via.corresponde,
          viaNueva: via.nuevaVia
        })
      })
      const rutaDb = consultaDb!.codigoUnicoRuta.ruta[0]
      let nodos;
      if (rutaDb.rutaDireccion?.idNodo) {
        nodos = await TblNodos.query().where('id', rutaDb.rutaDireccion.idNodo).first()
      }
      const ruta = {
        idRuta: rutaDb.id,
        idCodigoRuta: rutaDb.codigoRuta,
        idCodigoUnicoRuta: consultaDb!.idRuta,
        rutaActiva: rutaDb.estado,
        nueva: rutaDb.nueva,
        isAsignada: rutaDb.isAsignada,
        isConvenio: rutaDb.isConvenio,
        idTipoLlegada: nodos?.idDespacho ?? null,
        CoddepartamentoOrigen: rutaDb.cpOrigen.municipio.departamento.codigoDepartamento,
        CoddepartamentoDestino: rutaDb.cpDestino.municipio.departamento.codigoDepartamento,
        CodmunicipioOrigen: rutaDb.cpOrigen.municipio.codigoMunicipio,
        CodmunicipioDestino: rutaDb.cpDestino.municipio.codigoMunicipio,
        codCpOrigen: rutaDb.codigoCpOrigen,
        codCpDestino: rutaDb.codigoCpDestino,
        Iddireccion: rutaDb.rutaDireccion?.idNodo ?? null,
        resolucion: consultaDb!.codigoUnicoRuta.rutasHabilitada.resolucion,
        corresponde: consultaDb!.codigoUnicoRuta.rutasHabilitada.corresponde,
        resolucionActual: consultaDb!.codigoUnicoRuta.rutasHabilitada.resolucionActual,
        documento: consultaDb!.codigoUnicoRuta.rutasHabilitada.documento,
        nombreOriginal: consultaDb!.codigoUnicoRuta.rutasHabilitada.nombreOriginal,
        rutaDocumento: consultaDb!.codigoUnicoRuta.rutasHabilitada.rutaArchivo,
        documentoConvenio: consultaDb!.codigoUnicoRuta.rutasHabilitada.documentoConvenio,
        nombreOriginalConvenio: consultaDb!.codigoUnicoRuta.rutasHabilitada.nombreOriginalConvenio,
        rutaArchivoConvenio: consultaDb!.codigoUnicoRuta.rutasHabilitada.rutaArchivoConvenio,
        convenio: consultaDb!.codigoUnicoRuta.rutasHabilitada.convenio,
        fecha: consultaDb!.codigoUnicoRuta.rutasHabilitada.fecha,
        fechaConvenio: consultaDb!.codigoUnicoRuta.rutasHabilitada.fechaConvenio,
        observacion:consultaDb!.codigoUnicoRuta.rutasHabilitada.observacion,
        vias: vias
      }
      return ruta
    } catch (error) {
      throw new error(error)
    }
  }

  async eliminarClase(id: number): Promise<any> {
    try {
      const clase = await TblRutaVehiculos.findBy('id', id)
      if (!clase) {
        console.log('no existe esa clase de vehiculo');
      }
      clase?.delete()
      return { message: 'Clase eliminada exitosamente', clase }
    } catch (error) {
      return error
    }
  }

  async eliminarParada(param: any): Promise<any> {
    const { idParada, nodoDespachoId } = param
    try {
      if (!idParada || !nodoDespachoId) {
        throw new error('faltan dato para eliminar la parada');
      }
      const parada = await TblParadas.findBy('id', idParada)
      const nodoDespacho = await TblNodosDespachos.findBy('id', nodoDespachoId)
      if (!parada || !nodoDespacho) {
        throw new error(`error al validar los registros de parada = ${parada} y nodos despacho = ${nodoDespacho}`);
      }
      nodoDespacho?.delete()
      parada?.delete()
      return { message: 'Parada eliminada exitosamente', parada }
    } catch (error) {
      return error
    }
  }

  async eliminarVia(param: any): Promise<any> {
    const { idVia } = param;
    try {
      if (!idVia) {
        throw new Error('Faltan datos para eliminar la vía');
      }
      const via = await TblRutaEmpresaVias.findBy('id', idVia);
      if (!via) {
        throw new Error(`No existe la vía con id ${idVia}`);
      }
      await via.delete();
      return { message: 'Vía eliminada exitosamente', via };

    } catch (error) {
      return { message: 'Error al eliminar la vía', error: error.message };
    }
  }

  async eliminarRuta(param: any): Promise<any> {
    const { codigoUnicoRuta, vigiladoId } = param;
    try {
      if (!codigoUnicoRuta || !vigiladoId) {
        throw new Error('Faltan datos para eliminar la ruta');
      }
      const ruta = await TblRutaEmpresas.query()
      .preload('codigoUnicoRuta', sqlCodigoUnico =>{
        sqlCodigoUnico.preload('ruta', sqlRuta =>{
          sqlRuta.where('nueva',true)
        })
      })
      .where('idUsuario', vigiladoId).where('idRuta', codigoUnicoRuta).first();
      if (!ruta) {
        throw new Error(`No existe la ruta con codigo ${codigoUnicoRuta}`);
      }

      const rutaEliminar = await TblRutaCodigoRutas.findBy('id', codigoUnicoRuta)
      if (!rutaEliminar) {
        throw new Error(`No existe la ruta con codigo ${codigoUnicoRuta}`);
      }
      const codigoRuta = rutaEliminar.codigoRuta;

      const rutas  = await TblRutas.query().where('codigoRuta', codigoRuta)
      await rutaEliminar.delete();
      for await (const ruta of rutas){
        await ruta.delete();
      }
      return { message: 'Ruta eliminada exitosamente', ruta };

    } catch (error) {
      return { message: 'Error al eliminar la ruta', error: error.message };
    }
  }

}
