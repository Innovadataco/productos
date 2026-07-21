import Database from '@ioc:Adonis/Lucid/Database'
import { DashboardResumenDto, DashboardLogMantenimientoDto } from 'App/Dominio/Dto/DashboardDto'
import { RepositorioMantenimiento } from '../Repositorios/RepositorioMantenimiento'
import { Exception } from '@adonisjs/core/build/standalone';
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario';

export class ObtenerResumenDashboard {
  constructor(private repositorioMantenimiento?: RepositorioMantenimiento) {}

  public async ejecutar(nit?: string, fechaInicio?: string, fechaFin?: string): Promise<DashboardResumenDto[]> {

      let nitVigilado = '';
      const usuarioDb = await TblUsuarios.query().where('identificacion', nit?.toString()!).first();
        if (!usuarioDb) {
          throw new Exception("Usuario no encontrado", 404);
        }

        if (usuarioDb.idRol === 3) {
          const identificacionAdministrador = usuarioDb.administrador;
          if (!identificacionAdministrador) {
            throw new Exception("Usuario administrador no encontrado", 404);
          }

          nitVigilado = String(identificacionAdministrador);
        } else if (usuarioDb.idRol === 2 || usuarioDb.idRol === 1) {
          nitVigilado = String(usuarioDb.identificacion ?? '');
        } else {
          nitVigilado = String(usuarioDb.identificacion ?? '');
        }


    // Si se proporciona un NIT específico, filtrar por ese NIT
    const whereClauseNit = nit ? `AND u.usn_identificacion = '${nitVigilado}'` : ''

    // Construir filtros de fecha
    const fechaFilter = fechaInicio && fechaFin
      ? `AND fpu.fecha BETWEEN '${fechaInicio}' AND '${fechaFin}'`
      : fechaInicio
      ? `AND fpu.fecha >= '${fechaInicio}'`
      : fechaFin
      ? `AND fpu.fecha <= '${fechaFin}'`
      : ''

    const query = `
      WITH fechas_por_usuario AS (
        -- Obtener todas las fechas únicas de mantenimientos
        SELECT
          CAST(m.tmt_usuario_id AS VARCHAR) as usn_identificacion,
          m.tmt_fecha_diligenciamiento::DATE as fecha
        FROM tbl_mantenimientos m
        WHERE 1=1
        ${fechaInicio && fechaFin ? `AND m.tmt_fecha_diligenciamiento::DATE BETWEEN '${fechaInicio}'::DATE AND '${fechaFin}'::DATE` : ''}
        ${fechaInicio && !fechaFin ? `AND m.tmt_fecha_diligenciamiento::DATE >= '${fechaInicio}'::DATE` : ''}
        ${!fechaInicio && fechaFin ? `AND m.tmt_fecha_diligenciamiento::DATE <= '${fechaFin}'::DATE` : ''}

        UNION

        -- Obtener todas las fechas únicas de novedades
        SELECT
          n.nov_usuario_id as usn_identificacion,
          n.nov_fecha_novedad as fecha
        FROM tbl_novedades n
        WHERE 1=1
        ${fechaInicio && fechaFin ? `AND n.nov_fecha_novedad BETWEEN '${fechaInicio}' AND '${fechaFin}'` : ''}
        ${fechaInicio && !fechaFin ? `AND n.nov_fecha_novedad >= '${fechaInicio}'` : ''}
        ${!fechaInicio && fechaFin ? `AND n.nov_fecha_novedad <= '${fechaFin}'` : ''}

        UNION

        -- Obtener todas las fechas únicas de despachos
        SELECT
          ds.des_sol_nit_vigilado as usn_identificacion,
          ds.des_sol_fecha_creacion::DATE as fecha
        FROM tbl_despachos_solicitudes ds
        WHERE 1=1
        ${fechaInicio && fechaFin ? `AND ds.des_sol_fecha_creacion::DATE BETWEEN '${fechaInicio}'::DATE AND '${fechaFin}'::DATE` : ''}
        ${fechaInicio && !fechaFin ? `AND ds.des_sol_fecha_creacion::DATE >= '${fechaInicio}'::DATE` : ''}
        ${!fechaInicio && fechaFin ? `AND ds.des_sol_fecha_creacion::DATE <= '${fechaFin}'::DATE` : ''}
      )
      SELECT
        u.usn_identificacion as nitEmpresa,
        u.usn_nombre as nombreEmpresa,
        TO_CHAR(fpu.fecha, 'DD/MM/YYYY') as fecha,
        COALESCE(
          (SELECT COUNT(*) FROM tbl_mantenimientos m
           WHERE CAST(m.tmt_usuario_id AS VARCHAR) = u.usn_identificacion
           AND m.tmt_tipo_id = 2
           AND m.tmt_fecha_diligenciamiento::DATE = fpu.fecha), 0
        ) as mantenimientoCorrectivo,
        COALESCE(
          (SELECT COUNT(*) FROM tbl_mantenimientos m
           WHERE CAST(m.tmt_usuario_id AS VARCHAR) = u.usn_identificacion
           AND m.tmt_tipo_id = 1
           AND m.tmt_fecha_diligenciamiento::DATE = fpu.fecha), 0
        ) as mantenimientoPreventivo,
        COALESCE(
          (SELECT COUNT(*) FROM tbl_mantenimientos m
           WHERE CAST(m.tmt_usuario_id AS VARCHAR) = u.usn_identificacion
           AND m.tmt_tipo_id = 3
           AND m.tmt_fecha_diligenciamiento::DATE = fpu.fecha), 0
        ) as alistamiento,
        COALESCE(
          (SELECT COUNT(*) FROM tbl_mantenimientos m
           WHERE CAST(m.tmt_usuario_id AS VARCHAR) = u.usn_identificacion
           AND m.tmt_tipo_id = 4
           AND m.tmt_fecha_diligenciamiento::DATE = fpu.fecha), 0
        ) as autorizaciones,
        COALESCE(
          (SELECT COUNT(*) FROM tbl_novedades n
           WHERE n.nov_usuario_id = u.usn_identificacion
           AND n.nov_fecha_novedad = fpu.fecha), 0
        ) as novedades,
        COALESCE(
          (SELECT COUNT(*) FROM tbl_despachos_solicitudes ds
           WHERE ds.des_sol_nit_vigilado = u.usn_identificacion
           AND ds.des_sol_fecha_creacion::DATE = fpu.fecha), 0
        ) as despachos
      FROM fechas_por_usuario fpu
      INNER JOIN tbl_usuarios u ON u.usn_identificacion = fpu.usn_identificacion
      WHERE 1=1 ${whereClauseNit} ${fechaFilter}
      ORDER BY fpu.fecha DESC, u.usn_nombre
    `

    const resultado = await Database.rawQuery(query)

    // Mapear los resultados al DTO
    const resumen: DashboardResumenDto[] = resultado.rows.map((fila: any) => {
      return new DashboardResumenDto(
        fila.nitempresa || fila.nitEmpresa,
        fila.nombreempresa || fila.nombreEmpresa,
        parseInt(fila.mantenimientocorrectivo || fila.mantenimientoCorrectivo) || 0,
        parseInt(fila.mantenimientopreventivo || fila.mantenimientoPreventivo) || 0,
        parseInt(fila.alistamiento) || 0,
        parseInt(fila.autorizaciones) || 0,
        parseInt(fila.novedades) || 0,
        parseInt(fila.despachos) || 0,
        fila.fecha
      )
    })

    return resumen
  }

