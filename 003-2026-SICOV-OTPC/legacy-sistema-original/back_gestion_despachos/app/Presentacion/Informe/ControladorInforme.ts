import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Database from "@ioc:Adonis/Lucid/Database";
import { ServicioExportacion } from "App/Dominio/Datos/Servicios/ServicioExportacion";
import { TblActualEstados } from "App/Infraestructura/Datos/Entidad/ActualEstados";
import TblUsuarios from "App/Infraestructura/Datos/Entidad/Usuario";
/* import { TblVigencias } from "App/Infraestructura/Datos/Entidad/Vigencia";
import TblReporte from "App/Infraestructura/Datos/Entidad/Reporte";
import { TblMeses } from "App/Infraestructura/Datos/Entidad/Mes";
import { TblEstadosReportes } from "App/Infraestructura/Datos/Entidad/EstadosReportes"; */
export default class ControladorExportacion {
  private servicioExportacion = new ServicioExportacion();

  public async informes({ request, response }: HttpContextContract) {
    const { tipo } = request.all();
    const sql = await this.obtenerSql(tipo);

    const f = await Database.rawQuery(sql);
    const rows = f.rows;

    // Si no hay filas, no se pueden crear cabeceras
    if (rows.length === 0) {
      throw new Error("No hay filas en el resultado de la consulta");
    }

    // Obtén las claves del primer objeto en el arreglo para generar las cabeceras
    const firstRow = rows[0];
    const keys = Object.keys(firstRow);

    // Mapea las claves a un formato de cabecera adecuado
    const cabeceras = keys.map((key) => {
      return {
        header: key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase()), // Reemplaza guiones bajos con espacios y capitaliza cada palabra
        key: key,
        width: 20, // Puedes ajustar el ancho según tus necesidades
      };
    });

    /* parametros.pagina = undefined
parametros.limite = 10000000000 */

    /* const data = await this.servicioPoliza.obtenerVehiculos(request.all(), id)

const cabeceras = [
  { header: 'NIt', key: 'nit', width: 20 },
  { header: 'Razón social', key: 'razon_social', width: 50 },
  { header: 'Tipo', key: 'tipo', width: 50 },
  { header: 'Número de póliza', key: 'numero_poliza', width: 20 },
  { header: 'Placa', key: 'placa', width: 20 },
  { header: 'Pasajeros', key: 'pasajeros', width: 20 },
]
*/
    const buffer = await this.servicioExportacion.encuestaToXLSX(
      rows,
      cabeceras,
      'Informe'
    );

    // Configurar opciones de respuesta
    response.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    response.header("Content-Disposition", "attachment; filename=datos.xlsx");

    // Enviar el archivo XLSX como respuesta
    response.send(buffer);
  }

  /*
  [
{
"id":1,
"nombre":"Fase 1"
},
{
"id":2,
"nombre":"Fase 2"
},
{
"id":3,
"nombre":"Soportes funcionales"
},
{
"id":4,
"nombre":"Problemas de acceso"
},
] 
   */

  obtenerSql = async (tipo: number, vigencia?: number, mes?: number) => {
    let sql = "";
    if (tipo == 1) {
      sql = `SELECT
      r.login_vigilado as NIT,
      tu.usn_nombre as RAZON_SOCIAL,
      STRING_AGG(tm.nombre, ', ') AS MODALIDADES,
      r.fecha_enviost as FECHA_ENVIO,
      tev.esv_nombre as estado
  FROM
      reporte r
  INNER JOIN tbl_usuarios tu ON r.login_vigilado = tu.usn_usuario
  LEFT JOIN tbl_modalidades_radios tmr ON tmr.tmr_usuario_id = tu.usn_id
  LEFT JOIN tb_modalidades tm ON tmr.tmr_modalidad_id = tm.id_mod
  LEFT JOIN tbl_estados_vigilados tev ON r.estado_verificacion_id = tev.esv_id
  WHERE
      r.id_encuesta = 1
      AND tu.usn_correo <> 'andresmedina@supertransporte.gov.co'
  GROUP BY
      tev.esv_nombre,
      r.login_vigilado,
      tu.usn_nombre,
      r.fecha_enviost
  ORDER BY
      r.fecha_enviost asc;`;
    } else if (tipo == 2) {
      sql = ``;
    }

    return sql;
  };

  public async obtenerEstado({ request, response }: HttpContextContract) {
    const { nit } = request.all();
    let estado = false;

    const usuario = await TblUsuarios.findBy('usn_usuario',nit)
if(usuario){
  const estadoReporte = await TblActualEstados.query().where('tae_vigilado_id', usuario.id).first()
  if(estadoReporte && estadoReporte.estadoId == 1){
    estado = true
  }
}
 

    return estado;
  }
}
