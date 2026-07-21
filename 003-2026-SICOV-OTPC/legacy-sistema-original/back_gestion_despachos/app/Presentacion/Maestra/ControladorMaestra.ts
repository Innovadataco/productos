/* eslint-disable @typescript-eslint/naming-convention */
import type { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Database from "@ioc:Adonis/Lucid/Database";
import Env from "@ioc:Adonis/Core/Env";
import TblAlistamiento from "App/Infraestructura/Datos/Entidad/Alistamiento";
import TblCentroPoblados from "App/Infraestructura/Datos/Entidad/CentroPoblado";
import TblClaseVehiculos from "App/Infraestructura/Datos/Entidad/ClaseVehiculos";
import TblCodigoClasePorGrupos from "App/Infraestructura/Datos/Entidad/CodigoClaseGrupos";
import TblCorrectivo from "App/Infraestructura/Datos/Entidad/Correctivo";
import TblDepartamentos from "App/Infraestructura/Datos/Entidad/Departamentos";
import TblMantenimiento from "App/Infraestructura/Datos/Entidad/Mantenimiento";
import TblMunicipios from "App/Infraestructura/Datos/Entidad/Municipios";
import TblNodos from "App/Infraestructura/Datos/Entidad/Nodos";
import TblPreventivo from "App/Infraestructura/Datos/Entidad/Preventivos";
import TblRutaCodigoRutas from "App/Infraestructura/Datos/Entidad/RutaCodigoRutas";
import TblRutaEmpresas from "App/Infraestructura/Datos/Entidad/RutaEmpresa";
import TblRutas from "App/Infraestructura/Datos/Entidad/Rutas";
import TblTerminales from "App/Infraestructura/Datos/Entidad/Terminales";
import TblTipoDespachos from "App/Infraestructura/Datos/Entidad/TipoDespacho";
import TblUsuarios from "App/Infraestructura/Datos/Entidad/Usuario";
import { MapeadorPaginacionDB } from "App/Infraestructura/Implementacion/Lucid/MapeadorPaginacionDB";
import { id, sv } from "date-fns/locale";
export default class ControladorMaestra {

  /**
   * Ajusta una fecha restando las horas configuradas en TIMEZONE_OFFSET_HOURS
   * para convertir a la zona horaria de Colombia
   */
  private adjustDateToColombiaTimezone(date: Date): Date {
    const offsetHours = parseInt(Env.get('TIMEZONE_OFFSET_HOURS', '5'));
    return new Date(date.getTime() - (offsetHours * 60 * 60 * 1000));
  }

  public async departamentos({ request }: HttpContextContract) {
    const departamentos = await TblDepartamentos.query().orderBy('nombre', 'asc');;

    try {
      const respuestaDepartamentos = departamentos.map((departamento) => {
        return {
          id: departamento.id,
          codigoDepartamento: departamento.codigoDepartamento,
          nombre: departamento.nombre,
        };
      });
      return { respuestaDepartamentos };
    } catch (error) {
      return { message: "No se pudieron obtener los departamentos" };
    }
  }

  public async municipios({ request }: HttpContextContract) {
    const codigoDepartamento = request.input("codigoDepartamento");
    try {
      const municipios = await TblMunicipios.query().where(
        "tms_departamento_codigo",
        codigoDepartamento
      ).orderBy('nombre', 'asc');
      const respuestaMunicipios = municipios.map((municipio) => {
        return {
          id: municipio.id,
          codigoMunicipio: municipio.codigoMunicipio,
          nombre: municipio.nombre,
        };
      });
      return { respuestaMunicipios };
    } catch (error) {
      return { message: "Municipios no encontrados" };
    }
  }

  public async centrosPoblados({ request }: HttpContextContract) {
    const codigoMunicipio = request.input("codigoMunicipio");
    try {
      const centrosPoblados = await TblCentroPoblados.query().where(
        "tcp_codigo_municipio",
        codigoMunicipio
      ).orderBy('nombre', 'asc');
      const respuestaCentrosPoblados = centrosPoblados.map((centroPoblado) => {
        return {
          id: centroPoblado.id,
          codigoCentroPoblado: centroPoblado.codigoCentroPoblado,
          nombre: centroPoblado.nombre,
        };
      });
      return { respuestaCentrosPoblados };
    } catch (error) {
      return { message: "Centros Poblados no encontrados" };
    }
  }

  public async tipoLlegada({ request }: HttpContextContract) {
    const tipoDespacho = await TblTipoDespachos.all();

    try {
      const respuestaTipoLLegada = tipoDespacho.map((tipoDespacho) => {
        return {
          id: tipoDespacho.id,
          descripcion: tipoDespacho.descripcion,
        };
      });
      return { respuestaTipoLLegada };
    } catch (error) {
      return { message: "No se pudieron obtener los tipos de llegada" };
    }
  }

  public async tipovehiculo({ request }: HttpContextContract) {
    const idClasePorGrupo = request.input("idClasePorGrupo");
    const tiposvehiculos = await TblClaseVehiculos.query().where(
      "tcv_clase_por_grupo_id",
      idClasePorGrupo
    );
    try {
      const respuestaTiposvehiculos = tiposvehiculos.map((tipovehiculo) => {
        return {
          id: tipovehiculo.id,
          descripcion: tipovehiculo.descripcion,
          idClasePorGrupo: tipovehiculo.idClasePorGrupo,
        };
      });
      return { respuestaTiposvehiculos };
    } catch (error) {
      return { message: "No se pudieron obtener los tipos de vehiculos" };
    }
  }

  public async clasePorGrupo({ request }: HttpContextContract) {
    const clasesPorGrupos = await TblCodigoClasePorGrupos.all();
    try {
      const respuestaclasesPorGrupos = clasesPorGrupos.map((clasePorGrupo) => {
        return {
          id: clasePorGrupo.id,
          descripcion: clasePorGrupo.descripcion,
        };
      });
      return { respuestaclasesPorGrupos };
    } catch (error) {
      return { message: "No se pudieron obtener los tipos de vehiculos" };
    }
  }

  public async nodos({ request }: HttpContextContract) {
    const codigoTipollegada = request.input("codigoTipollegada");
    const codigoCentroPoblado = request.input("codigoCp");
    try {
      const direcciones = await TblNodos.query().where({
        idDespacho: codigoTipollegada,
        codigoCp: codigoCentroPoblado,
      });

      const respuestaDirecciones = direcciones.map((nodo) => {
        return {
          id: nodo.id,
          descripcion: nodo.descripcion,
        };
      });
      return { respuestaDirecciones };
    } catch (error) {
      return { message: "No se pudieron obtener las direcciones" };
    }
  }

  public async listarNodos({ request }: HttpContextContract) {
    try {
      const direcciones = await TblNodos.query();
      const respuestaDirecciones = direcciones.map((nodo) => {
        return {
          codCpNodo: nodo.codigoCp,
          razonSocial: nodo.descripcion,
        };
      });
      return { respuestaDirecciones };
    } catch (error) {
      return { message: "No se pudieron obtener las direcciones" };
    }
  }

  public async listarEmpresas({ request }: HttpContextContract) {
    try {
      const empresas = await TblUsuarios.query().where("idRol", 3);
      const respuestaEmpresas = empresas.map((empresa) => {
        return {
          id: empresa.id,
          nit: empresa.identificacion,
          razonSocial: empresa.nombre,
        };
      });
      return { respuestaEmpresas };
    } catch (error) {
      return { message: "No se pudieron obtener las empresas" };
    }
  }

  public async rutasActivasPorEmpresa({ request }: HttpContextContract) {
  const {nit} = request.all();
    try {
      const query = await TblUsuarios.query().preload("empresas",(sqlEmpresa) => {
          sqlEmpresa.preload("codigoUnicoRuta", (sqlcodigo) => {
            sqlcodigo.preload("ruta", (sqlruta) => {
              sqlruta
                .preload("cpOrigen", (sqlOrigen) => {
                  sqlOrigen.preload("municipio", (sqlMunicipioO) => {
                    sqlMunicipioO.preload("departamento");
                  });
                  sqlOrigen.preload('terminal_rel');
                })
                .preload("cpDestino", (sqlDestino) => {
                  sqlDestino.preload("municipio", (sqlMunicipioD) => {
                    sqlMunicipioD.preload("departamento");
                  });
                  sqlDestino.preload('terminal_rel');
                });
              sqlruta.where("trt_estado", true);
              sqlruta.where("trt_ida_vuelta", "A");
            });
            sqlcodigo.preload('rutaVias')
          });
        }
      ).where("identificacion", nit).first();


      const rutas = new Array();
      query?.empresas.forEach((empresa) => {
        empresa.codigoUnicoRuta.ruta.forEach((ruta) => {
            const rutaExiste = rutas.find((rutaExiste) => rutaExiste.idRuta === ruta.id);
            if (!rutaExiste) {
            rutas.push({
              idRuta: ruta.id,
              codOrigen: ruta.codigoCpOrigen,
              descripcionOrigen: ruta.cpOrigen.nombre,
              departamentoOrigen: ruta.cpOrigen.municipio.departamento.nombre,
              municipioOrigen: ruta.cpOrigen.municipio.nombre,
              codDestino: ruta.codigoCpDestino,
              descripcionDestino: ruta.cpDestino.nombre,
              departamentoDestino: ruta.cpDestino.municipio.departamento.nombre,
              municipioDestino: ruta.cpDestino.municipio.nombre,
              nitTerminalOrigen: ruta.cpOrigen?.terminal_rel?.nit || null,
              terminalOrigen: ruta.cpOrigen?.terminal_rel?.nombre || null,
              nitTerminalDestino: ruta.cpDestino?.terminal_rel?.nit || null,
              terminalDestino: ruta.cpDestino?.terminal_rel?.nombre || null,
              via: empresa.codigoUnicoRuta.rutaVias.map((sVia)=>{
                return {
                  id: sVia.id,
                  codigoVia: sVia.codigoVia,
                  via: sVia.via
                }
              })
            });
          }
          });
        });

      return {rutas}
    } catch (error) {
      console.log("Error al obtener rutas activas por empresa:", error);

      return { message: "No se pudieron obtener las rutas activas" };
    }

  }

  public async rutasEmpresas({ request }: HttpContextContract) {
    try {
      const { pagina, limite } = request.all();

      const query = await TblUsuarios.query()
        .preload("empresas", (sqlEmpresa) => {
          sqlEmpresa.preload("codigoUnicoRuta", (sqlcodigo) => {
            sqlcodigo.preload("ruta", (sqlruta) => {
              sqlruta
                .preload("cpOrigen", (sqlOrigen) => {
                  sqlOrigen.preload("municipio", (sqlMunicipioO) => {
                    sqlMunicipioO.preload("departamento");
                  });
                })
                .preload("cpDestino", (sqlDestino) => {
                  sqlDestino.preload("municipio", (sqlMunicipioD) => {
                    sqlMunicipioD.preload("departamento");
                  });
                });
            });
          });
        })
        .paginate(pagina, limite);

      const paginacion = MapeadorPaginacionDB.obtenerPaginacion(query);
      const empresas = query.all().map((consulta) => {
        const rutas = new Array();
        consulta.empresas.forEach((empresa) => {
          const idRuta = empresa.codigoUnicoRuta.id;
          empresa.codigoUnicoRuta.ruta.forEach((ruta) => {
            rutas.push({
              idRuta: ruta.id,
              codigoUnicoRuta: idRuta,
              codOrigen: ruta.codigoCpOrigen,
              descripcionOrigen: ruta.cpOrigen.nombre,
              departamentoOrigen: ruta.cpOrigen.municipio.departamento.nombre,
              municipioOrigen: ruta.cpOrigen.municipio.nombre,
              codDestino: ruta.codigoCpDestino,
              descripcionDestino: ruta.cpDestino.nombre,
              departamentoDestino: ruta.cpDestino.municipio.departamento.nombre,
              municipioDestino: ruta.cpDestino.municipio.nombre,
            });
          });
        });

        return {
          idEmpresa: consulta.id,
          nit: consulta.identificacion,
          razonSocial: consulta.nombre,
          rutas: rutas,
        };
      });
      return { empresas, paginacion };
    } catch (error) {
      return { message: "No se pudieron obtener las rutas activas" };
    }
  }

  public async listarRutas({ request }: HttpContextContract) {
    try {
      const { terminal, pagina, limite } = request.all();

      // Construir la consulta SQL base
      let sqlQuery = `
        select
	tr.trt_id as id,
	tr.trt_codigo_cp_origen as codigo_origen,
	c.tcp_nombre as descripcion_origen,
	tdo.tdp_nombre as departamento_origen,
	tmo.tms_nombre as municipio_origen,
	tr.trt_codigo_cp_destino as codigo_destino,
	cp.tcp_nombre as descripcion_destino,
	tdd.tdp_nombre as departamento_destino,
	tmd.tms_nombre as municipio_destino,
    tre.tre_codigo_unico_ruta as codigo_ruta,
    tr.trt_nueva as nueva
FROM tbl_usuarios tu
INNER JOIN tbl_ruta_empresas tre ON tre.tre_id_usuario = tu.usn_id  -- Solo usuarios con código
inner join tbl_ruta_codigo_rutas trcr on tre.tre_codigo_unico_ruta = trcr.rcr_codigo_unico_ruta
inner join tbl_rutas tr on tr.trt_codigo_ruta = trcr.rcr_codigo_ruta
inner join tbl_centro_poblados c on c.tcp_codigo_centro_poblado = tr.trt_codigo_cp_origen
inner join tbl_centro_poblados cp on cp.tcp_codigo_centro_poblado = tr.trt_codigo_cp_destino
inner join tbl_municipios tmo on c.tcp_codigo_municipio = tmo.tms_codigo_municipio
inner join tbl_departamentos tdo on tdo.tdp_codigo_departamento = tmo.tms_departamento_codigo
inner join tbl_municipios tmd on cp.tcp_codigo_municipio = tmd.tms_codigo_municipio
inner join tbl_departamentos tdd on tdd.tdp_codigo_departamento = tmd.tms_departamento_codigo
WHERE tu.usn_correo NOT IN ('andresmedina@supertransporte.gov.co', 'pruebassuperp@gmail.com')
AND tu.usn_rol_id = 3
and tr.trt_ida_vuelta = 'A'
      `;

      // Aplicar filtro por terminal si se proporciona
      if (terminal) {
        sqlQuery += ` AND c.terminal = '${terminal}'`;
      }

      sqlQuery += ` ORDER BY tu.usn_nombre ASC`;

      // Determinar si se debe usar paginación
      const usarPaginacion = pagina !== undefined && limite !== undefined;
      let rutasQuery = sqlQuery;

      if (usarPaginacion) {
        // Calcular offset para paginación
        const offset = (pagina - 1) * limite;
        rutasQuery += ` LIMIT ${limite} OFFSET ${offset}`;
      }

      // Ejecutar consulta
      const rutasResult = await Database.rawQuery(rutasQuery);

      // Obtener total solo si se usa paginación
      let total = 0;
      let paginacion: any = null;

      if (usarPaginacion) {
        // Consulta para obtener el total de registros
        const countQuery = `
          SELECT COUNT(*) as total
          FROM tbl_usuarios tu
  INNER JOIN tbl_ruta_empresas tre ON tre.tre_id_usuario = tu.usn_id  -- Solo usuarios con código
  inner join tbl_ruta_codigo_rutas trcr on tre.tre_codigo_unico_ruta = trcr.rcr_codigo_unico_ruta
  inner join tbl_rutas tr on tr.trt_codigo_ruta = trcr.rcr_codigo_ruta
  inner join tbl_centro_poblados c on c.tcp_codigo_centro_poblado = tr.trt_codigo_cp_origen
  inner join tbl_centro_poblados cp on cp.tcp_codigo_centro_poblado = tr.trt_codigo_cp_destino
  inner join tbl_municipios tmo on c.tcp_codigo_municipio = tmo.tms_codigo_municipio
  inner join tbl_departamentos tdo on tdo.tdp_codigo_departamento = tmo.tms_departamento_codigo
  inner join tbl_municipios tmd on cp.tcp_codigo_municipio = tmd.tms_codigo_municipio
  inner join tbl_departamentos tdd on tdd.tdp_codigo_departamento = tmd.tms_departamento_codigo
  WHERE tu.usn_correo NOT IN ('andresmedina@supertransporte.gov.co', 'pruebassuperp@gmail.com')
  AND tu.usn_rol_id = 3
  and tr.trt_ida_vuelta = 'A'
          ${terminal ? `AND c.terminal = '${terminal}'` : ''}
        `;

        const countResult = await Database.rawQuery(countQuery);
        total = countResult.rows?.[0]?.total || 0;

        // Crear objeto de paginación
        paginacion = {
          paginaActual: Number(pagina),
          elementosPorPagina: Number(limite),
          totalElementos: Number(total),
          totalPaginas: Math.ceil(Number(total) / Number(limite)),
          hayPaginaAnterior: Number(pagina) > 1,
          hayPaginaSiguiente: Number(pagina) < Math.ceil(Number(total) / Number(limite))
        };
      }

      // Mapear los resultados
      const rutas = rutasResult.rows?.map((row: any) => ({
        idRuta: row.id,
        codOrigen: row.codigo_origen,
        descripcionOrigen: row.descripcion_origen,
        departamentoOrigen: row.departamento_origen,
        municipioOrigen: row.municipio_origen,
        codDestino: row.codigo_destino,
        descripcionDestino: row.descripcion_destino,
        departamentoDestino: row.departamento_destino,
        municipioDestino: row.municipio_destino
      })) || [];

      // Retornar con o sin paginación según corresponda
      return usarPaginacion ? { rutas, paginacion } : { rutas };
    } catch (error) {
      console.error('Error en listarRutas:', error);
      return { message: "No se pudieron obtener las rutas activas" };
    }
  }

  async ConsultarRuta({ request }: HttpContextContract): Promise<any> {
    const { idRuta, codigoUnicoRuta } = request.all();

    const consulta = TblRutaEmpresas.query()
      .preload("codigoUnicoRuta", (sqlCodigoUnico) => {
        sqlCodigoUnico.preload("ruta", (sqlRuta) => {
          sqlRuta.preload("cpOrigen", (sqlCporigen) => {
            sqlCporigen.preload("municipio", (sqlMunicipioO) => {
              sqlMunicipioO.preload("departamento");
            });
          });
          sqlRuta.preload("cpDestino", (sqlCpDestino) => {
            sqlCpDestino.preload("municipio", (sqlMunicipioD) => {
              sqlMunicipioD.preload("departamento");
            });
          });
          sqlRuta.preload("rutaDireccion", (sqlRutaDireccion) => {
            sqlRutaDireccion.preload("idNodos");
          });
          sqlRuta.where("id", idRuta);
        });
        sqlCodigoUnico.whereHas("ruta", (sqlRuta) => {
          sqlRuta.where("id", idRuta);
        });
        sqlCodigoUnico.where("id", codigoUnicoRuta);
      })
      .where("idRuta", codigoUnicoRuta)
      .first();

    const consultaDb = await consulta;

    const rutaDb = consultaDb!.codigoUnicoRuta.ruta[0];

    const ruta = {
      idRuta: consultaDb!.codigoUnicoRuta.id,
      codOrigen: rutaDb.codigoCpOrigen,
      descripcionOrigen: rutaDb.cpOrigen.nombre,
      departamentoOrigen: rutaDb.cpOrigen.municipio.departamento.nombre,
      municipioOrigen: rutaDb.cpOrigen.municipio.nombre,
      codDestino: rutaDb.codigoCpDestino,
      descripcionDestino: rutaDb.cpDestino.nombre,
      departamentoDestino: rutaDb.cpDestino.municipio.departamento.nombre,
      municipioDestino: rutaDb.cpDestino.municipio.nombre,
      codigoTerminal: rutaDb.rutaDireccion.idNodo,
      nombreTerminal: rutaDb.rutaDireccion.idNodos.descripcion,
    };
    return ruta;
  }

  public async listarEmpresasPorRuta({ request }: HttpContextContract) {
    const { idRuta } = request.all();
try {
  const consulta = await TblRutas.query().where({"id": idRuta, 'idaaVuelta':'A'}).preload('codigoRutas', (sqlCodigoRutas) => {
    sqlCodigoRutas.preload('rutaEmpresa', (sqlEmpresa) => {
      sqlEmpresa.preload('usuarios');
      });
      });

      const empresas = new Array();
      consulta.forEach((ruta) => {
        ruta.codigoRutas.forEach((codigoRuta) => {
          codigoRuta.rutaEmpresa.forEach((rutaEmpresa) => {
            const empresaExiste = empresas.find((empresaExiste) => empresaExiste.id === rutaEmpresa.usuarios.id);
            if (!empresaExiste) {
            empresas.push({
              id: rutaEmpresa.usuarios.id,
              nit: rutaEmpresa.usuarios.identificacion,
              razonSocial: rutaEmpresa.usuarios.nombre,
            });
            }
          });
      })
    })

      return {empresas};

} catch (error) {

}

  }

  public async rutasPorCodigo({ request }: HttpContextContract) {

    try {
      const { idRuta, pagina, limite } = request.all();

      const query = TblRutas.query().preload("cpOrigen", (sqlOrigen) => {
        sqlOrigen.preload("municipio", (sqlMunicipioO) => {
          sqlMunicipioO.preload("departamento");
        });
      })
      .preload("cpDestino", (sqlDestino) => {
        sqlDestino.preload("municipio", (sqlMunicipioD) => {
          sqlMunicipioD.preload("departamento");
        });
      });

      if (idRuta) {
        query.where("id", idRuta);
      }
      query.where("trt_estado", true).where("trt_ida_vuelta", "A");

      const rutasDB = await query

      const rutas = new Array();
      rutasDB.forEach((ruta) => {
          rutas.push({
            idRuta: ruta.id,
            codOrigen: ruta.codigoCpOrigen,
            descripcionOrigen: ruta.cpOrigen.nombre,
            departamentoOrigen: ruta.cpOrigen.municipio.departamento.nombre,
            municipioOrigen: ruta.cpOrigen.municipio.nombre,
            codDestino: ruta.codigoCpDestino,
            descripcionDestino: ruta.cpDestino.nombre,
            departamentoDestino: ruta.cpDestino.municipio.departamento.nombre,
            municipioDestino: ruta.cpDestino.municipio.nombre,
          });
      });

      return { rutas };



    } catch (error) {
      return { message: "No se pudieron obtener las rutas" };
    }
  }



  public async terminalRuta({ request }: HttpContextContract) {

    try {
      const { idRuta } = request.all();

      const terminal = await TblRutas.query().where("id", idRuta).preload("rutaDireccion", (sqlRutaDireccion) => {
        sqlRutaDireccion.preload("idNodos");
      }).first();
      if (terminal) {
        const respuestaDirecciones = {
          codCpNodo: terminal?.rutaDireccion.idNodos.codigoCp,
          razonSocial: terminal?.rutaDireccion.idNodos.descripcion
        }
        return { respuestaDirecciones };
      }else{
        return { message: "No se encontró la terminal para esta ruta" };
      }




    } catch (error) {
      return { message: "No se pudieron obtener las rutas" };
    }
  }


    public async mantenimientoPreventivo({ request, response }: HttpContextContract) {

    try {
      const { nit, placa  } = request.all();
      if(!nit || !placa){
        return response.badRequest({ mensaje: "Los campos nit y placa son obligatorios"})
      }
      const usuario = await TblUsuarios.query().where('identificacion', nit).first();
      if(!usuario){
        return response.badRequest({ mensaje: "El usuario no existe"})
      }
      const mantenimientoDB = await TblMantenimiento.query().where("placa",placa).where('usuarioId', usuario.id).where('tipoId',1).orderBy('id', 'desc').first();
      if(!mantenimientoDB){
        return response.status(200).send({})
      }

      const mantenimientoPrieventivoDB = await TblPreventivo.query().where('mantenimientoId', mantenimientoDB.id!).orderBy('id', 'desc').first();

       if(!mantenimientoPrieventivoDB){
        return response.status(200).send({})
      }
      const hoy = new Date();
      let estadoMantenimiento = "Sin reporte";
      const fechaDiligenciamiento = new Date(new Date(mantenimientoDB.fechaDiligenciamiento.toString()) );
            fechaDiligenciamiento.setMonth(fechaDiligenciamiento.getMonth() + 2);
            const diferenciaDias =
              (fechaDiligenciamiento.getTime() - hoy.getTime()) /
              (1000 * 3600 * 24);

              if(!mantenimientoDB.estado){
                estadoMantenimiento = "Vencido";
              }else{
           /*  if(mantenimientoDB.estadoId == 2){
                estadoMantenimiento = "Iniciado";
            }else */ if (diferenciaDias < -1) {
              estadoMantenimiento = "Vencido";
            } else if (diferenciaDias <= 15) {
              estadoMantenimiento = "Próximo a vencer";
            } else {
              estadoMantenimiento = "Reportado vigente";
            }
          }

      const mantenimientoPrieventivo = {
        placa: mantenimientoPrieventivoDB.placa,
        fecha: mantenimientoPrieventivoDB.fecha.toISOString().split('T')[0],
        hora: mantenimientoPrieventivoDB.hora,
        nitCentroEspecializado: mantenimientoPrieventivoDB.nit,
        razonSocialCentroEspecializado: mantenimientoPrieventivoDB.razonSocial,
        tipoIdentificacionIngenieroMecanico: mantenimientoPrieventivoDB.tipoIdentificacion,
        numeroIdentificacionIngenieroMecanico: mantenimientoPrieventivoDB.numeroIdentificacion,
        nombresResponsableIngenieroMecanico: mantenimientoPrieventivoDB.nombresResponsable,
        detalleActividades: mantenimientoPrieventivoDB.detalleActividades,
        estadoMantenimiento,
      }
        return mantenimientoPrieventivo ;

    } catch (error) {
      console.log(error);
      return response.badRequest({mensaje: "No se pudo obtener el mantenimeinto preventivo"});
    }
  }


  public async protocoloAlistamiento({ request, response }: HttpContextContract) {

    try {
      const { nit, placa  } = request.all();
      if(!nit || !placa){
        return response.badRequest({ mensaje: "Los campos nit y placa son obligatorios"})
      }
      const usuario = await TblUsuarios.query().where('identificacion', nit).first();
      if(!usuario){
        return response.badRequest({ mensaje: "El usuario no existe"})
      }
      const mantenimientoDB = await TblMantenimiento.query()
        .where("placa", placa)
        .where('usuarioId', usuario.id)
        .where('tipoId', 3)
        .orderBy('id', 'desc')
        .first();
      if(!mantenimientoDB){
        return response.status(200).send({})
      }

      const alistamientoDB = await TblAlistamiento.query()
        .where('mantenimientoId', mantenimientoDB.id!)
        .orderBy('id', 'desc')
        .first();

      if(!alistamientoDB){
        return response.status(200).send({})
      }

      const alistamiento = {
        placa: alistamientoDB.placa,
        tipoIdentificacionResponsable: alistamientoDB.tipoIdentificacionResponsable,
        numeroIdentificacionResponsable: alistamientoDB.numeroIdentificacionResponsable,
        nombreResponsable: alistamientoDB.nombreResponsable,
        tipoIdentificacionConductor: alistamientoDB.tipoIdentificacionConductor,
        numeroIdentificacionConductor: alistamientoDB.numeroIdentificacionConductor,
        nombresConductor: alistamientoDB.nombresConductor,
        detalleActividades: alistamientoDB.detalleActividades
      }
      return alistamiento ;

    } catch (error) {
      console.log(error);
      return response.badRequest({mensaje: "No se pudo obtener el protocolo de alistamiento"});
    }
  }

  public async autorizaciones({ request, response }: HttpContextContract) {

    try {
      const { nit, placa, fecha  } = request.all();
      console.log(nit, placa, fecha);

      if(!nit || !placa || !fecha){
        return response.badRequest({ mensaje: "Los campos nit, placa y fecha son obligatorios"})
      }
      const usuario = await TblUsuarios.query().where('identificacion', nit).first();
      if(!usuario){
        return response.badRequest({ mensaje: "El usuario no existe"})
      }
      const mantenimientoDB = await TblMantenimiento.query()
      .preload('autorizacion', sql => {
        sql.where('tat_fecha_viaje', fecha)
      })
        .where("placa", placa)
        .where('usuarioId', usuario.id)
        .where('tipoId', 4)
        .orderBy('id', 'desc')


      if(!mantenimientoDB){
        return response.status(200).send({})
      }

      const autorizaciones = new Array();

      mantenimientoDB.forEach(element => {
        if(!element.autorizacion){
          return
        }
        autorizaciones.push({
          id: element.autorizacion.id,
            fechaViaje: element.autorizacion.fechaViaje.toISOString().split('T')[0],
            origen: element.autorizacion.origen,
            destino: element.autorizacion.destino,
            tipoIdentificacionNna: element.autorizacion.tipoIdentificacionNna,
            numeroIdentificacionNna: element.autorizacion.numeroIdentificacionNna,
            nombresApellidosNna: element.autorizacion.nombresApellidosNna,
            situacionDiscapacidad: element.autorizacion.situacionDiscapacidad,
            tipoDiscapacidad: element.autorizacion.tipoDiscapacidad,
            perteneceComunidadEtnica: element.autorizacion.perteneceComunidadEtnica,
            tipoPoblacionEtnica: element.autorizacion.tipoPoblacionEtnica,
            tipoIdentificacionOtorgante: element.autorizacion.tipoIdentificacionOtorgante,
            numeroIdentificacionOtorgante: element.autorizacion.numeroIdentificacionOtorgante,
            nombresApellidosOtorgante: element.autorizacion.nombresApellidosOtorgante,
            numeroTelefonicoOtorgante: element.autorizacion.numeroTelefonicoOtorgante,
            correoElectronicoOtorgante: element.autorizacion.correoElectronicoOtorgante,
            direccionFisicaOtorgante: element.autorizacion.direccionFisicaOtorgante,
            sexoOtorgante: element.autorizacion.sexoOtorgante,
            generoOtorgante: element.autorizacion.generoOtorgante,
            calidadActua: element.autorizacion.calidadActua,
            tipoIdentificacionAutorizadoViajar: element.autorizacion.tipoIdentificacionAutorizadoViajar,
            numeroIdentificacionAutorizadoViajar: element.autorizacion.numeroIdentificacionAutorizadoViajar,
            nombresApellidosAutorizadoViajar: element.autorizacion.nombresApellidosAutorizadoViajar,
            numeroTelefonicoAutorizadoViajar: element.autorizacion.numeroTelefonicoAutorizadoViajar,
            direccionFisicaAutorizadoViajar: element.autorizacion.direccionFisicaAutorizadoViajar,
            tipoIdentificacionAutorizadoRecoger: element.autorizacion.tipoIdentificacionAutorizadoRecoger,
            numeroIdentificacionAutorizadoRecoger: element.autorizacion.numeroIdentificacionAutorizadoRecoger,
            nombresApellidosAutorizadoRecoger: element.autorizacion.nombresApellidosAutorizadoRecoger,
            numeroTelefonicoAutorizadoRecoger: element.autorizacion.numeroTelefonicoAutorizadoRecoger,
            direccionFisicaAutorizadoRecoger: element.autorizacion.direccionFisicaAutorizadoRecoger,
            copiaAutorizacionViajeNombreOriginal: element.autorizacion.copiaAutorizacionViajeNombreOriginal,
            copiaDocumentoParentescoNombreOriginal: element.autorizacion.copiaDocumentoParentescoNombreOriginal,
            copiaDocumentoIdentidadAutorizadoNombreOriginal: element.autorizacion.copiaDocumentoIdentidadAutorizadoNombreOriginal,
            copiaConstanciaEntregaNombreOriginal: element.autorizacion.copiaConstanciaEntregaNombreOriginal
        })

      });


      return autorizaciones ;

    } catch (error) {
      console.log(error);
      return response.badRequest({mensaje: "No se pudo obtener el protocolo de alistamiento"});
    }
  }


    public async preventivoCorrectivo({ request, response }: HttpContextContract) {

    try {
      const { nit, placa, fechaConsulta } = request.all();
      if(!nit || !placa){
        return response.badRequest({ mensaje: "Los campos nit y placa son obligatorios"})
      }
      const usuario = await TblUsuarios.query().where('identificacion', nit).first();
      if(!usuario){
        return response.badRequest({ mensaje: "El usuario no existe"})
      }
      const mantenimientoPreventivo = new Array();
      const mantenimientoCorrectivo = new Array();
      const alistamiento = new Array();

      // Filtro base para los mantenimientos
      let filtroBase = TblMantenimiento.query()
        .where("placa", placa)
        .where('usuarioId', usuario.id);

      // Si se proporciona fechaConsulta, buscar el último registro con fecha menor o igual
      if (fechaConsulta) {
        // Suponiendo que fechaConsulta viene en formato 'YYYY-MM-DD'
        filtroBase = filtroBase.whereRaw('CAST(tmt_fecha_diligenciamiento AS DATE) <= ?', [fechaConsulta]);
      }

      // Preventivo
      const mantenimientoPDB = await filtroBase.clone().where('tipoId', 1).orderByRaw('CAST(tmt_fecha_diligenciamiento AS DATE) DESC').orderBy('id', 'desc').first();
      if(mantenimientoPDB){
        const mantenimientoPrieventivoDB = await TblPreventivo.query().where('mantenimientoId', mantenimientoPDB.id!).orderBy('id', 'desc').first();
        if(mantenimientoPrieventivoDB){
          mantenimientoPreventivo.push({
            "id": mantenimientoPrieventivoDB.id,
            "fecha":mantenimientoPrieventivoDB.fecha.toISOString().split('T')[0],
            "detalleActividades": mantenimientoPrieventivoDB.detalleActividades,
          })
        }
      }

      // Correctivo
      const mantenimientoCDB = await filtroBase.clone().where('tipoId', 2).orderByRaw('CAST(tmt_fecha_diligenciamiento AS DATE) DESC').orderBy('id', 'desc').first();
      if(mantenimientoCDB){
        const mantenimientoCorrectivoDB = await TblCorrectivo.query().where('mantenimientoId', mantenimientoCDB.id!).orderBy('id', 'desc').first();
        if(mantenimientoCorrectivoDB){
         mantenimientoCorrectivo.push({
            "id": mantenimientoCorrectivoDB.id,
            "fecha":mantenimientoCorrectivoDB.fecha.toISOString().split('T')[0],
            "detalleActividades": mantenimientoCorrectivoDB.detalleActividades,
          })
        }
      }

      // Alistamiento
      const mantenimientoADB = await filtroBase.clone().where('tipoId', 3).orderByRaw('CAST(tmt_fecha_diligenciamiento AS DATE) DESC').orderBy('id', 'desc').first();
      if(mantenimientoADB){
        const alistamientoDB = await TblAlistamiento.query().where('mantenimientoId', mantenimientoADB.id!).orderBy('id', 'desc').first();
        if(alistamientoDB){
          const adjustedDate = this.adjustDateToColombiaTimezone(mantenimientoADB.fechaDiligenciamiento.toJSDate());
          alistamiento.push({
            "id": alistamientoDB.id,
            "fecha": adjustedDate.toISOString().split('T')[0],
            "detalleActividades": alistamientoDB.detalleActividades,
          })
        }
      }

      return {mantenimientoPreventivo, mantenimientoCorrectivo, alistamiento} ;

    } catch (error) {
      console.log(error);
      return response.badRequest({mensaje: "No se pudo obtener la información"});
    }
  }

    public async terminales({ request }: HttpContextContract) {
    const terminales = await TblTerminales.query().orderBy('nombre', 'asc');

    try {
      const respuestaTerminales = terminales.map((terminal) => {
        return {
          //id: terminal.id,
          nit: terminal.nit,
          nombre: terminal.nombre,
          //estado: terminal.estado,
        };
      });
      return respuestaTerminales;
    } catch (error) {
      return { message: "No se pudieron obtener los terminales" };
    }
  }



}