  /**
   * Obtiene el listado de placas con sus estados de mantenimiento (siempre tipo 1 - preventivo)
   * Si se proporciona una placa específica, filtra el resultado por esa placa
   * Si se proporciona un NIT, consulta con ese NIT en lugar del usuario actual
   * Retorna solo el arreglo de placas (strings)
   */
  public async obtenerPlacas(
    usuario: string,
    idRol: number,
    placa?: string,
    nit?: string
  ): Promise<string[]> {
    if (!this.repositorioMantenimiento) {
      throw new Error('Repositorio de mantenimiento no inicializado')
    }

    // Si se proporciona un NIT, usarlo en lugar del usuario actual
    const usuarioConsulta = nit || usuario

    // Siempre buscar por tipo 1 (mantenimiento preventivo)
    const resultados = await this.repositorioMantenimiento.listarPlacas(1, usuarioConsulta, idRol)

    // Extraer solo las placas
    let placas = resultados.map(r => r.placa).filter(p => p)

    // Si se especifica una placa, filtrar el resultado
    if (placa) {
      placas = placas.filter(p =>
        p?.toLowerCase() === placa.toLowerCase()
      )
    }

    return placas
  }

  /**
   * Obtiene los logs de mantenimientos con información detallada
   * Permite filtrar por NIT de empresa
   */
  public async obtenerLogsMantenimiento(nit?: string): Promise<DashboardLogMantenimientoDto[]> {
    const whereClause = nit ? `WHERE u.usn_identificacion = '${nit}'` : ''

    const query = `
      SELECT
        m.tmt_id as id,
        m.tmt_placa as placa,
        m.tmt_fecha_diligenciamiento as fechaDiligenciamiento,
        m.tmt_tipo_id as tipoId,
        m.tmt_procesado as procesado,
        m.tmt_mantenimiento_id as mantenimientoId,
        u.usn_identificacion as nit,
        u.usn_nombre as nombre,
        CASE
          WHEN m.tmt_tipo_id = 1 THEN 'Mantenimiento Preventivo'
          WHEN m.tmt_tipo_id = 2 THEN 'Mantenimiento Correctivo'
          WHEN m.tmt_tipo_id = 3 THEN 'Alistamiento'
          WHEN m.tmt_tipo_id = 4 THEN 'Autorizaciones'
          ELSE 'Desconocido'
        END as tipo
      FROM tbl_mantenimientos m
      INNER JOIN tbl_usuarios u ON CAST(m.tmt_usuario_id AS VARCHAR) = u.usn_identificacion
      ${whereClause}
      ORDER BY m.tmt_fecha_diligenciamiento DESC
    `

    const resultado = await Database.rawQuery(query)

    // Mapear los resultados al DTO
    const logs: DashboardLogMantenimientoDto[] = resultado.rows.map((fila: any) => {
      return new DashboardLogMantenimientoDto(
        fila.tipo,
        fila.fechadiligenciamiento || fila.fechaDiligenciamiento,
        fila.placa,
        fila.procesado,
        fila.mantenimientoid || fila.mantenimientoId || 0,
        fila.nit,
        fila.nombre
      )
    })

    return logs
  }
}
