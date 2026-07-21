import { Paginador } from 'App/Dominio/Paginador';
import { MapeadorPaginacionDB } from './MapeadorPaginacionDB';
import { RepositorioUsuario } from 'App/Dominio/Repositorios/RepositorioUsuario';
import { Usuario } from 'App/Dominio/Datos/Entidades/Usuario';
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario';
import { PayloadJWT } from '../../../Dominio/Dto/PayloadJWT';
import Database from '@ioc:Adonis/Lucid/Database';

export class RepositorioUsuariosDB implements RepositorioUsuario {
  async obtenerUsuarios (params: any): Promise<{usuarios: Usuario[], paginacion: Paginador}> {
    const usuarios: Usuario[] = []

    const consulta = TblUsuarios.query()
    if (params.rol) {
      consulta.whereIn('usn_rol_id', [1,2])
    }
if(params.termino){
  consulta.andWhere(subquery => {
    subquery.orWhere('usn_correo', 'ilike', `%${params.termino}%`)
    subquery.orWhere('usn_nombre', 'ilike', `%${params.termino}%`)
    subquery.orWhere('usn_identificacion', 'ilike', `%${params.termino}%`)
  })
}

if(params.administrador){
  consulta.where('usn_administrador', params.administrador)
}


    const usuariosDB = await consulta.orderBy('usn_nombre', 'asc').paginate(params.pagina, params.limite)

    usuariosDB.forEach(usuariosDB => {
      usuarios.push(usuariosDB.obtenerUsuario())
    })
    const paginacion = MapeadorPaginacionDB.obtenerPaginacion(usuariosDB)
    return {usuarios , paginacion}
  }

  async obtenerUsuarioPorId (id: number): Promise<Usuario> {
    const usuario = await TblUsuarios.findOrFail(id)
    return usuario.obtenerUsuario()
  }

  async obtenerUsuarioPorRol (rol: string): Promise<Usuario[]> {
    const usuarios: any[] = []
    const usuariosDB = await TblUsuarios.query().where('usn_rol_id', rol).orderBy('id', 'desc')
    usuariosDB.forEach(usuarioDB => {

      /* usuarios.push(usuariosDB.obtenerUsuario()) */
      usuarios.push({
        id: usuarioDB.id,
        nombre: usuarioDB.nombre,
        identificacion: usuarioDB.identificacion
      })
    })
    return usuarios
  }

  async obtenerUsuarioPorUsuario (nombreUsuario: string): Promise<Usuario | null>{
    const usuario = await TblUsuarios.query().where('usuario', '=', nombreUsuario).first()
    if(usuario){
      return usuario.obtenerUsuario()
    }
    return null
  }

  async guardarUsuario (usuario: Usuario): Promise<Usuario> {
    const usuarioExiste = await TblUsuarios.query().where('identificacion', usuario.identificacion).first();
    if(usuarioExiste){
        let usuarioRetorno = await TblUsuarios.findOrFail(usuarioExiste.id)
        usuarioRetorno.estableceUsuarioConId(usuario)
        await usuarioRetorno.save()
        return usuarioRetorno.obtenerUsuario()
      }else{
        let usuarioDB = new TblUsuarios()
        usuarioDB.establecerUsuarioDb(usuario)
        await usuarioDB.save()
        return usuarioDB.obtenerUsuario()
      }
  }

  async actualizarUsuario (id: number, usuario: Usuario, payload?:PayloadJWT): Promise<Usuario> {
    let usuarioRetorno = await TblUsuarios.findOrFail(id)
    usuarioRetorno.estableceUsuarioConId(usuario)
    await usuarioRetorno.save()


    return usuarioRetorno.obtenerUsuario();
  }


  async obtenerVigilados (params: any): Promise<{usuarios: Usuario[]}> {
    const { termino, pagina=1, limite=10 }= params

    try {
      const rawQuery = `
        SELECT
          tu.usn_identificacion AS nit,
          tu.usn_nombre AS razon_social,
          tu.usn_correo AS correo,
          tu.usn_id AS id,
          CASE
            WHEN te.est_nombre IS NULL THEN 'No Iniciado'
            ELSE te.est_nombre
          END AS estado,
          CASE
        WHEN te.est_id = 1 THEN ts.sol_actualizacion
          ELSE NULL
          END AS fecha_envio,
          (select count(*)  from tbl_ruta_empresas tre where tu.usn_id = tre.tre_id_usuario ) as total_rutas
        FROM tbl_usuarios tu
        LEFT JOIN tbl_solicitudes ts ON ts.sol_vigilado_id = tu.usn_id
        LEFT JOIN tbl_estados te ON ts.sol_estado_vigilado = te.est_id
        WHERE tu.usn_rol_id = 3
        ${termino ? `AND (tu.usn_correo ILIKE '%${termino}%' OR tu.usn_nombre ILIKE '%${termino}%' OR tu.usn_identificacion ILIKE '%${termino}%')` : ''}
        ORDER BY tu.usn_nombre ASC
      `;

      const usuariosDB = await Database.rawQuery(rawQuery);

     const usuarios = usuariosDB.rows

      return {usuarios}

    } catch (error) {
      console.log(error);

      throw new Error("Error al obtener los vigilados");

    }

  }


    async obtenerTodosVigilados (params: any): Promise<{usuarios: Usuario[]}> {
    const { termino, pagina=1, limite=10 }= params

    try {
      const rawQuery = `
        SELECT
          tu.usn_identificacion AS nit,
          tu.usn_nombre AS razon_social,
          tu.usn_correo AS correo,
          tu.usn_id AS id
        FROM tbl_usuarios tu
        WHERE tu.usn_rol_id = 3
        ${termino ? `AND (tu.usn_correo ILIKE '%${termino}%' OR tu.usn_nombre ILIKE '%${termino}%' OR tu.usn_identificacion ILIKE '%${termino}%')` : ''}
        ORDER BY tu.usn_nombre ASC
      `;

      const usuariosDB = await Database.rawQuery(rawQuery);

     const usuarios = usuariosDB.rows

      return usuarios

    } catch (error) {
      console.log(error);

      throw new Error("Error al obtener los vigilados");

    }

  }

  async obtenerUsuariosRol2 (): Promise<{usuarios: Usuario[]}> {
    try {
      const rawQuery = `
        SELECT
          tu.usn_identificacion AS nit,
          tu.usn_nombre AS razon_social
        FROM tbl_usuarios tu
        WHERE tu.usn_rol_id = 2
        ORDER BY tu.usn_nombre ASC
      `;

      const usuariosDB = await Database.rawQuery(rawQuery);
      const usuarios = usuariosDB.rows

      return {usuarios}

    } catch (error) {
      console.log(error);
      throw new Error("Error al obtener usuarios con rol 2");
    }
  }


}
