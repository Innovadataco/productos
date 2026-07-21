import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Database from '@ioc:Adonis/Lucid/Database'

/**
 * Este seeder es opcional y sirve como ejemplo
 * para asignar módulos personalizados a usuarios específicos
 *
 * Ejemplo: Usuario con ID 5 (rol cliente) tendrá acceso solo a módulos 1 y 2
 */
export default class UsuariosModulosSeeder extends BaseSeeder {
  public async run () {
    // Ejemplo: Asignar módulos 1 y 2 al usuario con ID 5
    // await Database
    //   .table('tbl_usuarios_modulos')
    //   .multiInsert([
    //     {
    //       usm_id: 1,
    //       usm_usuario_id: 5, // ID del usuario
    //       usm_modulo_id: 1,  // ID del módulo
    //       usm_estado: true,
    //     },
    //     {
    //       usm_id: 2,
    //       usm_usuario_id: 5,
    //       usm_modulo_id: 2,
    //       usm_estado: true,
    //     }
    //   ])

    console.log('Seeder de usuarios-módulos ejecutado (vacío por defecto)')
  }
}
