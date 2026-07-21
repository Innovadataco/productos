import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import { DateTime } from 'luxon'
import TblUsuarios from 'App/Infraestructura/Datos/Entidad/Usuario'
import { ROLES } from 'App/Dominio/DiccionarioAutorizacion'


export default class UsuariosSeeder extends BaseSeeder {
  public async run () {
    await TblUsuarios.createMany([
        {
            nombre: 'Administrador',
            clave: 'REDACTED-BCRYPT-HASH',
            correo: 'administrador@correo.com',
            identificacion: '999999999',
            idRol: ROLES.ADMINISTRADOR,
            usuario: '999999999'
        }
    ])
  }
}
